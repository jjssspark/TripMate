import type { PlanRequest } from "./pipeline";

/**
 * 수정은 파이프라인을 다시 태운다. LLM이 일정 전체를 다시 쓰면 중복·동선 불변식이 깨진다.
 *
 * 제외 장소는 comments 텍스트와 excludeNames 양쪽에 싣는다. comments는 후보 추출 프롬프트에만
 * 닿아 카카오 조회를 낭비하지 않게 미리 걸러주는 역할이고, excludeNames는 파이프라인이 후보·식당·
 * AT4 구제 결과에 코드로 직접 거는 필터라 실제로 다시 나오지 않는다는 걸 보장한다.
 */
/**
 * "장소를 바꿔 달라"는 뜻으로 읽히는 표현. 여기 없으면 이전 장소를 배제하지 않는다.
 *
 * 오탐이 미탐보다 훨씬 비싸다 — 오탐 한 번이 이전 장소를 전부 다시 금지한다.
 * 그래서 맨 "다시" 대신 "다시 추천"·"다시 짜"·"다시 만들"처럼 형태를 특정한다.
 * ("다시 저장해줘", "지도를 다시 보여줘"가 걸리면 안 된다.)
 *
 * "별로"도 같은 이유로 서술어 형태만 남긴다. 맨 "별로"는 부정과 짝을 이루는 부사가 훨씬 흔하다
 * ("시간이 별로 없어요", "별로 안 걷고 싶어요"). 이건 강도·분량 요청이라 "좀 더 여유롭게 해줘"와
 * 같은 부류고, 장소를 바꿔 달라는 뜻이 아니다. 잡아야 할 건 "여기 별로예요" 쪽이다.
 */
const CHANGE_KEYWORDS = [
  "다른", "바꿔", "바꾸", "변경", "말고", "새로운", "빼고", "제외",
  "교체", "별로예요", "별로네요", "별로였",
] as const;

/**
 * 여러 낱말로 된 키워드. 사용자가 띄어쓰기를 안 해도 뜻이 같으므로 양쪽 공백을 지우고 대조한다.
 * 한 낱말 키워드는 원문 그대로 둔다 — 공백을 지우면 단어 경계가 사라져
 * "정말 고마워요"가 말고로, "제 외국인"이 제외로 걸린다.
 * 여기 있는 키워드는 낱말 두 개가 붙어 있어야 성립해서 그 오탐이 나지 않는다.
 */
const CHANGE_PHRASES = ["마음에 안", "다시 추천", "다시 짜", "다시 만들"] as const;

const withoutSpaces = (text: string) => text.replace(/\s+/g, "");

/**
 * 어떤 피드백에나 이전 장소를 전부 배제하면 마음에 들었던 날의 장소까지 사라지고,
 * 후보가 적은 지역에서는 배제 후 하한 미달로 수정 자체가 실패한다.
 * 사용자가 장소를 바꿔 달라고 한 경우에만 배제한다.
 */
export function wantsDifferentPlaces(feedback: string): boolean {
  // 한 낱말 키워드는 원문 그대로 검사한다. 공백을 지우면 단어 경계가 사라져 "정말 고마워요"가
  // 말고로, "제 외국인"이 제외로 걸린다. 그 오탐 하나가 이전 장소를 전부 다시 금지한다.
  if (CHANGE_KEYWORDS.some((k) => feedback.includes(k))) return true;
  const compact = withoutSpaces(feedback);
  return CHANGE_PHRASES.some((k) => compact.includes(withoutSpaces(k)));
}

/** 두 진입점(express·netlify)이 같은 판정을 쓰도록 배제 목록 생성을 여기 둔다. */
export function excludeNamesFor(feedback: string, previousNames: readonly string[]): string[] {
  return wantsDifferentPlaces(feedback) ? [...previousNames] : [];
}

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
