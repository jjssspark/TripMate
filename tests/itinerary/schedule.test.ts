import { describe, it, expect } from "vitest";
import { layoutDay, insertMeals, formatTime, hasOverlap, GENERAL_END_LIMIT } from "../../server/itinerary/schedule";
import { travelMinutes } from "../../server/itinerary/geo";
import { INTENSITY_RANGE } from "../../server/itinerary/types";
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
// 이동 14분씩. 관광 시간만 보면 5개까지 18시 안에 들어간다.
const 가까운8곳 = Array.from({ length: 8 }, (_, i) =>
  place(`q${i}`, 33.2 + i * 0.05, 126.2 + i * 0.05));

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
    // 가까이 모여 있어 관광 시간만 보면 5개까지는 18시 안에 들어간다. 6개째부터 넘긴다.
    // 하한(4)보다 큰 5에서 멈추므로 멈춘 이유가 하한이 아니라 시간 제한임이 드러난다.
    const layout = layoutDay(가까운8곳, "자차", "빡빡하게");
    expect(layout.activities).toHaveLength(5);
    expect(layout.activities.length).toBeGreaterThan(INTENSITY_RANGE["빡빡하게"].min);
    const last = layout.activities[layout.activities.length - 1];
    expect(last.startMinutes + last.stayMinutes).toBeLessThanOrEqual(GENERAL_END_LIMIT);
  });

  it("잘라내더라도 강도 하한 아래로는 줄이지 않는다", () => {
    expect(layoutDay(멀리떨어진8곳, "대중교통", "빡빡하게").activities.length).toBeGreaterThanOrEqual(4);
  });

  it("뒤에서부터 덜어낼 때 필수 방문지는 건너뛴다", () => {
    // p7이 맨 뒤에 와서 평소라면 가장 먼저 잘려나간다. 필수 방문지로 표시하면 살아남아야 한다.
    const 장소들 = 멀리떨어진8곳.map((p, i) => (i === 7 ? { ...p, mustVisit: true } : p));
    const layout = layoutDay(장소들, "대중교통", "빡빡하게");
    const ids = layout.activities.map((a) => a.place.id);
    expect(ids).toContain("p7");
    expect(ids).not.toContain("p6");
    expect(layout.activities.length).toBeGreaterThanOrEqual(4);
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

  // 식사 체류는 뒤 활동을 미는 양을 정한다. 어떤 테스트도 이 값을 보지 않으면
  // 저녁을 90에서 30으로 바꿔도 전부 통과한다.
  it("식사 체류 시간을 종류별로 고정한다", () => {
    const acts = insertMeals(layoutDay(근접4곳, "자차", "빡빡하게"), 식사맵);
    const 체류 = (t: MealType) => acts.find((a) => a.mealType === t)!.stayMinutes;
    expect(체류("아침")).toBe(45);
    expect(체류("점심")).toBe(60);
    expect(체류("저녁")).toBe(90);
  });

  it("조회에 실패한 식사는 건너뛰고 나머지는 유지한다", () => {
    const 일부만 = new Map<MealType, ResolvedPlace>([["점심", 식당("점심")]]);
    expect(insertMeals(layoutDay(근접4곳, "자차", "빡빡하게"), 일부만).filter((a) => a.isMeal)).toHaveLength(1);
  });

  // 멀리떨어진8곳은 이동이 125분씩이라 점심이 하한으로 클램프돼 우연히 겹치지 않는다.
  // 근접4곳처럼 이동이 짧은 날이 실제로 겹치는 형태다.
  it.each([
    ["멀리떨어진8곳", 멀리떨어진8곳, "대중교통" as const],
    ["근접4곳", 근접4곳, "자차" as const],
    ["가까운8곳", 가까운8곳, "자차" as const],
  ])("어떤 활동도 다른 활동이 진행 중인 시각에 시작하지 않는다 (%s)", (_name, 장소들, 이동수단) => {
    const acts = insertMeals(layoutDay(장소들, 이동수단, "빡빡하게"), 식사맵);
    expect(hasOverlap(acts)).toBe(false);

    // hasOverlap은 production의 earliestStart를 그대로 쓴다. 그 정의가 틀려도
    // 검사와 교정이 같이 틀리므로 위 단언만으로는 아무것도 못 잡는다.
    // 여기서는 기대 간격을 좌표에서 직접 다시 계산해 독립적인 판정을 만든다.
    const general = acts.filter((a) => !a.isMeal);
    expect(general.length).toBeGreaterThan(1);
    for (let i = 1; i < general.length; i += 1) {
      const prev = general[i - 1];
      const cur = general[i];
      const 이동 = travelMinutes(prev.place, cur.place, 이동수단);
      expect(cur.startMinutes - prev.startMinutes).toBeGreaterThanOrEqual(prev.stayMinutes + 이동);
    }
  });

  it("점심 뒤 활동을 삭제하지 않고 뒤로 민다", () => {
    const layout = layoutDay(근접4곳, "자차", "빡빡하게");
    const before = layout.activities.map((a) => a.startMinutes);
    const acts = insertMeals(layout, 식사맵);

    // 일반 활동이 하나도 사라지지 않았다
    const general = acts.filter((a) => !a.isMeal);
    expect(general.map((a) => a.place.id)).toEqual(근접4곳.map((p) => p.id));

    // 점심 뒤 활동이 실제로 뒤로 밀렸다
    const lunch = acts.find((a) => a.mealType === "점심")!;
    const lunchEnd = lunch.startMinutes + lunch.stayMinutes;
    const afterLunch = general.filter((a) => a.startMinutes >= lunch.startMinutes);
    expect(afterLunch.length).toBeGreaterThan(0);
    expect(afterLunch[0].startMinutes).toBeGreaterThanOrEqual(lunchEnd);
    const movedIdx = 근접4곳.findIndex((p) => p.id === afterLunch[0].place.id);
    expect(afterLunch[0].startMinutes).toBeGreaterThan(before[movedIdx]);
  });

  // 아래 두 테스트는 layoutDay의 중간 산출물이 아니라 최종적으로 나가는 활동 배열을 본다.
  // layoutDay만 보면 식사 삽입 뒤에 깨지는 규칙을 놓친다.
  it("이미 불변식을 만족하는 저녁은 밀지 않는다", () => {
    const layout = layoutDay(근접4곳, "자차", "빡빡하게");
    const slot = layout.mealSlots.find((s) => s.mealType === "저녁")!;
    const acts = insertMeals(layout, 식사맵);

    const general = acts.filter((a) => !a.isMeal);
    const generalEnd = general[general.length - 1].startMinutes + general[general.length - 1].stayMinutes;
    const dinner = acts.find((a) => a.mealType === "저녁")!;

    // 마지막 일반 활동이 끝나는 시각이 저녁 슬롯보다 이르다 = 저녁은 밀 이유가 없다
    expect(generalEnd).toBeLessThanOrEqual(slot.atMinutes);
    expect(dinner.startMinutes).toBe(slot.atMinutes);
  });

  it("최종 일정의 일반 활동은 18시 + 중간에 낀 식사 시간 안에 끝난다", () => {
    const acts = insertMeals(layoutDay(가까운8곳, "자차", "빡빡하게"), 식사맵);

    const general = acts.filter((a) => !a.isMeal);
    const last = general[general.length - 1];
    const generalEnd = last.startMinutes + last.stayMinutes;

    // 첫 활동 이후~마지막 활동 이전에 끼어 뒤를 미는 식사만 센다.
    // 아침은 첫 활동 전에 끝나므로 아무것도 밀지 않는다.
    const 낀식사 = acts.filter(
      (a) => a.isMeal
        && a.startMinutes > general[0].startMinutes
        && a.startMinutes < last.startMinutes,
    );

    // 허용치를 낀식사의 실제 체류에서 끌어오면 식사 시간이 틀려도 허용치가 같이 늘어나
    // 테스트가 통과한다. 기대하는 점심 체류를 여기 못박고 실제 값과 대조한다.
    const 점심_체류 = 60;
    const 허용치 = 점심_체류;

    expect(낀식사.map((a) => a.mealType)).toEqual(["점심"]);
    expect(낀식사[0].stayMinutes).toBe(점심_체류);
    expect(generalEnd).toBeLessThanOrEqual(GENERAL_END_LIMIT + 허용치);
    // 넘어선 몫이 관광이 아니라 식사 때문임을 못박는다 — 관광 시간만 보면 18시 안이다.
    expect(generalEnd - 허용치).toBeLessThanOrEqual(GENERAL_END_LIMIT);
  });

  it("최종 일정에서도 저녁이 18:00~19:30 안에 든다", () => {
    const acts = insertMeals(layoutDay(가까운8곳, "자차", "빡빡하게"), 식사맵);
    const dinner = acts.find((a) => a.mealType === "저녁")!;
    expect(dinner.startMinutes).toBeGreaterThanOrEqual(GENERAL_END_LIMIT);
    expect(dinner.startMinutes).toBeLessThanOrEqual(1170);
  });

  it("원본 layout.activities를 변형하지 않는다", () => {
    const layout = layoutDay(근접4곳, "자차", "빡빡하게");
    const snapshot = layout.activities.map((a) => a.startMinutes);
    insertMeals(layout, 식사맵);
    expect(layout.activities.map((a) => a.startMinutes)).toEqual(snapshot);
  });
});
