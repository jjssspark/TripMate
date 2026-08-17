export type TraceMark = { stage: string; ms: number };

/**
 * 파이프라인 단계별 소요 시간을 모아 한 줄로 남긴다.
 *
 * 어디서 예산을 쓰는지 모르면 타임아웃 숫자를 아무리 조정해도 추측이 된다.
 * TS-031에서도 "1.36초 만에 실패"라는 소요 시간 하나가 첫 가설을 반증했다.
 */
export function createTrace(now: () => number = Date.now) {
  const start = now();
  let last = start;
  const marks: TraceMark[] = [];

  return {
    mark(stage: string): void {
      const at = now();
      marks.push({ stage, ms: at - last });
      last = at;
    },
    marks(): readonly TraceMark[] {
      return marks;
    },
    total(): number {
      return last - start;
    },
    format(): string {
      return [...marks.map((m) => `${m.stage} ${m.ms}ms`), `합계 ${last - start}ms`].join(" · ");
    },
  };
}

export type Trace = ReturnType<typeof createTrace>;
