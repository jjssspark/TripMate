import type { PlanRequest } from "./pipeline";

/** 수정은 파이프라인을 다시 태운다. LLM이 일정 전체를 다시 쓰면 중복·동선 불변식이 깨진다. */
export function mergeFeedbackIntoRequest(
  base: PlanRequest,
  feedback: string,
  excludePlaces: readonly string[] = [],
): PlanRequest {
  const parts = [base.comments, feedback].filter(Boolean);
  if (excludePlaces.length > 0) {
    parts.push(`다음 장소는 제외하고 다른 곳으로 추천하세요: ${excludePlaces.join(", ")}`);
  }
  return { ...base, comments: parts.join(" / ") };
}
