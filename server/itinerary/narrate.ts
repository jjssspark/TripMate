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

const DAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.INTEGER, description: "몇 일차인지" },
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
  required: ["day", "theme", "description", "activities"],
} as const;

const NARRATE_SCHEMA = {
  type: Type.OBJECT,
  properties: { days: { type: Type.ARRAY, items: DAY_SCHEMA } },
  required: ["days"],
} as const;

type RawDay = {
  day?: number;
  theme?: string;
  description?: string;
  activities?: Array<{ title?: string; description?: string; tags?: string[] }>;
};

/** 응답 일차가 순서대로 온다는 보장이 없다. day 번호로 맞추고, 없으면 인덱스로 떨어뜨린다. */
function pickRaw(raw: RawDay[], day: ScheduledDay, index: number): RawDay | undefined {
  return raw.find((r) => r.day === day.day) ?? raw[index];
}

/** 한 일차의 응답이 쓸 수 있는지 본다. 하나라도 어긋나면 그 일차만 버린다. */
function validate(got: RawDay | undefined, day: ScheduledDay): NarratedDay | null {
  const items = got?.activities;
  if (!got || !Array.isArray(items)) return null;
  if (items.length !== day.activities.length) return null;

  // 설명을 인덱스로 갖다 붙이므로 순서가 어긋나면 A 장소에 B 설명이 조용히 달린다.
  // 이름을 되돌려받아 대조한다.
  for (const [i, a] of day.activities.entries()) {
    const item = items[i];
    if (typeof item?.description !== "string" || item.description.trim() === "") return null;
    if (normalizeName(item.title ?? "") !== normalizeName(a.place.name)) return null;
  }

  return {
    theme: got.theme ?? `${day.day}일차`,
    description: got.description ?? "",
    activities: day.activities.map((a, i) => ({
      title: a.place.name,
      description: items[i].description as string,
      tags: items[i].tags ?? [],
    })),
  };
}

/**
 * 여행 전체 설명을 한 번의 호출로 받는다. 일차마다 부르면 3일 일정에 후보 추출까지 4회를 쓰는데,
 * 무료 티어 한도가 모델당 하루 20회라 일정 다섯 건이면 바닥난다.
 *
 * 검증은 일차별로 한다. 어긋난 일차만 null로 내려보내고 나머지는 살린다.
 * 호출 자체가 실패하면 그대로 던진다 — 쿼터 소진인지 판별하는 건 호출부의 몫이다.
 */
export async function narrateTrip(
  ai: GoogleGenAI,
  days: ScheduledDay[],
  destination: string,
): Promise<Array<NarratedDay | null>> {
  // 장소·순서·시각은 이미 확정됐다. 여기서는 글만 쓴다.
  const list = days
    .map((day) => {
      const lines = day.activities
        .map((a, i) => `  ${i + 1}. ${formatTime(a.startMinutes)} ${a.place.name} (${a.place.category}, ${a.place.address})`)
        .join("\n");
      return `[${day.day}일차]\n${lines}`;
    })
    .join("\n\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${destination} 여행 ${days.length}일 일정입니다. 순서와 장소는 이미 확정됐으니 바꾸지 마세요.

${list}

각 활동에 대해 여행 가이드북 톤의 존댓말 설명을 2~3문장, 120자 이내로 써주세요.
미사여구보다 그곳에서 뭘 하면 좋은지, 뭘 먹으면 좋은지 같은 실용 정보를 넣으세요.
days 배열에 ${days.length}개 일차를 모두 담고, day 필드에 몇 일차인지 적으세요.
각 일차의 activities 배열은 위 순서와 개수를 정확히 지켜주세요.
각 항목의 title에는 위 목록의 장소 이름을 그대로 옮겨 적으세요.`,
    config: {
      systemInstruction: "당신은 항상 정확한 JSON만 출력하는 여행 도우미입니다. 한국어로 응답하세요.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: NARRATE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("설명 응답이 비었습니다.");

  let parsed: { days?: RawDay[] };
  try {
    parsed = JSON.parse(text.trim()) as { days?: RawDay[] };
  } catch {
    throw new Error("설명 응답이 JSON이 아닙니다.");
  }

  const raw = Array.isArray(parsed.days) ? parsed.days : [];
  return days.map((day, i) => validate(pickRaw(raw, day, i), day));
}
