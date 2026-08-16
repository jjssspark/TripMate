import type { PlanRequest } from "./pipeline";

/**
 * 수정은 파이프라인을 다시 태운다. LLM이 일정 전체를 다시 쓰면 중복·동선 불변식이 깨진다.
 *
 * 제외 장소는 comments 텍스트와 excludeNames 양쪽에 싣는다. comments는 후보 추출 프롬프트에만
 * 닿아 카카오 조회를 낭비하지 않게 미리 걸러주는 역할이고, excludeNames는 파이프라인이 후보·식당·
 * AT4 구제 결과에 코드로 직접 거는 필터라 실제로 다시 나오지 않는다는 걸 보장한다.
 */
export function mergeFeedbackIntoRequest(
  base: PlanRequest,
  feedback: string,
  excludePlaces: readonly string[] = [],
): PlanRequest {
  const parts = [base.comments, feedback].filter(Boolean);
  if (excludePlaces.length > 0) {
    parts.push(`다음 장소는 제외하고 다른 곳으로 추천하세요: ${excludePlaces.join(", ")}`);
  }
  return { ...base, comments: parts.join(" / "), excludeNames: excludePlaces };
}
