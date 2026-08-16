import { assignToDays, dedupe, fillToMinimum, normalizeName, orderDays, orderWithinDay } from "./routing";
import { formatTime, insertMeals, layoutDay, type MealSlot } from "./schedule";
import { minimalNarration, type NarratedDay } from "./narrate";
import { INTENSITY_RANGE } from "./types";
import type { Candidate, Coord, Intensity, MealType, ResolvedPlace, ScheduledDay, TransportMode } from "./types";
import type { PlaceResolver } from "../places/resolver";

export type PlanRequest = {
  destination: string;
  days: number;
  intensity: Intensity;
  transportMode: TransportMode;
  styles: string[];
  mustVisitPlaces: string;
  comments: string;
  /** 절약형·표준형·고급형 등. 선택 입력이라 없으면 프롬프트에서 빠진다. */
  budget?: string;
  /** 혼자·친구·연인·가족 등. 선택 입력. */
  companion?: string;
  /** 다시 추천하지 않을 장소 이름. 수정 요청에서 이전 일정을 넘긴다. */
  excludeNames?: readonly string[];
};

export type PipelineDeps = {
  resolver: PlaceResolver;
  fetchCandidates: (request: PlanRequest) => Promise<Candidate[]>;
  narrateDay: (day: ScheduledDay, destination: string) => Promise<NarratedDay>;
};

export type PlanActivity = {
  time: string; title: string; description: string; location: string;
  category: string; isMeal: boolean; mealType: string; mustVisit: boolean;
  latitude: number; longitude: number; tags: string[]; placeUrl?: string;
};
export type PlanDay = { day: number; theme: string; description: string; activities: PlanActivity[] };

const MEAL_RADIUS_M = 1000;

/**
 * allSettled는 rejection을 조용히 버린다. 키 쿼터가 소진되면 전 후보가 429로 실패해
 * "검증된 장소가 0곳" 오류만 남고 서버 로그에는 아무 단서도 남지 않는다.
 * 사용자 응답에는 넣지 않고 서버 로그에만 남긴다.
 */
function logRejections(label: string, settled: readonly PromiseSettledResult<unknown>[]): void {
  const reasons = settled
    .filter((s): s is PromiseRejectedResult => s.status === "rejected")
    .map((s) => (s.reason instanceof Error ? s.reason.message : String(s.reason)));
  if (reasons.length === 0) return;

  const counts = new Map<string, number>();
  reasons.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const summary = [...counts.entries()].map(([msg, n]) => `${msg} x${n}`).join(", ");
  console.warn(`[TripMate] ${label} ${reasons.length}/${settled.length}건 실패: ${summary}`);
}

async function resolveAll(
  resolver: PlaceResolver,
  candidates: readonly Candidate[],
  destination: string,
  mustNames: readonly string[],
): Promise<ResolvedPlace[]> {
  const settled = await Promise.allSettled(
    candidates.map((c) => resolver.resolve(c.name, destination)),
  );
  logRejections("장소 검증", settled);
  const mustSet = new Set(mustNames.map(normalizeName));
  const resolved = settled
    .map((s, i) =>
      s.status === "fulfilled" && s.value
        ? { ...s.value, mustVisit: mustSet.has(normalizeName(candidates[i].name)) }
        : null,
    )
    .filter((p): p is ResolvedPlace => p !== null);

  // 필수 방문지를 앞에 둬야 dedupe에서 살아남는다.
  return dedupe([...resolved.filter((p) => p.mustVisit), ...resolved.filter((p) => !p.mustVisit)]);
}

async function pickMeals(
  resolver: PlaceResolver,
  slots: readonly MealSlot[],
  used: Set<string>,
  excluded: Set<string>,
): Promise<Map<MealType, ResolvedPlace>> {
  const out = new Map<MealType, ResolvedPlace>();
  const results = await Promise.allSettled(
    slots.map((s) =>
      resolver.searchNearby(
        s.near.lat, s.near.lng,
        s.mealType === "아침" ? "CE7" : "FD6",
        MEAL_RADIUS_M,
      ),
    ),
  );
  logRejections("식당 조회", results);
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const pick = r.value.find(
      (p) => !used.has(p.id) && !excluded.has(normalizeName(p.name)),
    );
    if (!pick) return;
    used.add(pick.id);
    out.set(slots[i].mealType, pick);
  });
  return out;
}

export async function generateItinerary(
  deps: PipelineDeps,
  request: PlanRequest,
): Promise<{ planContent: PlanDay[]; narrationDegraded: boolean }> {
  const mustNames = request.mustVisitPlaces.split(",").map((s) => s.trim()).filter(Boolean);
  const mustSet = new Set(mustNames.map(normalizeName));
  // 사용자가 이름을 찍어 요청한 곳은 제외 지시보다 우선한다.
  const excluded = new Set(
    (request.excludeNames ?? []).map(normalizeName).filter((n) => !mustSet.has(n)),
  );

  const candidates = await deps.fetchCandidates(request);
  const places = (await resolveAll(deps.resolver, candidates, request.destination, mustNames))
    .filter((p) => !excluded.has(normalizeName(p.name)));

  // 모델이 필수 방문지를 빠뜨릴 수 있다. 프롬프트로 부탁하는 대신 직접 확인해 채운다.
  const present = new Set(places.map((p) => normalizeName(p.name)));
  const missing = mustNames.filter((n) => !present.has(normalizeName(n)));
  if (missing.length > 0) {
    const recovered = await Promise.allSettled(
      missing.map((n) => deps.resolver.resolve(n, request.destination)),
    );
    // 이름은 다른 필수 방문지 두 개가 같은 카카오 POI로 풀리기도 한다. id로 한 번 더 거른다.
    const knownIds = new Set(places.map((p) => p.id));
    const found: ResolvedPlace[] = [];
    for (const r of recovered) {
      if (r.status !== "fulfilled" || !r.value) continue;
      if (knownIds.has(r.value.id)) continue;
      knownIds.add(r.value.id);
      found.push({ ...r.value, mustVisit: true });
    }
    if (found.length > 0) places.unshift(...found);
  }

  const { min } = INTENSITY_RANGE[request.intensity];
  if (places.length < request.days * min) {
    throw new Error(`검증된 장소가 ${places.length}곳뿐입니다. 최소 ${request.days * min}곳이 필요합니다.`);
  }

  // 한 여행 안에서 같은 장소를 두 번 쓰지 않기 위한 전역 집합. 식당 선택도 여기를 본다.
  const usedIds = new Set(places.map((p) => p.id));

  let assigned = fillToMinimum(assignToDays(places, request.days, request.intensity), min);

  // leftover로도 하한을 못 채운 권역은 그 중심 주변에서 관광명소를 긁어 보충한다.
  // 거리순 정렬이라 매력도가 반영되지 않으므로 마지막 수단이다.
  const shortIdx = assigned.buckets
    .map((b, i) => (b.length < min ? i : -1))
    .filter((i) => i >= 0);
  if (shortIdx.length > 0) {
    const rescued = await Promise.allSettled(
      shortIdx.map((i) =>
        deps.resolver.searchNearby(assigned.centers[i].lat, assigned.centers[i].lng, "AT4", 5000),
      ),
    );
    logRejections("AT4 구제 조회", rescued);
    const rescuedPlaces = rescued
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((p) => !usedIds.has(p.id) && !excluded.has(normalizeName(p.name)));
    // AT4는 이미 배정된 명소의 부속 POI(다른 id, 같은 이름 또는 수 미터 거리)를 흔히 돌려준다.
    // 확정 목록과 함께 dedupe해야 걸린다. dedupe는 앞선 원소를 남기므로 places가 밀려나지 않는다.
    // 필수 방문지 복구분은 id로만 걸러 넣으므로 places 안에도 이름 중복이 남아 있을 수 있다.
    // slice(places.length) 대신 id로 잘라내야 그런 날에도 extras가 어긋나지 않는다.
    const confirmedIds = new Set(places.map((p) => p.id));
    const merged = dedupe([...places, ...rescuedPlaces]);
    const extras = merged.filter((p) => !confirmedIds.has(p.id));
    // 구제로 들어온 장소도 집합에 넣어야 뒤에서 식당으로 다시 뽑히지 않는다.
    extras.forEach((p) => usedIds.add(p.id));
    assigned = fillToMinimum({ ...assigned, leftover: [...assigned.leftover, ...extras] }, min);
  }

  const dayOrder = orderDays(assigned.centers);

  const scheduled: ScheduledDay[] = [];
  let previousTail: Coord | null = null;

  for (const [index, clusterIdx] of dayOrder.entries()) {
    const ordered = orderWithinDay(assigned.buckets[clusterIdx], previousTail);
    previousTail = ordered.length > 0 ? ordered[ordered.length - 1] : null;

    const layout = layoutDay(ordered, request.transportMode, request.intensity);
    const meals = await pickMeals(deps.resolver, layout.mealSlots, usedIds, excluded);
    scheduled.push({ day: index + 1, activities: insertMeals(layout, meals) });
  }

  const narrations = await Promise.allSettled(
    scheduled.map((d) => deps.narrateDay(d, request.destination)),
  );

  let degraded = false;
  const planContent = scheduled.map((day, i) => {
    const n = narrations[i];
    const ok = n.status === "fulfilled" && n.value.activities.length === day.activities.length;
    if (!ok) degraded = true;
    const narration = ok ? n.value : minimalNarration(day, request.destination);

    return {
      day: day.day,
      theme: narration.theme,
      description: narration.description,
      activities: day.activities.map((a, j) => ({
        time: formatTime(a.startMinutes),
        title: a.place.name,
        description: narration.activities[j].description,
        location: a.place.address,
        category: a.place.category,
        isMeal: a.isMeal,
        mealType: a.mealType ?? "",
        mustVisit: a.place.mustVisit,
        latitude: a.place.lat,
        longitude: a.place.lng,
        tags: narration.activities[j].tags,
        placeUrl: a.place.placeUrl,
      })),
    };
  });

  return { planContent, narrationDegraded: degraded };
}
