import { describe, expect, it } from "vitest";
import { createTrace } from "../../server/itinerary/trace";

/** Date.now를 주입해 벽시계에 의존하지 않게 한다. */
function fakeClock(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[Math.min(i++, sequence.length - 1)];
}

describe("createTrace", () => {
  it("각 구간의 소요 시간을 직전 표시 시점 기준으로 잰다", () => {
    const trace = createTrace(fakeClock([0, 100, 350, 1000]));

    trace.mark("후보");
    trace.mark("검증");
    trace.mark("설명");

    expect(trace.marks()).toEqual([
      { stage: "후보", ms: 100 },
      { stage: "검증", ms: 250 },
      { stage: "설명", ms: 650 },
    ]);
  });

  it("합계는 시작부터 마지막 표시까지다", () => {
    const trace = createTrace(fakeClock([0, 100, 350]));

    trace.mark("후보");
    trace.mark("검증");

    expect(trace.total()).toBe(350);
  });

  it("표시가 없으면 합계는 0이다", () => {
    expect(createTrace(fakeClock([0])).total()).toBe(0);
  });

  it("한 줄 로그로 포맷한다", () => {
    const trace = createTrace(fakeClock([0, 100, 350]));

    trace.mark("후보");
    trace.mark("검증");

    expect(trace.format()).toBe("후보 100ms · 검증 250ms · 합계 350ms");
  });

  // 같은 이름을 여러 번 표시하는 경우가 있다 (일차별 식사 조회 등).
  it("같은 이름을 여러 번 표시해도 각각 남긴다", () => {
    const trace = createTrace(fakeClock([0, 10, 30, 60]));

    trace.mark("식사");
    trace.mark("식사");
    trace.mark("식사");

    expect(trace.marks()).toHaveLength(3);
    expect(trace.marks().map((m) => m.ms)).toEqual([10, 20, 30]);
  });
});
