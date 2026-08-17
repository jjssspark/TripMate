import { runPipeline } from "../../server/itinerary/runner";
import { attachPhotos } from "../../server/places/photos";
import { parsePlanInput } from "../../server/itinerary/entry";
import { mergeFeedbackIntoRequest, excludeNamesFor } from "../../server/itinerary/revise";
import { NotEnoughPlacesError } from "../../server/itinerary/pipeline";
import { QuotaExceededError } from "../../server/itinerary/quota";
import { ConfigMissingError } from "../../server/itinerary/config";

// -------------------------------------------------------------
// Netlify Function Handler — 수정은 요청 조건에 피드백을 병합해 파이프라인을 다시 실행
// -------------------------------------------------------------
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fail = (statusCode: number, code: string, message: string, field: string | null = null) => ({
  statusCode, headers,
  body: JSON.stringify({ success: false, data: null, error: { code, message, field } }),
});

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail(400, "INVALID_JSON", "요청 형식이 올바르지 않습니다.");
  }

  const { planContent, feedback } = body;

  if (!Array.isArray(planContent) || typeof feedback !== "string" || !feedback.trim()) {
    return fail(400, "REVISE_INPUT_INVALID", "planContent, feedback가 모두 필요합니다.");
  }

  const parsed = parsePlanInput(body ?? {});
  if (parsed.ok === false) return fail(400, parsed.code, parsed.message, parsed.field);

  const { request } = parsed.value;
  const destination = request.destination;

  // 장소를 바꿔 달라는 피드백일 때만 이전 장소를 제외 지시로 넘긴다.
  const previousNames: string[] = planContent.flatMap((d: any) =>
    Array.isArray(d.activities) ? d.activities.map((a: any) => a.title) : [],
  );

  try {
    const { planContent: revised, narrationDegraded } = await runPipeline(
      mergeFeedbackIntoRequest(request, feedback, excludeNamesFor(feedback, previousNames)),
    );

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        planContent: await attachPhotos(revised, destination),
        narrationDegraded,
      }),
    };
  } catch (err) {
    console.error("[TripMate] 일정 수정 실패:", err);
    if (err instanceof NotEnoughPlacesError) {
      return fail(422, "NOT_ENOUGH_PLACES", err.message);
    }
    // 쿼터 소진은 서버 오류가 아니다. 다시 눌러도 소용없고, 기다리는 것 외에 할 일이 없다.
    if (err instanceof QuotaExceededError) {
      return fail(429, "AI_QUOTA_EXCEEDED", err.message);
    }
    // 설정 누락은 재시도로 풀리지 않는다. 500으로 뭉개면 "잠시 후 다시" 안내가 나가 헛되이 기다리게 된다.
    if (err instanceof ConfigMissingError) {
      console.error("[TripMate] 필수 환경변수 누락:", err.missing.join(", "));
      return fail(503, "SERVICE_NOT_CONFIGURED", err.message);
    }
    return fail(500, "PLAN_REVISION_FAILED", "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
};
