const PACIFIC = "America/Los_Angeles";
const SEOUL = "Asia/Seoul";

/**
 * 무료 티어 일 한도(RPD)를 다 썼을 때. 진짜 서버 오류와 섞이면 사용자는 무엇을 해야 할지 알 수 없다.
 * message는 그대로 사용자에게 나가므로 모델명·쿼터 지표 같은 내부 정보를 넣지 않는다.
 */
export class QuotaExceededError extends Error {
  constructor(readonly resetLabel: string) {
    super(`오늘 무료 AI 사용량을 다 썼습니다. ${resetLabel} 이후 다시 시도해 주세요.`);
    this.name = "QuotaExceededError";
  }
}

/** @google/genai의 ApiError는 status만 숫자로 달고 본문은 message 문자열에 JSON으로 담는다. */
export function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if ((err as { status?: unknown }).status === 429) return true;
  return err.message.includes("RESOURCE_EXHAUSTED");
}

function partsIn(timeZone: string, at: Date): Record<string, number> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  // en-US는 자정을 24로 내놓는다. 0시로 되돌리지 않으면 날짜 계산이 하루 어긋난다.
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** 주어진 지역시각(y,m,d,h)이 가리키는 UTC 순간. 오프셋을 모르므로 한 번 되돌려 보정한다. */
function zonedToUtc(timeZone: string, y: number, m: number, d: number, h: number): Date {
  let ts = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 2; i++) {
    const got = partsIn(timeZone, new Date(ts));
    ts += Date.UTC(y, m - 1, d, h) - Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
  }
  return new Date(ts);
}

/**
 * 무료 티어 RPD는 태평양시 자정에 리셋된다. 서머타임 때문에 한국시간 환산값이 16시/17시로 움직이므로
 * 하드코딩하면 1년의 절반은 틀린 안내가 나간다. 실제 다음 자정을 잡아 한국시간으로 옮긴다.
 */
export function nextResetLabel(now: Date = new Date()): string {
  const today = partsIn(PACIFIC, now);
  const midnight = zonedToUtc(PACIFIC, today.year, today.month, today.day + 1, 0);
  const hour = partsIn(SEOUL, midnight).hour;
  const meridiem = hour < 12 ? "오전" : "오후";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `한국시간 ${meridiem} ${display}시`;
}

/** 쿼터 오류면 사용자에게 내보낼 형태로 바꾸고, 아니면 원래 오류를 그대로 돌려준다. */
export function toQuotaError(err: unknown, now: Date = new Date()): unknown {
  return isQuotaError(err) ? new QuotaExceededError(nextResetLabel(now)) : err;
}
