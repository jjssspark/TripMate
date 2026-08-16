import { runPipeline } from "../../server/itinerary/runner";
import { attachPhotos } from "../../server/places/photos";
import { parsePlanInput } from "../../server/itinerary/entry";
import { mergeFeedbackIntoRequest, excludeNamesFor } from "../../server/itinerary/revise";

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
    return fail(500, "PLAN_REVISION_FAILED", "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
};
