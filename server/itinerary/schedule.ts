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
