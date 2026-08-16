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
    "1일차 장소를 교체해줘",
    "다시 추천해줘",
    "카페 위주로 다시 짜줘",
    "처음부터 다시 만들어줘",
    "마음에 안 들어요",
    "여기 별로예요",
  ])("바꿔 달라는 뜻의 일상적인 표현도 잡는다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(true);
  });

  it.each([
    "2일차를 좀 더 여유롭게 해줘",
    "설명을 자세히 써줘",
    "이동 시간이 궁금해요",
    // 맨 "다시"를 키워드로 넣으면 여기서 오탐이 난다. 특정 형태만 넣는 이유다.
    "다시 저장해줘",
    "지도를 다시 보여줘",
    "",
  ])("장소 변경 의도가 없으면 false다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(false);
  });

  // 맨 "별로"는 부정과 짝을 이루는 흔한 부사다("별로 없다", "별로 안 ~"). 이걸 키워드로 두면
  // 시간·예산·체력 이야기가 전부 장소 변경으로 읽혀 이전 장소가 통째로 금지된다.
  // "별로 안 힘들게" 류는 "좀 더 여유롭게"와 같은 강도 요청이라 위 NEGATIVE 목록과 같은 부류다.
  it.each([
    "시간이 별로 없어요",
    "예산이 별로 없어서 저렴하게 해줘",
    "체력이 별로 없어요 여유롭게 해주세요",
    "설명이 별로 없어서 자세히 써줘",
    "이동이 별로 안 길었으면 좋겠어요",
    "첫날은 별로 안 걷고 싶어요",
  ])("부사 별로(=많지 않다)는 장소 변경으로 읽지 않는다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(false);
  });

  it.each([
    "여기 별로예요",
    "이 코스 별로네요",
    "어제 간 곳은 별로였어요",
  ])("서술어 별로(=마음에 들지 않는다)는 장소 변경으로 잡는다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(true);
  });

  // 여러 낱말로 된 키워드는 사용자가 띄어쓰기를 안 해도 같은 뜻이다.
  // 원문 대조만 하면 "마음에 안 들어요"는 잡히고 "마음에안들어요"는 놓친다.
  it.each([
    "마음에안들어요",
    "다시추천해줘",
    "다시짜줘",
    "다시만들어줘",
  ])("여러 낱말 키워드는 띄어쓰기가 없어도 잡는다: %s", (feedback) => {
    expect(wantsDifferentPlaces(feedback)).toBe(true);
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
