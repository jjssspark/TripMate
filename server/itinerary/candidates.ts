import { Type, type GoogleGenAI } from "@google/genai";
import { INTENSITY_RANGE } from "./types";
import type { Candidate, Intensity, PlaceCategory } from "./types";

const MAX_CANDIDATES = 60;
const OVERSAMPLE = 2.5;

/** 필요량보다 넉넉히 받아야 3단계에서 고를 수 있고, 같은 조건에도 결과가 달라진다. */
export function candidateCount(days: number, intensity: Intensity): number {
  const need = days * INTENSITY_RANGE[intensity].max;
  return Math.min(MAX_CANDIDATES, Math.ceil(need * OVERSAMPLE));
}

export type CandidateInput = {
  destination: string;
  days: number;
  intensity: Intensity;
  styles: string[];
  mustVisitPlaces: string;
  comments: string;
  budget?: string;
  companion?: string;
};

export function buildCandidatePrompt(input: CandidateInput): string {
  const count = candidateCount(input.days, input.intensity);
  // 값이 없는 줄은 아예 만들지 않는다. 빈 줄이나 "없음"이 프롬프트를 흐린다.
  const optional = [
    input.companion ? `- 동행자 유형: ${input.companion}` : null,
    input.budget ? `- 예산 수준: ${input.budget}` : null,
  ].filter((line): line is string => line !== null);

  return `당신은 한국 국내 여행 전문 가이드입니다.
${input.destination} 여행에서 가볼 만한 장소 ${count}곳의 이름과 분류만 알려주세요.

[조건]
- 선호 스타일: ${input.styles.join(", ") || "제한 없음"}
${optional.length > 0 ? `${optional.join("\n")}\n` : ""}- 반드시 포함할 장소: ${input.mustVisitPlaces || "없음"}
- 추가 요청: ${input.comments || "없음"}

[규칙]
1. 반드시 포함할 장소가 있으면 목록 맨 앞에 그대로 넣으세요.
2. 검색하면 실제로 나오는 고유한 상호명·지명만 쓰세요. "로컬 맛집", "인기 명소 1" 같은 일반명사는 금지합니다.
3. 식당과 카페는 넣지 마세요. 식사 장소는 따로 정합니다.
4. 시간, 좌표, 부연을 붙이지 마세요. 이름과 분류만 필요합니다.
5. 한 지역에 몰리지 않게 ${input.destination} 전역에서 고르게 뽑으세요.`;
}

export const CANDIDATE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "실제 존재하는 장소의 고유 명칭" },
      category: {
        type: Type.STRING,
        enum: ["관광", "자연", "문화", "쇼핑", "액티비티"],
        description: "관광, 자연, 문화, 쇼핑, 액티비티 중 하나",
      },
    },
    required: ["name", "category"],
  },
} as const;

const ALLOWED: readonly PlaceCategory[] = ["관광", "자연", "문화", "쇼핑", "액티비티"];

export async function fetchCandidates(ai: GoogleGenAI, input: CandidateInput): Promise<Candidate[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildCandidatePrompt(input),
    config: {
      systemInstruction: "당신은 항상 정확한 JSON 배열만 출력합니다. 한국어로 응답하세요.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: CANDIDATE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("후보 추출 응답이 비었습니다.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error("후보 추출 응답이 JSON이 아닙니다.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("후보 추출 응답이 배열이 아닙니다.");
  }

  return (parsed as Array<{ name?: string; category?: string }>)
    .filter((c): c is { name: string; category?: string } => Boolean(c.name))
    .map((c) => ({
      name: c.name,
      category: (ALLOWED as readonly string[]).includes(c.category ?? "")
        ? (c.category as PlaceCategory)
        : ("관광" as PlaceCategory),
    }));
}
