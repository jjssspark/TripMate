import { Type, type GoogleGenAI } from "@google/genai";
import { formatTime } from "./schedule";
import { normalizeName } from "./routing";
import type { ScheduledDay } from "./types";

export type NarratedActivity = { title: string; description: string; tags: string[] };
export type NarratedDay = { theme: string; description: string; activities: NarratedActivity[] };

const REGION = /\S+[시군구](?=\s|$)/g;

/** 4단계가 실패했을 때. 지어내지 않고 이미 확보한 실제 데이터만 쓴다. */
export function minimalNarration(day: ScheduledDay, destination: string): NarratedDay {
  const regions = [
    ...new Set(
      day.activities
        .map((a) => a.place.address.match(REGION)?.at(-1))
        .filter((r): r is string => Boolean(r)),
    ),
  ];
  return {
    theme: `${destination} ${day.day}일차`,
    description: regions.length > 0 ? `${regions.join(", ")} 일대를 돕니다.` : `${destination} 일대를 돕니다.`,
    activities: day.activities.map((a) => ({
      title: a.place.name,
      description: `${a.place.address}에 있는 ${a.place.category}입니다.`,
      tags: [a.place.category],
    })),
  };
}

const NARRATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING, description: "이 날의 핵심 테마 제목" },
    description: { type: Type.STRING, description: "이 날 일정의 한 줄 요약" },
    activities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "주어진 목록의 장소 이름을 그대로 옮겨 적는다" },
          description: { type: Type.STRING, description: "2~3문장, 120자 이내. 그곳에서 뭘 하면 좋은지 실용 정보 위주" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "해시태그 2~3개" },
        },
        required: ["title", "description", "tags"],
      },
    },
  },
  required: ["theme", "description", "activities"],
} as const;

export async function narrateDay(
  ai: GoogleGenAI,
  day: ScheduledDay,
  destination: string,
): Promise<NarratedDay> {
  // 장소·순서·시각은 이미 확정됐다. 여기서는 글만 쓴다.
  const list = day.activities
    .map((a, i) => `${i + 1}. ${formatTime(a.startMinutes)} ${a.place.name} (${a.place.category}, ${a.place.address})`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${destination} 여행 ${day.day}일차 일정입니다. 순서와 장소는 이미 확정됐으니 바꾸지 마세요.

${list}

각 활동에 대해 여행 가이드북 톤의 존댓말 설명을 2~3문장, 120자 이내로 써주세요.
미사여구보다 그곳에서 뭘 하면 좋은지, 뭘 먹으면 좋은지 같은 실용 정보를 넣으세요.
activities 배열은 위 순서와 개수를 정확히 지켜주세요.
각 항목의 title에는 위 목록의 장소 이름을 그대로 옮겨 적으세요.`,
    config: {
      systemInstruction: "당신은 항상 정확한 JSON만 출력하는 여행 도우미입니다. 한국어로 응답하세요.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: NARRATE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error(`${day.day}일차 설명 응답이 비었습니다.`);

  let parsed;
  try {
    parsed = JSON.parse(text.trim()) as {
      theme: string;
      description: string;
      activities: Array<{ title?: string; description?: string; tags?: string[] }>;
    };
  } catch {
    throw new Error(`${day.day}일차 설명 응답이 JSON이 아닙니다.`);
  }

  if (!Array.isArray(parsed.activities) || parsed.activities.length !== day.activities.length) {
    throw new Error(`${day.day}일차 설명 개수 불일치: ${parsed.activities?.length} vs ${day.activities.length}`);
  }

  // 설명을 인덱스로 갖다 붙이므로 순서가 어긋나면 A 장소에 B 설명이 조용히 달린다.
  // 이름을 되돌려받아 대조한다. 어긋나면 던지고, 호출부가 minimalNarration으로 내린다.
  day.activities.forEach((a, i) => {
    const got = parsed.activities[i];
    if (!got || typeof got.description !== "string" || got.description.trim() === "") {
      throw new Error(`${day.day}일차 ${i + 1}번째 설명이 비었습니다.`);
    }
    if (normalizeName(got.title ?? "") !== normalizeName(a.place.name)) {
      throw new Error(`${day.day}일차 ${i + 1}번째 설명이 다른 장소의 것입니다.`);
    }
  });

  return {
    theme: parsed.theme,
    description: parsed.description,
    activities: day.activities.map((a, i) => ({
      title: a.place.name,
      description: parsed.activities[i].description as string,
      tags: parsed.activities[i].tags ?? [],
    })),
  };
}
