# 일정 생성 파이프라인 구현 계획

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: LLM이 후보만 내고 코드가 중복·동선·시간을 확정하는 일정 생성 파이프라인으로 교체한다.

Architecture: 4단계 파이프라인. LLM이 장소 이름만 뽑고(1), 카카오 로컬이 실존을 검증하고(2), 순수 함수가 중복 제거·권역 배정·동선 정렬·시간 배치를 확정하고(3), LLM이 날짜별 병렬로 설명만 쓴다(4). 검증 가능한 제약은 프롬프트가 아니라 코드가 강제한다. 가짜 일정 폴백은 제거한다.

Tech Stack: TypeScript, Node/Express(`server/server.ts`), Netlify Functions, `@google/genai`(Gemini 2.5 Flash), 카카오 로컬 REST API, vitest.

Spec: `docs/superpowers/specs/2026-08-15-itinerary-generation-design.md`

## Global Constraints

- 응답 시간 30초 이내. 단계 예산: 1단계 8초, 2단계 3초, 4단계 10초, 5단계 3초
- 강도 범위: 여유롭게 `{min:1, max:3}`, 빡빡하게 `{min:4, max:8}` (식사 3개 제외)
- 이동 속도: 도보 4km/h, 대중교통 20km/h, 자차 40km/h. 우회계수 1.3. 최소 10분
- 체류시간: 자연·액티비티 120분, 관광·문화·쇼핑 90분, 카페·맛집 60분. 식사는 아침 45 / 점심 60 / 저녁 90
- 시각 상수(자정 기준 분): 아침 480, 일반 시작 540, 점심 690~810, 일반 종료 상한 1080, 저녁 1080~1170
- 중복 판정: 정규화 이름 일치 또는 haversine 50m 이내
- 결정론 필수. `Math.random()`, `Date.now()`를 순수 모듈에서 쓰지 않는다
- 환경변수 `KAKAO_REST_API_KEY` (서버 전용, `VITE_` 접두사 없음)
- 커밋 메시지 타입: feat, fix, refactor, docs, test, chore

## 파일 구조

| 경로 | 책임 |
|---|---|
| `server/itinerary/types.ts` | 공용 타입과 상수 |
| `server/itinerary/geo.ts` | haversine, 이동시간, 체류시간 (순수) |
| `server/itinerary/routing.ts` | 중복 제거, 권역 배정, 동선 정렬 (순수) |
| `server/itinerary/schedule.ts` | 시간 배정, 식사 슬롯, 하루 길이 컷 (순수) |
| `server/itinerary/candidates.ts` | 1단계 LLM 호출 |
| `server/itinerary/narrate.ts` | 4단계 LLM 호출 |
| `server/itinerary/pipeline.ts` | 오케스트레이션 |
| `server/itinerary/runner.ts` | 실제 의존성 주입과 단계별 타임아웃 |
| `server/itinerary/revise.ts` | 수정 요청을 재생성 요청으로 변환 |
| `server/places/resolver.ts` | `PlaceResolver` 인터페이스 |
| `server/places/kakao.ts` | 카카오 로컬 구현 |
| `server/places/photos.ts` | Google Places 사진 (두 진입점 공유) |
| `server/server.ts` | 얇은 라우터로 축소 |
| `netlify/functions/generate-plan.ts` | 얇은 핸들러로 축소 |

---

### Task 1: 타입과 지리 계산

Files:
- Create: `server/itinerary/types.ts`, `server/itinerary/geo.ts`
- Modify: `tsconfig.server.json`
- Test: `tests/itinerary/geo.test.ts`

Interfaces:
- Consumes: 없음
- Produces: `PlaceCategory`, `MealType`, `TransportMode`, `Intensity`, `Coord`, `Candidate`, `ResolvedPlace`, `ScheduledActivity`, `ScheduledDay`, `INTENSITY_RANGE`, `haversineKm(a,b)`, `travelMinutes(a,b,mode)`, `stayMinutes(category)`

- [ ] Step 1: 타입 파일 작성

`server/itinerary/types.ts`

```ts
export type PlaceCategory = "관광" | "자연" | "문화" | "쇼핑" | "맛집" | "카페" | "액티비티";
export type MealType = "아침" | "점심" | "저녁";
export type TransportMode = "도보" | "대중교통" | "자차";
export type Intensity = "여유롭게" | "빡빡하게";

export type Coord = { lat: number; lng: number };

export type Candidate = { name: string; category: PlaceCategory };

export type ResolvedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  address: string;
  placeUrl?: string;
  mustVisit: boolean;
};

export type ScheduledActivity = {
  place: ResolvedPlace;
  startMinutes: number;
  stayMinutes: number;
  travelFromPrevMinutes: number;
  isMeal: boolean;
  mealType?: MealType;
};

export type ScheduledDay = { day: number; activities: ScheduledActivity[] };

// 식사 3개를 제외한 하루 일반 활동 개수 범위
export const INTENSITY_RANGE: Record<Intensity, { min: number; max: number }> = {
  여유롭게: { min: 1, max: 3 },
  빡빡하게: { min: 4, max: 8 },
};
```

- [ ] Step 2: 실패하는 테스트 작성

`tests/itinerary/geo.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { haversineKm, travelMinutes, stayMinutes } from "../../server/itinerary/geo";

const 서울시청 = { lat: 37.5666, lng: 126.9784 };
const 부산시청 = { lat: 35.1798, lng: 129.075 };
const 성산일출봉 = { lat: 33.45913, lng: 126.94054 };
const 성산주차장 = { lat: 33.46136, lng: 126.93494 };

describe("haversineKm", () => {
  it("서울시청-부산시청 직선거리를 오차 1% 안에서 계산한다", () => {
    const result = haversineKm(서울시청, 부산시청);
    expect(result).toBeGreaterThan(322);
    expect(result).toBeLessThan(329);
  });

  it("같은 좌표는 0을 반환한다", () => {
    expect(haversineKm(서울시청, 서울시청)).toBe(0);
  });
});

describe("travelMinutes", () => {
  it("가까운 거리라도 최소 10분을 보장한다", () => {
    expect(travelMinutes(성산일출봉, 성산주차장, "자차")).toBe(10);
  });

  it("도보가 자차보다 오래 걸린다", () => {
    expect(travelMinutes(서울시청, 부산시청, "도보")).toBeGreaterThan(
      travelMinutes(서울시청, 부산시청, "자차"),
    );
  });
});

describe("stayMinutes", () => {
  it("자연은 관광보다 오래 머문다", () => {
    expect(stayMinutes("자연")).toBe(120);
    expect(stayMinutes("관광")).toBe(90);
  });
});
```

- [ ] Step 3: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/geo.test.ts`
Expected: FAIL — `Failed to resolve import "../../server/itinerary/geo"`

- [ ] Step 4: 구현

`server/itinerary/geo.ts`

```ts
import type { Coord, PlaceCategory, TransportMode } from "./types";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 직선거리는 실제 이동보다 짧다. 도로 우회를 보정한다.
const DETOUR_FACTOR = 1.3;
const SPEED_KMH: Record<TransportMode, number> = { 도보: 4, 대중교통: 20, 자차: 40 };
const MIN_TRAVEL_MINUTES = 10;

export function travelMinutes(a: Coord, b: Coord, mode: TransportMode): number {
  const km = haversineKm(a, b) * DETOUR_FACTOR;
  return Math.max(MIN_TRAVEL_MINUTES, Math.round((km / SPEED_KMH[mode]) * 60));
}

const STAY_MINUTES: Record<PlaceCategory, number> = {
  자연: 120, 액티비티: 120, 관광: 90, 문화: 90, 쇼핑: 90, 카페: 60, 맛집: 60,
};

export function stayMinutes(category: PlaceCategory): number {
  return STAY_MINUTES[category] ?? 60;
}
```

- [ ] Step 5: tsconfig에 새 폴더 포함

`tsconfig.server.json`의 `include`를 `["server/**/*.ts", "vite.config.ts"]`로 바꾼다.

- [ ] Step 6: 통과 확인

Run: `npx vitest run tests/itinerary/geo.test.ts && npx tsc --noEmit -p tsconfig.server.json`
Expected: 6 passed, 타입 오류 없음

- [ ] Step 7: 커밋

```bash
git add server/itinerary/types.ts server/itinerary/geo.ts tests/itinerary/geo.test.ts tsconfig.server.json
git commit -m "feat: 일정 파이프라인 공용 타입과 지리 계산 모듈 추가"
```

---

### Task 2: 중복 제거와 권역 배정

Files:
- Create: `server/itinerary/routing.ts`
- Test: `tests/itinerary/routing.test.ts`

Interfaces:
- Consumes: `haversineKm`, `ResolvedPlace`, `Intensity`, `INTENSITY_RANGE`, `Coord`
- Produces: `normalizeName(name)`, `dedupe(places)`, `DayAssignment`, `assignToDays(places, days, intensity)`, `fillToMinimum(assignment, min)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/routing.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { dedupe, assignToDays, fillToMinimum } from "../../server/itinerary/routing";
import type { ResolvedPlace } from "../../server/itinerary/types";

const place = (id: string, name: string, lat: number, lng: number, mustVisit = false): ResolvedPlace => ({
  id, name, lat, lng, category: "관광", address: `${name} 주소`, mustVisit,
});

// 제주 동부 3곳 / 서부 3곳 — 권역이 뚜렷하게 갈린다
const 동부 = [
  place("1", "성산일출봉", 33.4591, 126.9405),
  place("2", "섭지코지", 33.4239, 126.9308),
  place("3", "광치기해변", 33.4479, 126.9268),
];
const 서부 = [
  place("4", "협재해수욕장", 33.3939, 126.2396),
  place("5", "한림공원", 33.3878, 126.24),
  place("6", "금능해변", 33.3892, 126.2333),
];
const many = Array.from({ length: 20 }, (_, i) =>
  place(`p${i}`, `장소${i}`, 33.4 + i * 0.01, 126.5 + i * 0.01));

describe("dedupe", () => {
  it("이름이 같은 장소를 하나만 남긴다", () => {
    const result = dedupe([place("1", "성산일출봉", 33.4591, 126.9405), place("9", "성산 일출봉", 33.99, 126.99)]);
    expect(result).toHaveLength(1);
  });

  it("50m 이내면 이름이 달라도 같은 장소로 본다", () => {
    const result = dedupe([place("1", "성산일출봉", 33.4591, 126.9405), place("2", "성산일출봉 매표소", 33.45914, 126.94055)]);
    expect(result).toHaveLength(1);
  });

  it("떨어진 서로 다른 장소는 모두 남긴다", () => {
    expect(dedupe([...동부, ...서부])).toHaveLength(6);
  });
});

describe("assignToDays", () => {
  it("같은 장소가 서로 다른 두 날짜에 배정되지 않는다", () => {
    const ids = assignToDays([...동부, ...서부], 2, "빡빡하게").buckets.flat().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("지리적으로 가까운 장소끼리 같은 날에 묶인다", () => {
    const { buckets } = assignToDays([...동부, ...서부], 2, "빡빡하게");
    const 동부날 = buckets.find((b) => b.some((p) => p.id === "1"));
    expect(동부날!.map((p) => p.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("클러스터당 활동 수가 강도 상한을 넘지 않는다", () => {
    assignToDays(many, 2, "여유롭게").buckets.forEach((b) => expect(b.length).toBeLessThanOrEqual(3));
  });

  it("정원을 넘는 후보는 leftover로 빠지고 사라지지 않는다", () => {
    const { buckets, leftover } = assignToDays(many, 2, "여유롭게");
    expect(buckets.flat().length + leftover.length).toBe(20);
  });

  it("필수 방문지는 반드시 배정된다", () => {
    const must = place("must", "성산일출봉", 33.4591, 126.9405, true);
    const { buckets } = assignToDays([...many, must], 2, "여유롭게");
    expect(buckets.flat().some((p) => p.id === "must")).toBe(true);
  });

  it("같은 입력에 같은 출력을 낸다", () => {
    expect(assignToDays([...동부, ...서부], 2, "빡빡하게").buckets)
      .toEqual(assignToDays([...동부, ...서부], 2, "빡빡하게").buckets);
  });

  it("후보가 필요량보다 적어도 중복으로 채우지 않는다", () => {
    // 회귀 테스트 — 기존 createFallbackPlan은 3개 목록에서 6개를 뽑아 같은 장소를 두 번 넣었다
    const names = assignToDays(동부, 3, "빡빡하게").buckets.flat().map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(3);
  });
});

describe("fillToMinimum", () => {
  it("하한 미달 클러스터를 leftover에서 가장 가까운 것으로 채운다", () => {
    const before = assignToDays(many, 4, "여유롭게");
    const after = fillToMinimum(before, 3);
    expect(after.buckets.flat().length).toBeGreaterThanOrEqual(before.buckets.flat().length);
    after.buckets.forEach((b) => expect(b.length).toBeGreaterThanOrEqual(3));
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/routing.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] Step 3: 구현

`server/itinerary/routing.ts`

```ts
import { haversineKm } from "./geo";
import { INTENSITY_RANGE } from "./types";
import type { Coord, Intensity, ResolvedPlace } from "./types";

const DUPLICATE_METERS = 50;

export function normalizeName(name: string): string {
  return name.replace(/[\s\W_]/gu, "").toLowerCase();
}

/** 앞에 온 것을 남긴다. 필수 방문지를 먼저 넣어야 살아남는다. */
export function dedupe(places: readonly ResolvedPlace[]): ResolvedPlace[] {
  const kept: ResolvedPlace[] = [];
  for (const p of places) {
    const isDup = kept.some(
      (k) =>
        normalizeName(k.name) === normalizeName(p.name) ||
        haversineKm(k, p) * 1000 <= DUPLICATE_METERS,
    );
    if (!isDup) kept.push(p);
  }
  return kept;
}

export type DayAssignment = {
  buckets: ResolvedPlace[][];
  centers: Coord[];
  leftover: ResolvedPlace[];
};

// 난수를 쓰지 않는다. 같은 입력에 같은 출력이 나와야 테스트가 재현된다.
function farthestPointSeeds(places: readonly ResolvedPlace[], k: number): Coord[] {
  const seeds: Coord[] = [{ lat: places[0].lat, lng: places[0].lng }];
  while (seeds.length < k) {
    let best = places[0];
    let bestDist = -1;
    for (const p of places) {
      const d = Math.min(...seeds.map((s) => haversineKm(s, p)));
      if (d > bestDist) {
        bestDist = d;
        best = p;
      }
    }
    seeds.push({ lat: best.lat, lng: best.lng });
  }
  return seeds;
}

function assignOnce(
  places: readonly ResolvedPlace[],
  centers: readonly Coord[],
  capacity: number,
): number[] {
  const load = new Array(centers.length).fill(0);
  const result = new Array(places.length).fill(-1);

  // 필수 방문지를 먼저 꽂는다. 그다음은 중심에 가까워 확신이 큰 것부터 자리를 잡아야
  // 뒤에 오는 점이 엉뚱한 클러스터로 밀려나지 않는다.
  const order = places
    .map((p, i) => ({ i, must: p.mustVisit, d: Math.min(...centers.map((c) => haversineKm(c, p))) }))
    .sort((a, b) => Number(b.must) - Number(a.must) || a.d - b.d);

  for (const { i } of order) {
    const ranked = centers
      .map((c, ci) => ({ ci, d: haversineKm(c, places[i]) }))
      .sort((a, b) => a.d - b.d);
    const target = ranked.find((r) => load[r.ci] < capacity);
    if (!target) continue; // 정원 초과분은 leftover로 남긴다
    result[i] = target.ci;
    load[target.ci] += 1;
  }
  return result;
}

function recenter(
  places: readonly ResolvedPlace[],
  assignment: readonly number[],
  prev: readonly Coord[],
): Coord[] {
  const sums = prev.map(() => ({ lat: 0, lng: 0, n: 0 }));
  assignment.forEach((ci, i) => {
    if (ci < 0) return;
    sums[ci].lat += places[i].lat;
    sums[ci].lng += places[i].lng;
    sums[ci].n += 1;
  });
  return sums.map((s, ci) => (s.n === 0 ? prev[ci] : { lat: s.lat / s.n, lng: s.lng / s.n }));
}

export function assignToDays(
  places: readonly ResolvedPlace[],
  days: number,
  intensity: Intensity,
): DayAssignment {
  if (places.length === 0) {
    return {
      buckets: Array.from({ length: days }, () => []),
      centers: Array.from({ length: days }, () => ({ lat: 0, lng: 0 })),
      leftover: [],
    };
  }

  const capacity = INTENSITY_RANGE[intensity].max;
  let centers = farthestPointSeeds(places, Math.min(days, places.length));
  while (centers.length < days) centers.push({ ...centers[centers.length - 1] });

  let assignment: number[] = [];
  for (let iter = 0; iter < 20; iter += 1) {
    const next = assignOnce(places, centers, capacity);
    const same = next.length === assignment.length && next.every((v, i) => v === assignment[i]);
    assignment = next;
    centers = recenter(places, assignment, centers);
    if (same) break;
  }

  const buckets: ResolvedPlace[][] = Array.from({ length: days }, () => []);
  const leftover: ResolvedPlace[] = [];
  assignment.forEach((ci, i) => (ci < 0 ? leftover.push(places[i]) : buckets[ci].push(places[i])));
  return { buckets, centers, leftover };
}

/** 하한에 못 미치는 클러스터를 leftover 중 중심에 가장 가까운 것으로 채운다. */
export function fillToMinimum(assignment: DayAssignment, min: number): DayAssignment {
  const buckets = assignment.buckets.map((b) => [...b]);
  const pool = [...assignment.leftover];

  buckets.forEach((bucket, ci) => {
    while (bucket.length < min && pool.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      pool.forEach((p, i) => {
        const d = haversineKm(assignment.centers[ci], p);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      bucket.push(pool.splice(bestIdx, 1)[0]);
    }
  });

  return { buckets, centers: assignment.centers, leftover: pool };
}
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run tests/itinerary/routing.test.ts`
Expected: 10 passed

- [ ] Step 5: 커밋

```bash
git add server/itinerary/routing.ts tests/itinerary/routing.test.ts
git commit -m "feat: 장소 중복 제거와 날짜별 권역 배정 추가"
```

---

### Task 3: 동선 정렬

Files:
- Modify: `server/itinerary/routing.ts` (파일 끝에 추가)
- Test: `tests/itinerary/ordering.test.ts`

Interfaces:
- Consumes: `haversineKm`, `Coord`, `ResolvedPlace`
- Produces: `totalPathKm(points, from)`, `orderWithinDay(places, from)`, `orderDays(centers)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/ordering.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { orderWithinDay, orderDays, totalPathKm } from "../../server/itinerary/routing";
import type { ResolvedPlace } from "../../server/itinerary/types";

const place = (id: string, lat: number, lng: number): ResolvedPlace => ({
  id, name: `장소${id}`, lat, lng, category: "관광", address: "주소", mustVisit: false,
});

// 일부러 뒤섞은 일직선 배치
const 뒤섞인직선 = [
  place("c", 33.5, 126.5), place("a", 33.1, 126.1), place("d", 33.7, 126.7), place("b", 33.3, 126.3),
];

// 난수 대신 결정적 셔플. 테스트가 매번 같아야 한다.
function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("orderWithinDay", () => {
  it("일직선 배치를 순서대로 정렬한다", () => {
    expect(orderWithinDay(뒤섞인직선, null).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("총 이동거리가 무작위 순열 100회보다 항상 짧거나 같다", () => {
    const best = totalPathKm(orderWithinDay(뒤섞인직선, null), null);
    for (let seed = 1; seed <= 100; seed += 1) {
      expect(best).toBeLessThanOrEqual(totalPathKm(shuffleDeterministic(뒤섞인직선, seed), null) + 1e-9);
    }
  });

  it("시작점이 주어지면 그 지점에서 가까운 곳부터 돈다", () => {
    expect(orderWithinDay(뒤섞인직선, { lat: 33.75, lng: 126.75 })[0].id).toBe("d");
  });

  it("9개 이상이면 근사 정렬로 넘어가되 예외를 던지지 않는다", () => {
    const many = Array.from({ length: 12 }, (_, i) => place(`p${i}`, 33 + i * 0.1, 126 + i * 0.1));
    expect(() => orderWithinDay(many, null)).not.toThrow();
    expect(orderWithinDay(many, null)).toHaveLength(12);
  });
});

describe("orderDays", () => {
  it("권역 중심을 최단 순회 순서로 돌려준다", () => {
    const centers = [{ lat: 33.5, lng: 126.5 }, { lat: 33.1, lng: 126.1 }, { lat: 33.3, lng: 126.3 }];
    expect(orderDays(centers)).toEqual([1, 2, 0]);
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/ordering.test.ts`
Expected: FAIL — `orderWithinDay is not a function`

- [ ] Step 3: 구현 — `server/itinerary/routing.ts` 끝에 덧붙인다

```ts
const BRUTE_FORCE_LIMIT = 8;

export function totalPathKm(points: readonly Coord[], from: Coord | null): number {
  if (points.length === 0) return 0;
  let cost = from ? haversineKm(from, points[0]) : 0;
  for (let i = 1; i < points.length; i += 1) cost += haversineKm(points[i - 1], points[i]);
  return cost;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    permutations(rest).forEach((perm) => out.push([item, ...perm]));
  });
  return out;
}

function nearestNeighbour<T extends Coord>(points: readonly T[], from: Coord | null): T[] {
  const pool = [...points];
  const out: T[] = [];
  let cursor: Coord | null = from;
  while (pool.length > 0) {
    let bestIdx = 0;
    if (cursor) {
      let bestDist = Infinity;
      const c = cursor;
      pool.forEach((p, i) => {
        const d = haversineKm(c, p);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
    }
    const picked = pool.splice(bestIdx, 1)[0];
    out.push(picked);
    cursor = picked;
  }
  return out;
}

function shortestOrder<T extends Coord>(points: readonly T[], from: Coord | null): T[] {
  if (points.length <= 2) return [...points];
  if (points.length > BRUTE_FORCE_LIMIT) return nearestNeighbour(points, from);

  let best = [...points];
  let bestCost = Infinity;
  for (const perm of permutations(points)) {
    const cost = totalPathKm(perm, from);
    if (cost < bestCost) {
      bestCost = cost;
      best = perm;
    }
  }
  return best;
}

/** 클러스터 정원이 8이라 완전탐색이 가능하다. 초과 시에만 근사로 내려간다. */
export function orderWithinDay(
  places: readonly ResolvedPlace[],
  from: Coord | null,
): ResolvedPlace[] {
  return shortestOrder(places, from);
}

/** 권역 중심들의 방문 순서. 반환값은 centers 배열의 인덱스다. */
export function orderDays(centers: readonly Coord[]): number[] {
  const indexed = centers.map((c, i) => ({ ...c, idx: i }));
  return shortestOrder(indexed, null).map((c) => c.idx);
}
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run tests/itinerary/`
Expected: 전체 통과

- [ ] Step 5: 커밋

```bash
git add server/itinerary/routing.ts tests/itinerary/ordering.test.ts
git commit -m "feat: 권역 순서와 하루 내 동선 최단 정렬 추가"
```

---

### Task 4: 시간 배정과 식사 슬롯

Files:
- Create: `server/itinerary/schedule.ts`
- Test: `tests/itinerary/schedule.test.ts`

식사 장소는 위치와 시각이 정해진 뒤에야 검색할 수 있다. 순수성을 지키려고 2단계로 나눈다. `layoutDay`가 슬롯의 위치·시각만 계산하고, 파이프라인이 실제 식당을 조회한 뒤 `insertMeals`가 끼워 넣는다.

Interfaces:
- Consumes: `travelMinutes`, `stayMinutes`, `INTENSITY_RANGE`, `ResolvedPlace`, `ScheduledActivity`, `TransportMode`, `Intensity`, `MealType`, `Coord`
- Produces: `formatTime(minutes)`, `MealSlot`, `DayLayout`, `layoutDay(places, mode, intensity)`, `insertMeals(layout, meals)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/schedule.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { layoutDay, insertMeals, formatTime } from "../../server/itinerary/schedule";
import type { MealType, PlaceCategory, ResolvedPlace } from "../../server/itinerary/types";

const place = (id: string, lat: number, lng: number, category: PlaceCategory = "관광"): ResolvedPlace => ({
  id, name: `장소${id}`, lat, lng, category, address: "주소", mustVisit: false,
});

const 근접4곳 = [
  place("a", 33.45, 126.94), place("b", 33.46, 126.93),
  place("c", 33.47, 126.92), place("d", 33.48, 126.91),
];
const 멀리떨어진8곳 = Array.from({ length: 8 }, (_, i) =>
  place(`p${i}`, 33.2 + i * 0.25, 126.2 + i * 0.25, "자연"));

const 식당 = (t: MealType) => place(`meal-${t}`, 33.45, 126.94, "맛집");
const 식사맵 = new Map<MealType, ResolvedPlace>([
  ["아침", 식당("아침")], ["점심", 식당("점심")], ["저녁", 식당("저녁")],
]);

describe("formatTime", () => {
  it("오전·오후를 구분하고 5분 단위로 반올림한다", () => {
    expect(formatTime(540)).toBe("오전 09:00");
    expect(formatTime(753)).toBe("오후 12:35");
    expect(formatTime(1170)).toBe("오후 07:30");
  });
});

describe("layoutDay", () => {
  it("아침·점심·저녁 슬롯을 정확히 하나씩 만든다", () => {
    const types = layoutDay(근접4곳, "자차", "빡빡하게").mealSlots.map((s) => s.mealType);
    expect([...types].sort()).toEqual(["아침", "저녁", "점심"].sort());
  });

  it("점심 슬롯이 11:30~13:30 안에 든다", () => {
    const slot = layoutDay(근접4곳, "자차", "빡빡하게").mealSlots.find((s) => s.mealType === "점심")!;
    expect(slot.atMinutes).toBeGreaterThanOrEqual(690);
    expect(slot.atMinutes).toBeLessThanOrEqual(810);
  });

  it("저녁 슬롯이 18:00~19:30 안에 든다", () => {
    const slot = layoutDay(근접4곳, "자차", "빡빡하게").mealSlots.find((s) => s.mealType === "저녁")!;
    expect(slot.atMinutes).toBeGreaterThanOrEqual(1080);
    expect(slot.atMinutes).toBeLessThanOrEqual(1170);
  });

  it("하루가 18시를 넘기면 뒤쪽 활동을 잘라낸다", () => {
    const layout = layoutDay(멀리떨어진8곳, "대중교통", "빡빡하게");
    const last = layout.activities[layout.activities.length - 1];
    expect(last.startMinutes + last.stayMinutes).toBeLessThanOrEqual(1080);
    expect(layout.activities.length).toBeLessThan(8);
  });

  it("잘라내더라도 강도 하한 아래로는 줄이지 않는다", () => {
    expect(layoutDay(멀리떨어진8곳, "대중교통", "빡빡하게").activities.length).toBeGreaterThanOrEqual(4);
  });
});

describe("insertMeals", () => {
  it("식사 3개를 포함한 활동이 시간순으로 단조 증가한다", () => {
    const acts = insertMeals(layoutDay(근접4곳, "자차", "빡빡하게"), 식사맵);
    expect(acts.filter((a) => a.isMeal)).toHaveLength(3);
    for (let i = 1; i < acts.length; i += 1) {
      expect(acts[i].startMinutes).toBeGreaterThanOrEqual(acts[i - 1].startMinutes);
    }
  });

  it("조회에 실패한 식사는 건너뛰고 나머지는 유지한다", () => {
    const 일부만 = new Map<MealType, ResolvedPlace>([["점심", 식당("점심")]]);
    expect(insertMeals(layoutDay(근접4곳, "자차", "빡빡하게"), 일부만).filter((a) => a.isMeal)).toHaveLength(1);
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/schedule.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 구현

`server/itinerary/schedule.ts`

```ts
import { stayMinutes, travelMinutes } from "./geo";
import { INTENSITY_RANGE } from "./types";
import type {
  Coord, Intensity, MealType, ResolvedPlace, ScheduledActivity, TransportMode,
} from "./types";

const BREAKFAST_AT = 480;       // 08:00
const DAY_START = 540;          // 09:00 첫 일반 활동
const LUNCH_MIN = 690;          // 11:30
const LUNCH_TRIGGER = 720;      // 12:00
const LUNCH_MAX = 810;          // 13:30
const GENERAL_END_LIMIT = 1080; // 18:00 — 일반 활동은 여기까지 끝낸다
const DINNER_MAX = 1170;        // 19:30

const MEAL_STAY: Record<MealType, number> = { 아침: 45, 점심: 60, 저녁: 90 };

export function formatTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  const h24 = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  const period = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${period} ${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type MealSlot = { mealType: MealType; near: Coord; atMinutes: number };
export type DayLayout = { activities: ScheduledActivity[]; mealSlots: MealSlot[] };

function walk(places: readonly ResolvedPlace[], mode: TransportMode): ScheduledActivity[] {
  const out: ScheduledActivity[] = [];
  let cursor = DAY_START;
  places.forEach((place, i) => {
    const travel = i === 0 ? 0 : travelMinutes(places[i - 1], place, mode);
    cursor += travel;
    const stay = stayMinutes(place.category);
    out.push({ place, startMinutes: cursor, stayMinutes: stay, travelFromPrevMinutes: travel, isMeal: false });
    cursor += stay;
  });
  return out;
}

/**
 * 권역 배정은 클러스터를 정원까지 채우므로 그대로 두면 매일 상한 개수가 된다.
 * 하루가 18시를 넘기면 뒤에서부터 덜어내 이동이 먼 날은 자연히 적어지게 한다.
 * 제거한 장소는 폐기한다. 다른 날로 옮기면 그 날의 동선이 깨진다.
 */
export function layoutDay(
  places: readonly ResolvedPlace[],
  mode: TransportMode,
  intensity: Intensity,
): DayLayout {
  const min = INTENSITY_RANGE[intensity].min;
  let kept = [...places];
  let activities = walk(kept, mode);

  while (kept.length > min && activities.length > 0) {
    const last = activities[activities.length - 1];
    if (last.startMinutes + last.stayMinutes <= GENERAL_END_LIMIT) break;
    kept = kept.slice(0, -1);
    activities = walk(kept, mode);
  }

  const mealSlots: MealSlot[] = [];
  if (activities.length > 0) {
    mealSlots.push({ mealType: "아침", near: activities[0].place, atMinutes: BREAKFAST_AT });

    const triggerIdx = activities.findIndex((a) => a.startMinutes >= LUNCH_TRIGGER);
    const anchor = activities[Math.max(0, (triggerIdx === -1 ? activities.length : triggerIdx) - 1)];
    const rawLunch = anchor.startMinutes + anchor.stayMinutes;
    mealSlots.push({
      mealType: "점심",
      near: anchor.place,
      atMinutes: Math.min(LUNCH_MAX, Math.max(LUNCH_MIN, rawLunch)),
    });

    const tail = activities[activities.length - 1];
    const rawDinner = tail.startMinutes + tail.stayMinutes + 15;
    mealSlots.push({
      mealType: "저녁",
      near: tail.place,
      atMinutes: Math.min(DINNER_MAX, Math.max(GENERAL_END_LIMIT, rawDinner)),
    });
  }

  return { activities, mealSlots };
}

export function insertMeals(
  layout: DayLayout,
  meals: ReadonlyMap<MealType, ResolvedPlace>,
): ScheduledActivity[] {
  const mealActivities = layout.mealSlots
    .map((slot): ScheduledActivity | null => {
      const place = meals.get(slot.mealType);
      if (!place) return null;
      return {
        place,
        startMinutes: slot.atMinutes,
        stayMinutes: MEAL_STAY[slot.mealType],
        travelFromPrevMinutes: 0,
        isMeal: true,
        mealType: slot.mealType,
      };
    })
    .filter((a): a is ScheduledActivity => a !== null);

  return [...layout.activities, ...mealActivities].sort((a, b) => a.startMinutes - b.startMinutes);
}
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run tests/itinerary/`
Expected: 전체 통과

- [ ] Step 5: 커밋

```bash
git add server/itinerary/schedule.ts tests/itinerary/schedule.test.ts
git commit -m "feat: 하루 시간 배정과 식사 슬롯 계산 추가"
```

---

### Task 5: 카카오 로컬 어댑터

Files:
- Create: `server/places/resolver.ts`, `server/places/kakao.ts`
- Modify: `.env.example`
- Test: `tests/places/kakao.test.ts`

Interfaces:
- Consumes: `ResolvedPlace`, `PlaceCategory`
- Produces: `PlaceResolver`, `KakaoCategoryCode`, `isGenericName(name)`, `matchesRequest(requested, returned)`, `mapCategory(code, categoryName)`, `createKakaoResolver(apiKey, fetchImpl?)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/places/kakao.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createKakaoResolver, isGenericName, matchesRequest, mapCategory } from "../../server/places/kakao";

const 성산일출봉응답 = {
  documents: [{
    id: "10332413", place_name: "성산일출봉", category_group_code: "",
    category_name: "여행 > 관광,명소 > 자연명소 > 산",
    x: "126.94054", y: "33.45913",
    road_address_name: "", address_name: "제주특별자치도 서귀포시 성산읍 성산리 78",
    place_url: "http://place.map.kakao.com/10332413",
  }],
};

const fakeFetch = (payload: unknown): typeof fetch =>
  (async () => ({ ok: true, status: 200, json: async () => payload })) as unknown as typeof fetch;

describe("isGenericName", () => {
  it("일반명사가 섞인 후보를 걸러낸다", () => {
    expect(isGenericName("제주도 소문난 맛집")).toBe(true);
    expect(isGenericName("현지 카페")).toBe(true);
    expect(isGenericName("전망 좋은 곳")).toBe(true);
  });

  it("실제 상호명은 통과시킨다", () => {
    expect(isGenericName("성산일출봉")).toBe(false);
    expect(isGenericName("우진해장국")).toBe(false);
  });
});

describe("matchesRequest", () => {
  it("요청명과 결과명이 포함 관계면 통과한다", () => {
    expect(matchesRequest("성산일출봉", "성산일출봉")).toBe(true);
    expect(matchesRequest("성산 일출봉", "성산일출봉")).toBe(true);
  });

  it("엉뚱한 매칭은 막는다", () => {
    expect(matchesRequest("제주 유명 오름", "새별오름")).toBe(false);
  });
});

describe("mapCategory", () => {
  it("카테고리 코드가 비어도 category_name으로 분류한다", () => {
    expect(mapCategory("", "여행 > 관광,명소 > 자연명소 > 산")).toBe("자연");
  });

  it("FD6은 맛집으로 매핑한다", () => {
    expect(mapCategory("FD6", "음식점 > 한식")).toBe("맛집");
  });

  it("자연 키워드가 코드보다 우선한다", () => {
    expect(mapCategory("AT4", "여행 > 관광,명소 > 해수욕장")).toBe("자연");
  });
});

describe("createKakaoResolver", () => {
  it("응답을 ResolvedPlace로 매핑한다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch(성산일출봉응답));
    const result = await resolver.resolve("성산일출봉", "제주도");
    expect(result).toMatchObject({ id: "10332413", name: "성산일출봉", category: "자연", lat: 33.45913, lng: 126.94054 });
  });

  it("도로명주소가 비면 지번주소를 쓴다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch(성산일출봉응답));
    expect((await resolver.resolve("성산일출봉", "제주도"))!.address)
      .toBe("제주특별자치도 서귀포시 성산읍 성산리 78");
  });

  it("검색 결과가 비면 null을 반환한다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch({ documents: [] }));
    expect(await resolver.resolve("없는장소", "제주도")).toBeNull();
  });

  it("일반명사는 호출조차 하지 않고 null을 반환한다", async () => {
    let called = false;
    const resolver = createKakaoResolver("key", (async () => {
      called = true;
      return { ok: true, status: 200, json: async () => 성산일출봉응답 };
    }) as unknown as typeof fetch);
    expect(await resolver.resolve("제주도 소문난 맛집", "제주도")).toBeNull();
    expect(called).toBe(false);
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/places/kakao.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 인터페이스 작성

`server/places/resolver.ts`

```ts
import type { ResolvedPlace } from "../itinerary/types";

export type KakaoCategoryCode = "FD6" | "CE7" | "AT4";

export interface PlaceResolver {
  resolve(name: string, destination: string): Promise<ResolvedPlace | null>;
  searchNearby(
    lat: number,
    lng: number,
    categoryCode: KakaoCategoryCode,
    radiusMeters: number,
  ): Promise<ResolvedPlace[]>;
}
```

- [ ] Step 4: 카카오 구현 작성

`server/places/kakao.ts`

```ts
import type { PlaceCategory, ResolvedPlace } from "../itinerary/types";
import type { KakaoCategoryCode, PlaceResolver } from "./resolver";

const BASE = "https://dapi.kakao.com/v2/local/search";

// 카카오는 없는 것을 없다고 하지 않는다. "제주도 소문난 맛집"을 검색하면
// 실제로 "소문난맛집"이라는 상호의 가게를 찾아준다. 조회 전에 막는다.
const GENERIC_TOKENS = [
  "맛집", "카페", "명소", "스팟", "추천", "로컬", "현지", "유명한", "인기",
  "전망 좋은", "분위기 좋은",
];

export function isGenericName(name: string): boolean {
  return GENERIC_TOKENS.some((token) => name.includes(token));
}

const normalize = (s: string) => s.replace(/[\s\W_]/gu, "").toLowerCase();

export function matchesRequest(requested: string, returned: string): boolean {
  const a = normalize(requested);
  const b = normalize(returned);
  return a.includes(b) || b.includes(a);
}

const CODE_MAP: Record<string, PlaceCategory> = {
  FD6: "맛집", CE7: "카페", AT4: "관광", CT1: "문화", MT1: "쇼핑",
};
const NATURE_TOKENS = ["자연", "산", "해수욕장", "폭포", "오름", "공원"];

export function mapCategory(code: string, categoryName: string): PlaceCategory {
  if (NATURE_TOKENS.some((t) => categoryName.includes(t))) return "자연";
  return CODE_MAP[code] ?? "관광";
}

type KakaoDoc = {
  id: string; place_name: string; category_group_code: string; category_name: string;
  x: string; y: string; road_address_name: string; address_name: string; place_url: string;
};

function toPlace(doc: KakaoDoc): ResolvedPlace {
  return {
    id: doc.id,
    name: doc.place_name,
    lat: Number(doc.y),
    lng: Number(doc.x),
    category: mapCategory(doc.category_group_code, doc.category_name),
    address: doc.road_address_name || doc.address_name,
    placeUrl: doc.place_url,
    mustVisit: false,
  };
}

export function createKakaoResolver(apiKey: string, fetchImpl: typeof fetch = fetch): PlaceResolver {
  if (!apiKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  const headers = { Authorization: `KakaoAK ${apiKey}` };

  const call = async (url: string): Promise<KakaoDoc[]> => {
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`카카오 로컬 API 실패: ${res.status}`);
    const body = (await res.json()) as { documents?: KakaoDoc[] };
    return body.documents ?? [];
  };

  return {
    async resolve(name, destination) {
      if (isGenericName(name)) return null;
      const query = encodeURIComponent(`${destination} ${name}`);
      const docs = await call(`${BASE}/keyword.json?query=${query}&size=5`);
      const hit = docs.find((d) => matchesRequest(name, d.place_name));
      return hit ? toPlace(hit) : null;
    },

    async searchNearby(lat, lng, categoryCode: KakaoCategoryCode, radiusMeters) {
      const docs = await call(
        `${BASE}/category.json?category_group_code=${categoryCode}&x=${lng}&y=${lat}&radius=${radiusMeters}&size=15`,
      );
      return docs.map(toPlace);
    },
  };
}
```

- [ ] Step 5: 통과 확인

Run: `npx vitest run tests/places/kakao.test.ts`
Expected: 11 passed

- [ ] Step 6: 실제 키로 연동 확인

Run:
```bash
npx tsx -e "
import 'dotenv/config';
import { createKakaoResolver } from './server/places/kakao';
const r = createKakaoResolver(process.env.KAKAO_REST_API_KEY!);
console.log(await r.resolve('성산일출봉', '제주도'));
console.log((await r.searchNearby(33.4591, 126.9405, 'FD6', 1000)).slice(0, 2));
"
```
Expected: 성산일출봉이 `category: "자연"`, 좌표 33.45913/126.94054로 출력. 근처 음식점 2곳이 실제 상호로 출력. `tsx`가 없으면 `npm i -D tsx` 후 실행.

- [ ] Step 7: `.env.example` 갱신 후 커밋

`.env.example` 끝에 추가한다.

```
# 국내 장소 검증용 (서버 전용 — VITE_ 접두사 없음)
# developers.kakao.com → 내 애플리케이션 → 앱 키 → REST API 키
# 주의: 개발자 계정 기준 첫 번째로 카카오맵 API를 활성화한 앱만 무료 쿼터를 받는다
KAKAO_REST_API_KEY=
```

```bash
git add server/places tests/places .env.example
git commit -m "feat: 카카오 로컬 장소 검증 어댑터 추가"
```

---

### Task 6: 후보 추출 (1단계)

Files:
- Create: `server/itinerary/candidates.ts`
- Test: `tests/itinerary/candidates.test.ts`

Interfaces:
- Consumes: `Candidate`, `Intensity`, `INTENSITY_RANGE`
- Produces: `candidateCount(days, intensity)`, `CandidateInput`, `buildCandidatePrompt(input)`, `CANDIDATE_SCHEMA`, `fetchCandidates(ai, input)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/candidates.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { candidateCount, buildCandidatePrompt } from "../../server/itinerary/candidates";

describe("candidateCount", () => {
  it("필요량의 2.5배를 요청하고 60개로 자른다", () => {
    expect(candidateCount(3, "빡빡하게")).toBe(60); // 3*8*2.5 = 60
    expect(candidateCount(3, "여유롭게")).toBe(23); // 3*3*2.5 = 22.5 → 23
    expect(candidateCount(10, "빡빡하게")).toBe(60); // 상한
  });
});

describe("buildCandidatePrompt", () => {
  it("필수 방문지와 요청 개수를 프롬프트에 포함시킨다", () => {
    const prompt = buildCandidatePrompt({
      destination: "제주도", days: 3, intensity: "빡빡하게",
      styles: ["맛집", "자연"], mustVisitPlaces: "성산일출봉, 한라산", comments: "",
    });
    expect(prompt).toContain("성산일출봉, 한라산");
    expect(prompt).toContain("60");
  });

  it("설명문을 요구하지 않는다", () => {
    const prompt = buildCandidatePrompt({
      destination: "제주도", days: 2, intensity: "여유롭게",
      styles: [], mustVisitPlaces: "", comments: "",
    });
    expect(prompt).not.toContain("설명을 써");
    expect(prompt).toContain("이름과 분류만");
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/candidates.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 구현

`server/itinerary/candidates.ts`

```ts
import { Type, type GoogleGenAI } from "@google/genai";
import { INTENSITY_RANGE } from "./types";
import type { Candidate, Intensity, PlaceCategory } from "./types";

const MAX_CANDIDATES = 60;
const OVERSAMPLE = 2.5;

/** 필요량보다 넉넉히 받아야 3단계에서 고를 수 있고, 같은 조건에도 결과가 달라진다. */
export function candidateCount(days: number, intensity: Intensity): number {
  const need = days * INTENSITY_RANGE[intensity].max;
  return Math.min(MAX_CANDIDATES, Math.ceil(need * OVERSAMPLE));
}

export type CandidateInput = {
  destination: string;
  days: number;
  intensity: Intensity;
  styles: string[];
  mustVisitPlaces: string;
  comments: string;
};

export function buildCandidatePrompt(input: CandidateInput): string {
  const count = candidateCount(input.days, input.intensity);
  return `당신은 한국 국내 여행 전문 가이드입니다.
${input.destination} 여행에서 가볼 만한 장소 ${count}곳의 이름과 분류만 알려주세요.

[조건]
- 선호 스타일: ${input.styles.join(", ") || "제한 없음"}
- 반드시 포함할 장소: ${input.mustVisitPlaces || "없음"}
- 추가 요청: ${input.comments || "없음"}

[규칙]
1. 반드시 포함할 장소가 있으면 목록 맨 앞에 그대로 넣으세요.
2. 검색하면 실제로 나오는 고유한 상호명·지명만 쓰세요. "로컬 맛집", "인기 명소 1" 같은 일반명사는 금지합니다.
3. 식당과 카페는 넣지 마세요. 식사 장소는 따로 정합니다.
4. 시간, 좌표, 부연을 붙이지 마세요. 이름과 분류만 필요합니다.
5. 한 지역에 몰리지 않게 ${input.destination} 전역에서 고르게 뽑으세요.`;
}

export const CANDIDATE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "실제 존재하는 장소의 고유 명칭" },
      category: { type: Type.STRING, description: "관광, 자연, 문화, 쇼핑, 액티비티 중 하나" },
    },
    required: ["name", "category"],
  },
} as const;

const ALLOWED: readonly PlaceCategory[] = ["관광", "자연", "문화", "쇼핑", "액티비티"];

export async function fetchCandidates(ai: GoogleGenAI, input: CandidateInput): Promise<Candidate[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildCandidatePrompt(input),
    config: {
      systemInstruction: "당신은 항상 정확한 JSON 배열만 출력합니다. 한국어로 응답하세요.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: CANDIDATE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("후보 추출 응답이 비었습니다.");

  const parsed = JSON.parse(text.trim()) as Array<{ name?: string; category?: string }>;
  return parsed
    .filter((c): c is { name: string; category?: string } => Boolean(c.name))
    .map((c) => ({
      name: c.name,
      category: (ALLOWED as readonly string[]).includes(c.category ?? "")
        ? (c.category as PlaceCategory)
        : ("관광" as PlaceCategory),
    }));
}
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run tests/itinerary/candidates.test.ts`
Expected: 4 passed

- [ ] Step 5: 커밋

```bash
git add server/itinerary/candidates.ts tests/itinerary/candidates.test.ts
git commit -m "feat: 장소 후보 추출 단계 추가"
```

---

### Task 7: 설명 생성 (4단계)

Files:
- Create: `server/itinerary/narrate.ts`
- Test: `tests/itinerary/narrate.test.ts`

Interfaces:
- Consumes: `ScheduledDay`, `formatTime`
- Produces: `NarratedActivity`, `NarratedDay`, `minimalNarration(day, destination)`, `narrateDay(ai, day, destination)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/narrate.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { minimalNarration } from "../../server/itinerary/narrate";
import type { ScheduledDay } from "../../server/itinerary/types";

const day: ScheduledDay = {
  day: 1,
  activities: [{
    place: {
      id: "1", name: "성산일출봉", lat: 33.4591, lng: 126.9405, category: "자연",
      address: "제주특별자치도 서귀포시 성산읍 일출로 284-12", mustVisit: true,
    },
    startMinutes: 540, stayMinutes: 120, travelFromPrevMinutes: 0, isMeal: false,
  }],
};

describe("minimalNarration", () => {
  it("실제 데이터만으로 설명을 만든다", () => {
    const result = minimalNarration(day, "제주도");
    expect(result.theme).toBe("제주도 1일차");
    expect(result.activities[0].title).toBe("성산일출봉");
    expect(result.activities[0].description).toContain("제주특별자치도 서귀포시 성산읍 일출로 284-12");
    expect(result.activities[0].description).toContain("자연");
  });

  it("주소에서 시·군·구를 뽑아 날짜 설명을 만든다", () => {
    expect(minimalNarration(day, "제주도").description).toContain("서귀포시");
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/narrate.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 구현

`server/itinerary/narrate.ts`

```ts
import { Type, type GoogleGenAI } from "@google/genai";
import { formatTime } from "./schedule";
import type { ScheduledDay } from "./types";

export type NarratedActivity = { title: string; description: string; tags: string[] };
export type NarratedDay = { theme: string; description: string; activities: NarratedActivity[] };

const REGION = /(\S+시|\S+군|\S+구)/;

/** 4단계가 실패했을 때. 지어내지 않고 이미 확보한 실제 데이터만 쓴다. */
export function minimalNarration(day: ScheduledDay, destination: string): NarratedDay {
  const regions = [
    ...new Set(
      day.activities
        .map((a) => a.place.address.match(REGION)?.[1])
        .filter((r): r is string => Boolean(r)),
    ),
  ];
  return {
    theme: `${destination} ${day.day}일차`,
    description: regions.length > 0 ? `${regions.join(", ")} 일대를 돕니다.` : `${destination} 일대를 돕니다.`,
    activities: day.activities.map((a) => ({
      title: a.place.name,
      description: `${a.place.address}에 있는 ${a.place.category}입니다.`,
      tags: [a.place.category],
    })),
  };
}

const NARRATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING, description: "이 날의 핵심 테마 제목" },
    description: { type: Type.STRING, description: "이 날 일정의 한 줄 요약" },
    activities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "2~3문장, 120자 이내. 그곳에서 뭘 하면 좋은지 실용 정보 위주" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "해시태그 2~3개" },
        },
        required: ["description", "tags"],
      },
    },
  },
  required: ["theme", "description", "activities"],
} as const;

export async function narrateDay(
  ai: GoogleGenAI,
  day: ScheduledDay,
  destination: string,
): Promise<NarratedDay> {
  // 장소·순서·시각은 이미 확정됐다. 여기서는 글만 쓴다.
  const list = day.activities
    .map((a, i) => `${i + 1}. ${formatTime(a.startMinutes)} ${a.place.name} (${a.place.category}, ${a.place.address})`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${destination} 여행 ${day.day}일차 일정입니다. 순서와 장소는 이미 확정됐으니 바꾸지 마세요.

${list}

각 활동에 대해 여행 가이드북 톤의 존댓말 설명을 2~3문장, 120자 이내로 써주세요.
미사여구보다 그곳에서 뭘 하면 좋은지, 뭘 먹으면 좋은지 같은 실용 정보를 넣으세요.
activities 배열은 위 순서와 개수를 정확히 지켜주세요.`,
    config: {
      systemInstruction: "당신은 항상 정확한 JSON만 출력하는 여행 도우미입니다. 한국어로 응답하세요.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: NARRATE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error(`${day.day}일차 설명 응답이 비었습니다.`);

  const parsed = JSON.parse(text.trim()) as {
    theme: string; description: string; activities: Array<{ description: string; tags?: string[] }>;
  };
  if (parsed.activities.length !== day.activities.length) {
    throw new Error(`${day.day}일차 설명 개수 불일치: ${parsed.activities.length} vs ${day.activities.length}`);
  }

  return {
    theme: parsed.theme,
    description: parsed.description,
    activities: day.activities.map((a, i) => ({
      title: a.place.name,
      description: parsed.activities[i].description,
      tags: parsed.activities[i].tags ?? [],
    })),
  };
}
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run tests/itinerary/`
Expected: 전체 통과

- [ ] Step 5: 커밋

```bash
git add server/itinerary/narrate.ts tests/itinerary/narrate.test.ts
git commit -m "feat: 날짜별 설명 생성과 최소 설명 폴백 추가"
```

---

### Task 8: 파이프라인 조립

Files:
- Create: `server/itinerary/pipeline.ts`
- Test: `tests/itinerary/pipeline.test.ts`

`PlanDay`는 기존 프론트가 읽는 모양을 그대로 유지한다. `imageUrl`은 호출부(Task 10)가 채운다.

Interfaces:
- Consumes: `routing`, `schedule`, `narrate`, `PlaceResolver`, `INTENSITY_RANGE`
- Produces: `PlanRequest`, `PipelineDeps`, `PlanActivity`, `PlanDay`, `generateItinerary(deps, request)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/pipeline.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { generateItinerary, type PipelineDeps, type PlanRequest } from "../../server/itinerary/pipeline";
import type { PlaceResolver } from "../../server/places/resolver";
import type { PlaceCategory, ResolvedPlace } from "../../server/itinerary/types";

const place = (name: string, lat: number, lng: number, category: PlaceCategory = "관광"): ResolvedPlace => ({
  id: name, name, lat, lng, category, address: `제주특별자치도 서귀포시 ${name}로 1`, mustVisit: false,
});

const fakeResolver: PlaceResolver = {
  async resolve(name) {
    const i = Number(name.replace("장소", ""));
    if (Number.isNaN(i)) return null;
    return place(name, 33.3 + i * 0.05, 126.3 + i * 0.05);
  },
  async searchNearby(lat, lng, code) {
    return [place(`식당-${lat.toFixed(3)}-${code}`, lat, lng, code === "CE7" ? "카페" : "맛집")];
  },
};

const deps: PipelineDeps = {
  resolver: fakeResolver,
  fetchCandidates: async () =>
    Array.from({ length: 12 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
  narrateDay: async () => { throw new Error("설명 생성 실패"); },
};

const request: PlanRequest = {
  destination: "제주도", days: 3, intensity: "여유롭게",
  transportMode: "자차", styles: [], mustVisitPlaces: "", comments: "",
};

describe("generateItinerary", () => {
  it("요청한 일수만큼 날짜를 만든다", async () => {
    expect((await generateItinerary(deps, request)).planContent).toHaveLength(3);
  });

  it("같은 장소가 두 날짜에 나오지 않는다", async () => {
    const result = await generateItinerary(deps, request);
    const titles = result.planContent.flatMap((d) => d.activities.map((a) => a.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("매일 식사가 배치되고 시간순으로 정렬된다", async () => {
    const result = await generateItinerary(deps, request);
    result.planContent.forEach((day) => {
      expect(day.activities.some((a) => a.isMeal)).toBe(true);
    });
  });

  it("설명 생성이 모두 실패하면 narrationDegraded를 세우고 최소 설명으로 채운다", async () => {
    const result = await generateItinerary(deps, request);
    expect(result.narrationDegraded).toBe(true);
    expect(result.planContent[0].activities[0].description).not.toBe("");
  });

  it("검증된 장소가 최소치에 못 미치면 오류를 던진다", async () => {
    const 빈리졸버: PlaceResolver = { async resolve() { return null; }, async searchNearby() { return []; } };
    await expect(generateItinerary({ ...deps, resolver: 빈리졸버 }, request)).rejects.toThrow(/장소/);
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/pipeline.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 구현

`server/itinerary/pipeline.ts`

```ts
import { assignToDays, dedupe, fillToMinimum, orderDays, orderWithinDay } from "./routing";
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

async function resolveAll(
  resolver: PlaceResolver,
  candidates: readonly Candidate[],
  destination: string,
  mustNames: readonly string[],
): Promise<ResolvedPlace[]> {
  const settled = await Promise.allSettled(
    candidates.map((c) => resolver.resolve(c.name, destination)),
  );
  const resolved = settled
    .map((s, i) =>
      s.status === "fulfilled" && s.value
        ? { ...s.value, mustVisit: mustNames.includes(candidates[i].name) }
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
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const pick = r.value.find((p) => !used.has(p.id));
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
  const candidates = await deps.fetchCandidates(request);
  const places = await resolveAll(deps.resolver, candidates, request.destination, mustNames);

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
    const extras = rescued
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((p) => !usedIds.has(p.id));
    assigned = fillToMinimum({ ...assigned, leftover: [...assigned.leftover, ...dedupe(extras)] }, min);
  }

  const dayOrder = orderDays(assigned.centers);

  const scheduled: ScheduledDay[] = [];
  let previousTail: Coord | null = null;

  for (const [index, clusterIdx] of dayOrder.entries()) {
    const ordered = orderWithinDay(assigned.buckets[clusterIdx], previousTail);
    if (ordered.length > 0) previousTail = ordered[ordered.length - 1];

    const layout = layoutDay(ordered, request.transportMode, request.intensity);
    const meals = await pickMeals(deps.resolver, layout.mealSlots, usedIds);
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
```

- [ ] Step 4: 통과 확인

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.server.json`
Expected: 전체 통과, 타입 오류 없음

- [ ] Step 5: 커밋

```bash
git add server/itinerary/pipeline.ts tests/itinerary/pipeline.test.ts
git commit -m "feat: 일정 생성 파이프라인 조립"
```

---

### Task 9: 실행 러너와 사진 모듈 공유

Files:
- Create: `server/itinerary/runner.ts`, `server/places/photos.ts`

두 진입점이 같은 조립을 쓰게 해서 복제를 없앤다. 사진 헬퍼도 지금 `netlify/functions/generate-plan.ts`와 `revise-plan.ts`에 복제돼 있으므로 한 곳으로 모은다.

Interfaces:
- Consumes: `fetchCandidates`, `narrateDay`, `generateItinerary`, `createKakaoResolver`
- Produces: `runPipeline(request)`, `fetchRealPlacePhotoRef(name, destination)`, `getMockupImage(category, destination, index)`, `attachPhotos(days, destination)`

- [ ] Step 1: 사진 모듈 추출

`server/places/photos.ts`를 만들고, 기존 `netlify/functions/generate-plan.ts:9-107`의 `fetchRealPlacePhotoRef`, `getMockupImage`, `fetchJsonHttps`를 그대로 옮긴다(세 함수 모두 `export`). 그리고 아래를 덧붙인다.

```ts
import type { PlanDay } from "../itinerary/pipeline";

/** 사진은 부가 정보다. 실패해도 일정 자체는 내보낸다. */
export async function attachPhotos(days: PlanDay[], destination: string) {
  return Promise.all(
    days.map(async (day) => ({
      ...day,
      activities: await Promise.all(
        day.activities.map(async (act, idx) => {
          const ref = await fetchRealPlacePhotoRef(act.title, destination).catch(() => null);
          return {
            ...act,
            imageUrl: ref
              ? `/api/place-photo?ref=${encodeURIComponent(ref)}`
              : getMockupImage(act.category, destination, idx),
          };
        }),
      ),
    })),
  );
}
```

- [ ] Step 2: 러너 작성

`server/itinerary/runner.ts`

```ts
import { GoogleGenAI } from "@google/genai";
import { fetchCandidates } from "./candidates";
import { narrateDay } from "./narrate";
import { generateItinerary, type PlanRequest } from "./pipeline";
import { createKakaoResolver } from "../places/kakao";

const CANDIDATE_TIMEOUT_MS = 8_000;
const NARRATE_TIMEOUT_MS = 10_000;

// 외부 호출은 스스로 멈추지 않는다. 단계마다 예산을 걸어 전체 30초를 지킨다.
function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: ${ms}ms 초과`)), ms);
    task.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function runPipeline(request: PlanRequest) {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  return generateItinerary(
    {
      resolver: createKakaoResolver(kakaoKey),
      // 1단계는 파이프라인 전체의 전제다. 한 번만 재시도한다.
      fetchCandidates: (req) =>
        withTimeout(fetchCandidates(ai, req), CANDIDATE_TIMEOUT_MS, "후보 추출").catch(() =>
          withTimeout(fetchCandidates(ai, req), CANDIDATE_TIMEOUT_MS, "후보 추출 재시도"),
        ),
      narrateDay: (day, destination) =>
        withTimeout(narrateDay(ai, day, destination), NARRATE_TIMEOUT_MS, `${day.day}일차 설명`),
    },
    request,
  );
}
```

- [ ] Step 3: 타입 검사

Run: `npx tsc --noEmit -p tsconfig.server.json`
Expected: 오류 없음

- [ ] Step 4: 커밋

```bash
git add server/itinerary/runner.ts server/places/photos.ts
git commit -m "feat: 파이프라인 실행 러너와 공용 사진 모듈 추가"
```

---

### Task 10: 두 진입점 교체와 폴백 제거

Files:
- Modify: `server/server.ts:283-636` (`/api/generate-plan` 핸들러 전체 교체)
- Modify: `netlify/functions/generate-plan.ts` (전체 교체)

- [ ] Step 1: 로컬 서버 핸들러 교체

`server/server.ts`의 `app.post("/api/generate-plan", ...)` 블록을 아래로 바꾸고, `createFallbackPlan`·`spotsPerDay`·`getRecommendedSpots` import를 지운다. 상단에 `import { runPipeline } from "./itinerary/runner";`와 `import { attachPhotos } from "./places/photos";`를 추가한다.

```ts
app.post("/api/generate-plan", async (req, res) => {
  const { destination, startDate, endDate, companion, budget, intensity, transportMode, styles, mustVisitPlaces, comments } = req.body;

  if (!destination) {
    return res.status(400).json({
      success: false, data: null,
      error: { code: "DESTINATION_REQUIRED", message: "목적지를 입력해주세요.", field: "destination" },
    });
  }

  const days = startDate && endDate
    ? Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1
    : 3;

  try {
    const { planContent, narrationDegraded } = await runPipeline({
      destination, days,
      intensity: intensity === "빡빡하게" ? "빡빡하게" : "여유롭게",
      transportMode: transportMode === "도보" ? "도보" : transportMode === "자차" ? "자차" : "대중교통",
      styles: Array.isArray(styles) ? styles : [],
      mustVisitPlaces: mustVisitPlaces || "",
      comments: comments || "",
    });

    return res.json({
      title: `${destination} ${days - 1}박 ${days}일 여행`,
      destination,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || new Date().toISOString().split("T")[0],
      duration: `${days - 1}박 ${days}일`,
      budget: budget || "표준형",
      companion: companion || "혼자",
      intensity: intensity || "여유롭게",
      transportMode: transportMode || "대중교통",
      styles: styles || [],
      mustVisitPlaces: mustVisitPlaces || "",
      planContent: await attachPhotos(planContent, destination),
      narrationDegraded,
    });
  } catch (err) {
    console.error("[TripMate] 일정 생성 실패:", err);
    return res.status(500).json({
      success: false, data: null,
      error: { code: "PLAN_GENERATION_FAILED", message: "일정을 만들지 못했습니다. 조건을 조금 바꿔 다시 시도해 주세요.", field: null },
    });
  }
});
```

- [ ] Step 2: Netlify 함수 전체 교체

`netlify/functions/generate-plan.ts` 파일 내용을 전부 지우고 아래로 바꾼다.

```ts
import { runPipeline } from "../../server/itinerary/runner";
import { attachPhotos } from "../../server/places/photos";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fail = (statusCode: number, code: string, message: string, field: string | null = null) => ({
  statusCode, headers,
  body: JSON.stringify({ success: false, data: null, error: { code, message, field } }),
});

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail(400, "INVALID_JSON", "요청 형식이 올바르지 않습니다.");
  }

  const { destination, startDate, endDate, companion, budget, intensity, transportMode, styles, mustVisitPlaces, comments } = body;
  if (!destination) return fail(400, "DESTINATION_REQUIRED", "목적지를 입력해주세요.", "destination");

  const days = startDate && endDate
    ? Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1
    : 3;

  try {
    const { planContent, narrationDegraded } = await runPipeline({
      destination, days,
      intensity: intensity === "빡빡하게" ? "빡빡하게" : "여유롭게",
      transportMode: transportMode === "도보" ? "도보" : transportMode === "자차" ? "자차" : "대중교통",
      styles: Array.isArray(styles) ? styles : [],
      mustVisitPlaces: mustVisitPlaces || "",
      comments: comments || "",
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        title: `${destination} ${days - 1}박 ${days}일 여행`,
        destination,
        startDate: startDate || new Date().toISOString().split("T")[0],
        endDate: endDate || new Date().toISOString().split("T")[0],
        duration: `${days - 1}박 ${days}일`,
        budget: budget || "표준형",
        companion: companion || "혼자",
        intensity: intensity || "여유롭게",
        transportMode: transportMode || "대중교통",
        styles: styles || [],
        mustVisitPlaces: mustVisitPlaces || "",
        planContent: await attachPhotos(planContent, destination),
        narrationDegraded,
      }),
    };
  } catch (err) {
    console.error("[TripMate] 일정 생성 실패:", err);
    return fail(500, "PLAN_GENERATION_FAILED", "일정을 만들지 못했습니다. 조건을 조금 바꿔 다시 시도해 주세요.");
  }
};
```

- [ ] Step 3: `revise-plan.ts`의 사진 헬퍼 중복 제거

`netlify/functions/revise-plan.ts:1-97`의 `fetchJsonHttps`, `fetchRealPlacePhotoRef`, `getMockupImage` 정의를 지우고 `import { fetchRealPlacePhotoRef, getMockupImage } from "../../server/places/photos";`로 바꾼다.

- [ ] Step 4: 타입 검사와 빌드

Run: `npx tsc --noEmit && npm run build`
Expected: 오류 없음

- [ ] Step 5: 실제 생성 확인

`npm run dev` 후 다른 터미널에서

```bash
time curl -s -X POST http://localhost:3100/api/generate-plan -H "Content-Type: application/json" \
  -d '{"destination":"제주도","startDate":"2026-09-04","endDate":"2026-09-06","intensity":"빡빡하게","transportMode":"자차","styles":["맛집","자연"],"mustVisitPlaces":"성산일출봉","comments":""}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
names = []
for day in d['planContent']:
    print(f\"[Day {day['day']}] {day['theme']}\")
    for a in day['activities']:
        print(f\"  {a['time']} {a['title']} ({a['category']}) {a['location']}\")
        names.append(a['title'])
print('중복 개수:', len(names) - len(set(names)))
print('성산일출봉 포함:', any('성산일출봉' in n for n in names))
"
```

Expected: 30초 이내 완료, 중복 0, 성산일출봉 포함, 식당이 실제 상호명

- [ ] Step 6: 커밋

```bash
git add server/server.ts netlify/functions/generate-plan.ts netlify/functions/revise-plan.ts
git commit -m "refactor: 두 진입점을 새 파이프라인에 연결하고 가짜 일정 폴백 제거"
```

---

### Task 11: 클라이언트 정리

Files:
- Modify: `src/types.ts:49`, `src/components/PlannerFlow.tsx:200-224`

- [ ] Step 1: 타입 교체

`src/types.ts:49`의 `isFallback?: boolean;`을 `narrationDegraded?: boolean;`으로 바꾼다.

- [ ] Step 2: 응답 처리 교체

`src/components/PlannerFlow.tsx:200-202`의 `if (!response.ok)` 블록을 바꾼다.

```tsx
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || "일정 생성에 실패했습니다.");
      }
```

`:212-215`의 `isFallback` 블록을 바꾼다.

```tsx
      // 장소와 동선은 확정됐지만 설명 생성이 실패한 경우. 가짜 일정이 아니라 설명만 짧다.
      if (plan.narrationDegraded) {
        onError("일정은 만들었지만 설명을 다 쓰지 못했습니다. 다시 시도하면 설명이 채워집니다.");
      }
```

`:223`의 일반 오류 처리를 바꾼다.

```tsx
        onError(err instanceof Error ? err.message : "일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
```

- [ ] Step 3: 잔재 확인

Run: `grep -rn "createFallbackPlan\|isFallback" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: 결과 없음

- [ ] Step 4: 타입 검사와 빌드

Run: `npx tsc --noEmit && npm run build`
Expected: 오류 없음

- [ ] Step 5: 실패 화면 육안 확인

`.env`의 `KAKAO_REST_API_KEY` 값을 잠시 비우고 `npm run dev`로 일정 생성을 시도한다. 가짜 일정 대신 오류 메시지가 떠야 한다. 확인 후 값을 되돌린다.

- [ ] Step 6: 커밋

```bash
git add src/types.ts src/components/PlannerFlow.tsx
git commit -m "refactor: 가짜 일정 폴백 UI 제거하고 실패·설명누락 안내로 교체"
```

---

### Task 12: 수정 요청의 불변식 유지

Files:
- Create: `server/itinerary/revise.ts`
- Modify: `netlify/functions/revise-plan.ts`, `server/server.ts:638-766`
- Test: `tests/itinerary/revise.test.ts`

수정 요청이 LLM에게 일정 전체를 다시 쓰게 하면 중복과 동선이 다시 깨진다. 수정은 요청 조건만 바꾸고 파이프라인을 다시 태운다.

Interfaces:
- Consumes: `PlanRequest`
- Produces: `mergeFeedbackIntoRequest(base, feedback, excludePlaces?)`

- [ ] Step 1: 실패하는 테스트 작성

`tests/itinerary/revise.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { mergeFeedbackIntoRequest } from "../../server/itinerary/revise";
import type { PlanRequest } from "../../server/itinerary/pipeline";

const base: PlanRequest = {
  destination: "제주도", days: 3, intensity: "여유롭게",
  transportMode: "자차", styles: [], mustVisitPlaces: "", comments: "조용한 곳",
};

describe("mergeFeedbackIntoRequest", () => {
  it("피드백을 기존 comments에 누적한다", () => {
    const result = mergeFeedbackIntoRequest(base, "가는 장소는 바꿔줘");
    expect(result.comments).toContain("조용한 곳");
    expect(result.comments).toContain("가는 장소는 바꿔줘");
  });

  it("이전 장소를 제외 지시로 넘긴다", () => {
    const result = mergeFeedbackIntoRequest(base, "새로운 곳으로", ["성산일출봉", "한라산"]);
    expect(result.comments).toContain("성산일출봉");
    expect(result.comments).toContain("한라산");
  });

  it("목적지와 일수 같은 기본 조건은 유지한다", () => {
    const result = mergeFeedbackIntoRequest(base, "바꿔줘");
    expect(result.destination).toBe("제주도");
    expect(result.days).toBe(3);
  });
});
```

- [ ] Step 2: 테스트 실패 확인

Run: `npx vitest run tests/itinerary/revise.test.ts`
Expected: FAIL — 모듈 없음

- [ ] Step 3: 구현

`server/itinerary/revise.ts`

```ts
import type { PlanRequest } from "./pipeline";

/** 수정은 파이프라인을 다시 태운다. LLM이 일정 전체를 다시 쓰면 중복·동선 불변식이 깨진다. */
export function mergeFeedbackIntoRequest(
  base: PlanRequest,
  feedback: string,
  excludePlaces: readonly string[] = [],
): PlanRequest {
  const parts = [base.comments, feedback].filter(Boolean);
  if (excludePlaces.length > 0) {
    parts.push(`다음 장소는 제외하고 다른 곳으로 추천하세요: ${excludePlaces.join(", ")}`);
  }
  return { ...base, comments: parts.join(" / ") };
}
```

- [ ] Step 4: 두 진입점 교체

`netlify/functions/revise-plan.ts`의 `handler` 본문과 `server/server.ts:638-766`의 `/api/revise-plan` 핸들러에서, 자체 Gemini 호출과 스키마 정의를 지우고 아래 흐름으로 바꾼다. 요청 바디에 `days`, `intensity`, `transportMode`, `styles`, `mustVisitPlaces`가 없으면 프론트가 보내도록 `PlannerFlow`/일정 화면에서 함께 넘긴다.

```ts
const previousNames: string[] = planContent.flatMap((d: any) =>
  d.activities.map((a: any) => a.title),
);

const { planContent: revised, narrationDegraded } = await runPipeline(
  mergeFeedbackIntoRequest(
    {
      destination, days,
      intensity: intensity === "빡빡하게" ? "빡빡하게" : "여유롭게",
      transportMode: transportMode === "도보" ? "도보" : transportMode === "자차" ? "자차" : "대중교통",
      styles: Array.isArray(styles) ? styles : [],
      mustVisitPlaces: mustVisitPlaces || "",
      comments: "",
    },
    feedback,
    previousNames,
  ),
);

return { success: true, planContent: await attachPhotos(revised, destination), narrationDegraded };
```

- [ ] Step 5: 검증

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 전체 통과

수동 확인: `npm run dev`로 일정을 만든 뒤 "가는 장소는 바꿔줘"로 수정 요청. 새 일정에 이전 장소가 없고 날짜 간 중복도 없어야 한다.

- [ ] Step 6: 커밋

```bash
git add server/itinerary/revise.ts tests/itinerary/revise.test.ts netlify/functions/revise-plan.ts server/server.ts src
git commit -m "refactor: 수정 요청도 파이프라인을 재실행해 중복·동선 불변식 유지"
```

---

## 완료 기준

- `npx vitest run` 전체 통과
- `npx tsc --noEmit`, `npm run build` 오류 없음
- 제주도 2박 3일 빡빡하게 생성이 30초 이내 완료
- 결과에 장소 중복 0
- 식당·카페가 모두 실제 상호명
- 필수 방문지가 포함되고 `mustVisit: true`
- `grep -rn "createFallbackPlan\|isFallback" --include="*.ts" --include="*.tsx" .`에 결과 없음
