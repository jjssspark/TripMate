import { Type, type GoogleGenAI } from "@google/genai";
import type { Intensity, TransportMode } from "./types";
import type { PlanRequest } from "./pipeline";

/**
 * 수정 요청을 파이프라인이 실제로 받아들이는 조건으로 옮긴 것.
 *
 * 이전에는 피드백을 comments 문자열에만 실었다. comments는 후보 추출 프롬프트의
 * "추가 요청" 한 줄에만 닿고, 그 뒤 날짜 배정·순서 결정·시각 배치는 전부 결정론적이라
 * "여유롭게 해줘" 같은 요청이 결과를 한 글자도 바꾸지 못했다.
 *
 * 여기 있는 필드는 전부 PlanRequest에 대응한다. 대응하지 않는 요청은 애초에 담지 않는다 —
 * 담아 봐야 반영되지 않고, 반영된 척하는 것이 가장 나쁘다.
 */
export type FeedbackIntent = {
  intensity?: Intensity;
  transportMode?: TransportMode;
  addStyles?: string[];
  addPlaces?: string[];
  /** "다 바꿔줘" — 이전 일정의 장소를 전부 배제한다. */
  replaceAllPlaces?: boolean;
  /** 특정 장소만 뺀다. 이전 일정에 실제로 있던 이름만 남긴다. */
  excludePlaces?: string[];
};

/** 설명과 같은 경량 모델을 쓴다. 후보 추출(flash)과 한도 버킷을 갈라 놓기 위해서다. */
const INTENT_MODEL = "gemini-2.5-flash-lite";

const INTENSITIES: readonly Intensity[] = ["여유롭게", "빡빡하게"];
const TRANSPORT_MODES: readonly TransportMode[] = ["도보", "대중교통", "자차"];

const INTENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intensity: { type: Type.STRING, enum: [...INTENSITIES], description: "일정 강도를 바꿔 달라는 요청일 때만" },
    transportMode: { type: Type.STRING, enum: [...TRANSPORT_MODES], description: "이동수단을 바꿔 달라는 요청일 때만" },
    addStyles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "추가로 반영할 취향. 예: 카페, 자연, 쇼핑" },
    addPlaces: { type: Type.ARRAY, items: { type: Type.STRING }, description: "새로 넣어 달라는 장소의 고유 상호명" },
    replaceAllPlaces: { type: Type.BOOLEAN, description: "장소를 전부 다른 곳으로 바꿔 달라는 요청일 때만 true" },
    excludePlaces: { type: Type.ARRAY, items: { type: Type.STRING }, description: "빼 달라는 장소. 현재 일정에 있는 이름만" },
  },
} as const;

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(nonEmpty).map((s) => s.trim());
  return items.length > 0 ? items : undefined;
}

/**
 * 모델 출력을 그대로 믿지 않는다. 스키마에 enum을 걸어도 값이 어긋나 오는 경우가 있고,
 * 없는 장소를 지어내면 배제해도 아무 효과가 없으면서 후보만 줄어든다.
 */
function sanitize(raw: Record<string, unknown>, previousNames: readonly string[]): FeedbackIntent {
  const intent: FeedbackIntent = {};

  if (INTENSITIES.includes(raw.intensity as Intensity)) intent.intensity = raw.intensity as Intensity;
  if (TRANSPORT_MODES.includes(raw.transportMode as TransportMode)) {
    intent.transportMode = raw.transportMode as TransportMode;
  }

  const styles = stringList(raw.addStyles);
  if (styles) intent.addStyles = styles;

  const places = stringList(raw.addPlaces);
  if (places) intent.addPlaces = places;

  if (raw.replaceAllPlaces === true) intent.replaceAllPlaces = true;

  const known = new Set(previousNames);
  const exclude = stringList(raw.excludePlaces)?.filter((n) => known.has(n));
  if (exclude && exclude.length > 0) intent.excludePlaces = exclude;

  return intent;
}

/**
 * 분류가 실패해도 수정 자체를 막지 않는다. 조건 없이 재생성하는 편이,
 * 사용자에게 "수정할 수 없다"고 돌려보내는 것보다 낫다.
 */
export async function classifyFeedback(
  ai: GoogleGenAI,
  feedback: string,
  previousNames: readonly string[],
): Promise<FeedbackIntent> {
  try {
    const response = await ai.models.generateContent({
      model: INTENT_MODEL,
      contents: `사용자가 여행 일정을 이렇게 수정해 달라고 했습니다.

"${feedback}"

현재 일정의 장소: ${previousNames.join(", ") || "없음"}

이 요청을 아래 항목으로 옮겨 적으세요. 해당하지 않는 항목은 넣지 마세요.
요청에 없는 내용을 추측해서 채우지 마세요.
빼 달라는 장소는 위 목록에 있는 이름만 그대로 쓰세요.`,
      config: {
        systemInstruction: "당신은 요청을 구조화된 JSON으로만 옮기는 분류기입니다.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: INTENT_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return {};

    const parsed: unknown = JSON.parse(text.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return sanitize(parsed as Record<string, unknown>, previousNames);
  } catch {
    return {};
  }
}

const APPLIED_LABEL = {
  intensity: "일정 강도",
  transportMode: "이동수단",
  styles: "선호 스타일",
  mustVisit: "필수 방문지",
  replaceAll: "장소 전체 교체",
  exclude: "일부 장소 제외",
} as const;

/**
 * 의도를 요청 조건에 얹는다. 무엇이 실제로 바뀌었는지 applied로 함께 돌려준다.
 *
 * applied가 비어 있으면 호출부는 "수정했다"고 말하면 안 된다. 결정론적 파이프라인이라
 * 조건이 같으면 결과도 같은데, 그걸 수정이라고 안내하면 사용자는 자기 요청이 무시된 걸
 * 알 방법이 없다.
 */
export function applyIntent(
  base: PlanRequest,
  feedback: string,
  intent: FeedbackIntent,
  previousNames: readonly string[],
): { request: PlanRequest; applied: string[] } {
  const applied: string[] = [];
  const request: PlanRequest = { ...base };

  if (intent.intensity && intent.intensity !== base.intensity) {
    request.intensity = intent.intensity;
    applied.push(APPLIED_LABEL.intensity);
  }

  if (intent.transportMode && intent.transportMode !== base.transportMode) {
    request.transportMode = intent.transportMode;
    applied.push(APPLIED_LABEL.transportMode);
  }

  const newStyles = (intent.addStyles ?? []).filter((s) => !base.styles.includes(s));
  if (newStyles.length > 0) {
    request.styles = [...base.styles, ...newStyles];
    applied.push(APPLIED_LABEL.styles);
  }

  const addPlaces = intent.addPlaces ?? [];
  if (addPlaces.length > 0) {
    const existing = base.mustVisitPlaces.split(",").map((s) => s.trim()).filter(Boolean);
    const merged = [...existing, ...addPlaces.filter((p) => !existing.includes(p))];
    request.mustVisitPlaces = merged.join(", ");
    applied.push(APPLIED_LABEL.mustVisit);
  }

  // 넣어 달라고 한 장소를 동시에 배제하면 모순이다. 추가 쪽을 우선한다.
  const keep = new Set(addPlaces);
  if (intent.replaceAllPlaces) {
    request.excludeNames = previousNames.filter((n) => !keep.has(n));
    applied.push(APPLIED_LABEL.replaceAll);
  } else if (intent.excludePlaces && intent.excludePlaces.length > 0) {
    const exclude = intent.excludePlaces.filter((n) => !keep.has(n));
    if (exclude.length > 0) {
      request.excludeNames = exclude;
      applied.push(APPLIED_LABEL.exclude);
    }
  }

  // 원문은 후보 추출 프롬프트에 힌트로 남긴다. 다만 반영을 보장하지 못하므로 applied에는 넣지 않는다.
  request.comments = [base.comments, feedback].filter(Boolean).join(" / ");

  return { request, applied };
}
