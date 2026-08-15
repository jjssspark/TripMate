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

  it("하루가 18시를 넘겨도 강도 하한에서 잘라내기를 멈춘다", () => {
    // 이동이 워낙 멀어 하한 4개로도 18시를 못 지킨다. 하한이 시간 제한을 이긴다.
    const layout = layoutDay(멀리떨어진8곳, "대중교통", "빡빡하게");
    expect(layout.activities).toHaveLength(4);
    const last = layout.activities[layout.activities.length - 1];
    expect(last.startMinutes + last.stayMinutes).toBeGreaterThan(1080);
  });

  it("하한보다 먼저 18시에 걸리면 그 지점에서 멈춘다", () => {
    // 가까이 모여 있어 5개까지는 18시 안에 들어간다. 6개째부터 넘긴다.
    const 가까운8곳 = Array.from({ length: 8 }, (_, i) =>
      place(`q${i}`, 33.2 + i * 0.05, 126.2 + i * 0.05));
    const layout = layoutDay(가까운8곳, "자차", "빡빡하게");
    expect(layout.activities).toHaveLength(5);
    const last = layout.activities[layout.activities.length - 1];
    expect(last.startMinutes + last.stayMinutes).toBeLessThanOrEqual(1080);
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
