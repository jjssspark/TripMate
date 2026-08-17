import { describe, expect, it, vi } from "vitest";
import { applyIntent, classifyFeedback, type FeedbackIntent } from "../../server/itinerary/intent";
import type { PlanRequest } from "../../server/itinerary/pipeline";

const BASE: PlanRequest = {
  destination: "제주도",
  days: 3,
  intensity: "여유롭게",
  transportMode: "대중교통",
  styles: ["맛집"],
  mustVisitPlaces: "",
  comments: "",
};

const 이전장소 = ["성산일출봉", "함덕해수욕장", "카페delmoondo"];

function apply(intent: FeedbackIntent, feedback = "피드백") {
  return applyIntent(BASE, feedback, intent, 이전장소);
}

describe("applyIntent", () => {
  it("강도를 바꾸면 요청에 반영하고 applied에 남긴다", () => {
    const { request, applied } = apply({ intensity: "빡빡하게" });

    expect(request.intensity).toBe("빡빡하게");
    expect(applied).toContain("일정 강도");
  });

  // 같은 값을 다시 지정한 건 반영이 아니다. 반영했다고 말하면 거짓말이 된다.
  it("기존과 같은 강도면 applied에 넣지 않는다", () => {
    const { applied } = apply({ intensity: "여유롭게" });

    expect(applied).toHaveLength(0);
  });

  it("이동수단을 바꾸면 반영한다", () => {
    const { request, applied } = apply({ transportMode: "자차" });

    expect(request.transportMode).toBe("자차");
    expect(applied).toContain("이동수단");
  });

  it("스타일은 기존 것에 더한다", () => {
    const { request, applied } = apply({ addStyles: ["카페", "자연"] });

    expect(request.styles).toEqual(["맛집", "카페", "자연"]);
    expect(applied).toContain("선호 스타일");
  });

  it("이미 있는 스타일만 요청하면 반영으로 치지 않는다", () => {
    const { request, applied } = apply({ addStyles: ["맛집"] });

    expect(request.styles).toEqual(["맛집"]);
    expect(applied).toHaveLength(0);
  });

  it("장소 추가는 필수 방문지에 넣는다", () => {
    const { request, applied } = apply({ addPlaces: ["우도"] });

    expect(request.mustVisitPlaces).toBe("우도");
    expect(applied).toContain("필수 방문지");
  });

  it("기존 필수 방문지가 있으면 콤마로 잇는다", () => {
    const base = { ...BASE, mustVisitPlaces: "한라산" };

    const { request } = applyIntent(base, "우도도 가고 싶어", { addPlaces: ["우도"] }, 이전장소);

    expect(request.mustVisitPlaces).toBe("한라산, 우도");
  });

  it("전부 바꿔 달라면 이전 장소를 전부 배제한다", () => {
    const { request, applied } = apply({ replaceAllPlaces: true });

    expect(request.excludeNames).toEqual(이전장소);
    expect(applied).toContain("장소 전체 교체");
  });

  it("특정 장소만 빼 달라면 그것만 배제한다", () => {
    const { request, applied } = apply({ excludePlaces: ["성산일출봉"] });

    expect(request.excludeNames).toEqual(["성산일출봉"]);
    expect(applied).toContain("일부 장소 제외");
  });

  // 배제와 필수 방문이 겹치면 파이프라인이 필수 방문을 우선한다. 애초에 모순을 만들지 않는다.
  it("추가하려는 장소는 배제 목록에서 뺀다", () => {
    const { request } = apply({ replaceAllPlaces: true, addPlaces: ["성산일출봉"] });

    expect(request.excludeNames).not.toContain("성산일출봉");
    expect(request.mustVisitPlaces).toBe("성산일출봉");
  });

  it("피드백 원문은 항상 comments에 남긴다", () => {
    const { request } = apply({}, "좀 더 여유롭게 해줘");

    expect(request.comments).toContain("좀 더 여유롭게 해줘");
  });

  it("기존 comments가 있으면 뒤에 잇는다", () => {
    const base = { ...BASE, comments: "아이 동반" };

    const { request } = applyIntent(base, "카페 추가", {}, 이전장소);

    expect(request.comments).toBe("아이 동반 / 카페 추가");
  });

  // 이게 핵심이다. 반영된 게 없으면 호출부가 "수정했어요"라고 말하면 안 된다.
  it("반영된 조건이 없으면 applied가 빈 배열이다", () => {
    const { applied } = apply({});

    expect(applied).toEqual([]);
  });

  it("여러 의도를 한 번에 반영한다", () => {
    const { request, applied } = apply({ intensity: "빡빡하게", transportMode: "자차", addStyles: ["자연"] });

    expect(request.intensity).toBe("빡빡하게");
    expect(request.transportMode).toBe("자차");
    expect(request.styles).toEqual(["맛집", "자연"]);
    expect(applied).toHaveLength(3);
  });

  it("원본 요청을 변경하지 않는다", () => {
    apply({ intensity: "빡빡하게", addStyles: ["자연"], addPlaces: ["우도"] });

    expect(BASE.intensity).toBe("여유롭게");
    expect(BASE.styles).toEqual(["맛집"]);
    expect(BASE.mustVisitPlaces).toBe("");
  });
});

function fakeAi(reply: unknown) {
  const generateContent = vi.fn(async (_req: { model: string; config: Record<string, unknown> }) => ({
    text: typeof reply === "string" ? reply : JSON.stringify(reply),
  }));
  return { ai: { models: { generateContent } } as never, generateContent };
}

describe("classifyFeedback", () => {
  it("모델이 준 의도를 그대로 돌려준다", async () => {
    const { ai } = fakeAi({ intensity: "빡빡하게", addStyles: ["자연"] });

    const intent = await classifyFeedback(ai, "더 알차게 다녀보고 싶어", 이전장소);

    expect(intent).toEqual({ intensity: "빡빡하게", addStyles: ["자연"] });
  });

  // 분류 실패로 수정 전체를 막지 않는다. 조건 없이 재생성하는 편이 낫다.
  it("응답이 JSON이 아니면 빈 의도를 돌려준다", async () => {
    const { ai } = fakeAi("이건 JSON이 아닙니다");

    expect(await classifyFeedback(ai, "아무 말", 이전장소)).toEqual({});
  });

  it("호출이 실패해도 빈 의도를 돌려준다", async () => {
    const ai = {
      models: { generateContent: vi.fn(async () => { throw new Error("boom"); }) },
    } as never;

    expect(await classifyFeedback(ai, "아무 말", 이전장소)).toEqual({});
  });

  it("허용하지 않는 강도 값은 버린다", async () => {
    const { ai } = fakeAi({ intensity: "적당히" });

    expect(await classifyFeedback(ai, "적당히 해줘", 이전장소)).toEqual({});
  });

  it("허용하지 않는 이동수단 값은 버린다", async () => {
    const { ai } = fakeAi({ transportMode: "비행기" });

    expect(await classifyFeedback(ai, "비행기로", 이전장소)).toEqual({});
  });

  // 모델이 일정에 없던 장소를 지어내면 배제해도 아무 효과가 없다.
  it("이전 일정에 없는 장소는 제외 목록에서 버린다", async () => {
    const { ai } = fakeAi({ excludePlaces: ["성산일출봉", "존재하지않는곳"] });

    const intent = await classifyFeedback(ai, "성산일출봉 빼줘", 이전장소);

    expect(intent.excludePlaces).toEqual(["성산일출봉"]);
  });

  it("설명 모델과 같은 경량 모델을 써서 후보 추출 한도를 건드리지 않는다", async () => {
    const { ai, generateContent } = fakeAi({});

    await classifyFeedback(ai, "아무 말", 이전장소);

    expect(generateContent.mock.calls[0][0].model).toBe("gemini-2.5-flash-lite");
  });
});
