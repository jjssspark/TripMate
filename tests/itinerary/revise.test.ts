import { describe, it, expect } from "vitest";
import { mergeFeedbackIntoRequest, wantsDifferentPlaces, excludeNamesFor } from "../../server/itinerary/revise";
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
    expect(result.excludeNames).toEqual(["성산일출봉", "한라산"]);
  });

  it("목적지와 일수 같은 기본 조건은 유지한다", () => {
    const result = mergeFeedbackIntoRequest(base, "바꿔줘");
    expect(result.destination).toBe("제주도");
    expect(result.days).toBe(3);
  });
});

describe("wantsDifferentPlaces", () => {
  it.each([
    "가는 장소는 바꿔줘",
    "여기 말고 다른 데로",
    "코스를 바꾸고 싶어요",
    "2일차 일정을 변경해줘",
    "새로운 곳도 넣어줘",
    "성산일출봉은 빼고 짜줘",
    "쇼핑은 제외해 주세요",
    "다른곳으로해줘",
  ])("장소를 바꿔 달라는 문장을 잡는다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(true);
  });

  it.each([
    "2일차를 좀 더 여유롭게 해줘",
    "설명을 자세히 써줘",
    "이동 시간이 궁금해요",
    "",
  ])("장소 변경 의도가 없으면 false다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(false);
  });

  // 공백을 지우고 검사하면 단어 경계가 사라져 엉뚱한 문장이 걸린다.
  // "정말 고마워요" → "정말고마워요"에 말고가 들어간다. 원문 그대로 검사해야 한다.
  it.each([
    ["정말 고마워요 이대로 좋아요", "말고"],
    ["정말 고생하셨어요", "말고"],
    ["제 외국인 친구도 같이 가요", "제외"],
  ])("공백을 지우면 생기는 오탐을 잡지 않는다: %s (%s 오탐)", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(false);
  });
});

describe("excludeNamesFor", () => {
  const 이전장소 = ["성산일출봉", "한라산", "오는정김밥"];

  it("장소 변경 의도가 없으면 이전 장소를 배제하지 않는다", () => {
    expect(excludeNamesFor("2일차를 좀 더 여유롭게 해줘", 이전장소)).toEqual([]);
  });

  it("장소 변경 의도가 있으면 기존 배제 동작을 유지한다", () => {
    expect(excludeNamesFor("가는 장소는 바꿔줘", 이전장소)).toEqual(이전장소);
  });

  it("배제하지 않을 때는 병합된 요청의 excludeNames도 빈다", () => {
    const feedback = "설명을 자세히 써줘";
    const result = mergeFeedbackIntoRequest(base, feedback, excludeNamesFor(feedback, 이전장소));
    expect(result.excludeNames).toEqual([]);
    expect(result.comments).not.toContain("성산일출봉");
  });
});
