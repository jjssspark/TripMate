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
    expect(result.excludeNames).toEqual(["성산일출봉", "한라산"]);
  });

  it("목적지와 일수 같은 기본 조건은 유지한다", () => {
    const result = mergeFeedbackIntoRequest(base, "바꿔줘");
    expect(result.destination).toBe("제주도");
    expect(result.days).toBe(3);
  });
});
