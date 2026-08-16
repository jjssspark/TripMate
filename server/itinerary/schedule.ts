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
/**
 * 18:00 — 관광에 쓰는 시간의 상한. 잘라내기는 이 값으로 판단한다.
 * 중간에 끼는 식사 시간은 관광 시간이 아니므로 여기 포함시키지 않는다. 그래서
 * 최종 일정의 마지막 활동은 삽입된 식사 시간만큼 이 값을 넘길 수 있다.
 */
export const GENERAL_END_LIMIT = 1080;
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

/** 점심 슬롯 시각. anchor 활동이 끝나는 시각을 창 안으로 끌어온다. */
function lunchAt(activities: readonly ScheduledActivity[]): { anchor: ScheduledActivity; atMinutes: number } {
  const triggerIdx = activities.findIndex((a) => a.startMinutes >= LUNCH_TRIGGER);
  const anchor = activities[Math.max(0, (triggerIdx === -1 ? activities.length : triggerIdx) - 1)];
  const rawLunch = anchor.startMinutes + anchor.stayMinutes;
  return { anchor, atMinutes: Math.min(LUNCH_MAX, Math.max(LUNCH_MIN, rawLunch)) };
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
    // 관광 시간만으로 판단한다. 중간에 낄 식사 시간까지 이 예산에 넣으면 장소가 하나
    // 더 잘려 나가고, 빡빡하게가 자기 하한으로 내려앉아 강도 선택이 무의미해진다.
    // 식사 때문에 마지막 활동이 18시를 조금 넘기는 편이 장소를 잃는 것보다 낫다.
    const last = activities[activities.length - 1];
    if (last.startMinutes + last.stayMinutes <= GENERAL_END_LIMIT) break;
    // 뒤에서부터 덜어내되 필수 방문지는 건너뛴다. 사용자가 이름을 찍어 요청한 곳이다.
    const fromEnd = [...kept].reverse().findIndex((p) => !p.mustVisit);
    if (fromEnd === -1) break; // 남은 게 전부 필수면 더 줄일 수 없다
    const removeAt = kept.length - 1 - fromEnd;
    kept = [...kept.slice(0, removeAt), ...kept.slice(removeAt + 1)];
    activities = walk(kept, mode);
  }

  const mealSlots: MealSlot[] = [];
  if (activities.length > 0) {
    mealSlots.push({ mealType: "아침", near: activities[0].place, atMinutes: BREAKFAST_AT });

    const lunch = lunchAt(activities);
    mealSlots.push({ mealType: "점심", near: lunch.anchor.place, atMinutes: lunch.atMinutes });

    const tail = activities[activities.length - 1];
    const rawDinner = tail.startMinutes + tail.stayMinutes + 15;
    // 하한 규칙이 하루를 19:30 너머까지 밀어낸 날은 저녁을 창 안으로 끌어내리면
    // 아직 진행 중인 활동과 겹친다. 그런 날만 마지막 활동 뒤로 보낸다.
    mealSlots.push({
      mealType: "저녁",
      near: tail.place,
      atMinutes: rawDinner > DINNER_MAX ? rawDinner : Math.max(GENERAL_END_LIMIT, rawDinner),
    });
  }

  return { activities, mealSlots };
}

/**
 * 하루 일정의 불변식. 각 활동은 직전 활동이 끝나고 이동 시간이 지난 뒤에 시작해야 한다.
 * 검사(hasOverlap)와 교정(pushBackOverlaps)이 이 한 정의만 쓴다. 둘이 갈라지면
 * 테스트는 통과하는데 일정은 겹치는 상태가 된다.
 */
function earliestStart(prev: ScheduledActivity, next: ScheduledActivity): number {
  return prev.startMinutes + prev.stayMinutes + next.travelFromPrevMinutes;
}

export function hasOverlap(activities: readonly ScheduledActivity[]): boolean {
  for (let i = 1; i < activities.length; i += 1) {
    if (activities[i].startMinutes < earliestStart(activities[i - 1], activities[i])) return true;
  }
  return false;
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

  const sorted = [...layout.activities, ...mealActivities].sort((a, b) => a.startMinutes - b.startMinutes);
  return pushBackOverlaps(sorted);
}

/**
 * 식사는 anchor 활동의 종료 시각에 꽂히지만 체류가 45~90분이라 뒤 활동과 겹친다.
 * 겹친 활동을 필요한 만큼만 뒤로 민다 — 밀린 양을 뒤쪽 전부에 일괄로 더하면
 * 자기 여유(저녁 슬롯처럼)를 가진 활동까지 이유 없이 늦춰진다.
 * 입력 배열과 원소는 건드리지 않고 새 배열을 만든다.
 */
function pushBackOverlaps(activities: readonly ScheduledActivity[]): ScheduledActivity[] {
  const out = [...activities];
  for (let i = 1; i < out.length; i += 1) {
    const earliest = earliestStart(out[i - 1], out[i]);
    if (out[i].startMinutes >= earliest) continue;
    out[i] = { ...out[i], startMinutes: earliest };
  }
  return out;
}
