import { runPipeline } from "../../server/itinerary/runner";
import { attachPhotos } from "../../server/places/photos";
import { parsePlanInput } from "../../server/itinerary/entry";
import { NotEnoughPlacesError } from "../../server/itinerary/pipeline";
import { QuotaExceededError } from "../../server/itinerary/quota";
import { ConfigMissingError } from "../../server/itinerary/config";
import type { NetlifyEvent } from "../../server/http/netlify";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fail = (statusCode: number, code: string, message: string, field: string | null = null) => ({
  statusCode, headers,
  body: JSON.stringify({ success: false, data: null, error: { code, message, field } }),
});

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail(400, "INVALID_JSON", "요청 형식이 올바르지 않습니다.");
  }

  const parsed = parsePlanInput(body ?? {});
  if (parsed.ok === false) return fail(400, parsed.code, parsed.message, parsed.field);

  const { request, days } = parsed.value;
  const destination = request.destination;
  const { startDate, endDate, companion, budget, intensity, transportMode, styles, mustVisitPlaces } = body;

  try {
    const { planContent, narrationDegraded } = await runPipeline(request);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        title: `${destination} ${days - 1}박 ${days}일 여행`,
        destination,
        startDate: startDate || new Date().toISOString().split("T")[0],
        endDate: endDate || new Date().toISOString().split("T")[0],
        duration: `${days - 1}박 ${days}일`,
        budget: budget || "표준형",
        companion: companion || "혼자",
        intensity: intensity || "여유롭게",
        transportMode: transportMode || "대중교통",
        styles: styles || [],
        mustVisitPlaces: mustVisitPlaces || "",
        planContent: await attachPhotos(planContent, destination),
        narrationDegraded,
      }),
    };
  } catch (err) {
    console.error("[TripMate] 일정 생성 실패:", err);
    // 장소 부족은 서버 오류가 아니라 조건 문제다. 무엇을 조정하면 되는지 그대로 내려보낸다.
    if (err instanceof NotEnoughPlacesError) {
      return fail(422, "NOT_ENOUGH_PLACES", err.message);
    }
    // 쿼터 소진도 서버 오류가 아니다. 조건을 바꿔도 소용없고, 기다리는 것 외에 할 일이 없다.
    if (err instanceof QuotaExceededError) {
      return fail(429, "AI_QUOTA_EXCEEDED", err.message);
    }
    // 설정 누락은 재시도로 풀리지 않는다. 500으로 뭉개면 "잠시 후 다시" 안내가 나가 헛되이 기다리게 된다.
    if (err instanceof ConfigMissingError) {
      console.error("[TripMate] 필수 환경변수 누락:", err.missing.join(", "));
      return fail(503, "SERVICE_NOT_CONFIGURED", err.message);
    }
    return fail(500, "PLAN_GENERATION_FAILED", "일정을 만들지 못했습니다. 조건을 조금 바꿔 다시 시도해 주세요.");
  }
};
