export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: ${ms}ms 초과`);
    this.name = "TimeoutError";
  }
}

// 외부 호출은 스스로 멈추지 않는다. 단계마다 예산을 걸어 전체 30초를 지킨다.
export function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    task.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
