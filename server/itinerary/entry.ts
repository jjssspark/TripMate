import type { Intensity, TransportMode } from "./types";
import type { PlanRequest } from "./pipeline";

export const MAX_DAYS = 14;

/**
 * 수정 요청에 실려 온 이전 일정에서 장소 이름만 모은다. 클라이언트가 보낸 JSON이라
 * 모양을 믿지 않고 문자열 제목만 집어 온다. 로컬 서버와 Netlify 함수가 같이 쓴다.
 */
export function collectPlaceNames(planContent: unknown[]): string[] {
  return planContent.flatMap((day) => {
    const activities = (day as { activities?: unknown })?.activities;
    if (!Array.isArray(activities)) return [];
    return activities
      .map((act) => (act as { title?: unknown })?.title)
      .filter((title): title is string => typeof title === "string");
  });
}
const DEFAULT_DAYS = 3;
const DAY_MS = 86_400_000;

export type ParsedPlan = { request: PlanRequest; days: number };
export type ParseResult =
  | { ok: true; value: ParsedPlan }
  | { ok: false; code: string; message: string; field: string | null };

/** 날짜가 없으면 기본값, 형식이 틀리면 null. null과 기본값을 구분해야 오류로 돌려보낼 수 있다. */
function countDays(startDate: unknown, endDate: unknown): number | null {
  if (typeof startDate !== "string" || typeof endDate !== "string" || !startDate || !endDate) {
    return DEFAULT_DAYS;
  }
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

export function parsePlanInput(body: Record<string, unknown>): ParseResult {
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return { ok: false, code: "DESTINATION_REQUIRED", message: "목적지를 입력해주세요.", field: "destination" };
  }

  const days = countDays(body.startDate, body.endDate);
  if (days === null) {
    return { ok: false, code: "TRIP_DATES_INVALID", message: "여행 날짜를 다시 확인해주세요.", field: "startDate" };
  }
  if (days > MAX_DAYS) {
    return {
      ok: false,
      code: "TRIP_TOO_LONG",
      message: `여행 기간은 최대 ${MAX_DAYS}일까지 만들 수 있습니다.`,
      field: "endDate",
    };
  }

  const intensity: Intensity = body.intensity === "빡빡하게" ? "빡빡하게" : "여유롭게";
  const transportMode: TransportMode =
    body.transportMode === "도보" ? "도보" : body.transportMode === "자차" ? "자차" : "대중교통";

  return {
    ok: true,
    value: {
      days,
      request: {
        destination,
        days,
        intensity,
        transportMode,
        styles: Array.isArray(body.styles) ? (body.styles as string[]) : [],
        mustVisitPlaces: typeof body.mustVisitPlaces === "string" ? body.mustVisitPlaces : "",
        comments: typeof body.comments === "string" ? body.comments : "",
        // 선택 입력이다. 없으면 필드 자체를 넣지 않아 프롬프트에서도 빠지게 한다.
        ...(typeof body.budget === "string" && body.budget.trim()
          ? { budget: body.budget.trim() } : {}),
        ...(typeof body.companion === "string" && body.companion.trim()
          ? { companion: body.companion.trim() } : {}),
      },
    },
  };
}
