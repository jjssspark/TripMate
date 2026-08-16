import { GoogleGenAI, Type } from "@google/genai";
import { fetchRealPlacePhotoRef, getMockupImage } from "../../server/places/photos";

// -------------------------------------------------------------
// Netlify Function Handler — 기존 planContent + 사용자 피드백을 Gemini에 보내 수정
// -------------------------------------------------------------
export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: "Method Not Allowed" }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Invalid JSON body" }) };
  }

  const { destination, budget, companion, planContent, feedback } = body;

  if (!destination || !Array.isArray(planContent) || !feedback) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, message: "destination, planContent, feedback가 모두 필요합니다." }),
    };
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey && apiKey.trim() !== "") {
    try {
      ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    } catch (err) {
      console.error("★ [Netlify Function] GoogleGenAI 클라이언트 초기화 실패:", err);
    }
  }

  if (!ai) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, message: "AI 서버가 설정되지 않아 피드백을 반영할 수 없습니다." }),
    };
  }

  const prompt = `당신은 세계적인 여행 가이드이자 전문 AI 여행 컨시어지입니다.
아래는 사용자가 이미 만들어 둔 여행 일정입니다. 사용자의 피드백을 반영해 이 일정을 자연스럽게 수정해주세요.

[기존 여행 일정 (JSON)]
${JSON.stringify(planContent)}

[여행 기본 정보]
- 목적지: ${destination}
- 예산 수준: ${budget || "표준형"}
- 동행자 유형: ${companion || "혼자"}

[사용자 피드백]
"${feedback}"

[수정 지침]
1. 사용자 피드백과 직접 관련 없는 부분(테마, 시간대, 필수 방문 장소 등)은 최대한 그대로 유지하세요.
2. 피드백이 특정 스타일(예: "맛집 위주로 바꿔줘", "좀 더 여유롭게 해줘")을 요청하면 관련 활동들을 그 방향에 맞게 교체하거나 조정하세요.
3. 각 Day의 activities 배열 구조(아침/점심/저녁 식사 3개 포함)는 기존과 동일하게 유지하세요.
4. 모든 장소의 title은 실제로 존재하는 구체적인 상호명(가게 이름)으로 작성하세요. "현지맛집"처럼 일반명사로 뭉뚱그리지 마세요.
5. 모든 활동에 대해 실제 위도(latitude)와 경도(longitude) 값을 반드시 포함하세요.

반드시 명시된 JSON 스키마를 준수하여, 수정이 반영된 전체 일정(day별 배열)을 응답해주세요.`;

  const generateRevision = async (modelName: string) => {
    if (!ai) throw new Error("AI client not initialized");
    return await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: "당신은 항상 정확한 JSON 데이터를 출력하는 여행 도우미입니다. 한국어로 응답하세요.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER, description: "여행차수 일 수 (1, 2, 3 등)" },
              theme: { type: Type.STRING, description: "해당 일차의 흥미진진한 핵심 테마 제목" },
              description: { type: Type.STRING, description: "해당 일차의 일정 전체 개요 및 감성적 한 줄 요약" },
              activities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: "시간대 (예: 오전 09:30, 오후 12:30, 오후 03:00)" },
                    title: { type: Type.STRING, description: "방문 장소의 실제 상호명(가게 이름)을 구체적으로 기입" },
                    description: { type: Type.STRING, description: "여행 가이드북 감성의 풍부하고 실용적인 공간 묘사, 매장 팁" },
                    location: { type: Type.STRING, description: "그 장소의 추천 랜드마크 지역 혹은 도로명" },
                    category: { type: Type.STRING, description: "활동 유형 (관광, 맛집, 카페, 쇼핑, 숙소, 이동 중 하나를 매칭)" },
                    isMeal: { type: Type.BOOLEAN, description: "아침/점심/저녁 식사 활동이면 true, 일반 관광/체험 활동이면 false" },
                    mealType: { type: Type.STRING, description: "식사 활동인 경우 '아침', '점심', '저녁' 중 하나. 식사가 아니면 빈 문자열" },
                    mustVisit: { type: Type.BOOLEAN, description: "사용자가 필수 지목한 가고싶은 곳인 경우 true, 아니면 false" },
                    latitude: { type: Type.NUMBER, description: "해당 장소의 위도 좌표 실수형 데이터" },
                    longitude: { type: Type.NUMBER, description: "해당 장소의 경도 좌표 실수형 데이터" },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "연관된 해시태그 목록 2-3개"
                    }
                  },
                  required: ["time", "title", "description", "location", "category", "isMeal", "latitude", "longitude"]
                }
              }
            },
            required: ["day", "theme", "description", "activities"]
          }
        }
      }
    });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let response;
    try {
      response = await generateRevision("gemini-2.5-flash");
    } catch (primaryErr: any) {
      console.warn(`★ [Netlify Function] revise-plan primary model failed: ${primaryErr.message || primaryErr}`);
      await sleep(1500);
      response = await generateRevision("gemini-2.5-flash-lite");
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response text from Gemini API");
    }

    const revisedDays = JSON.parse(responseText.trim());

    const enhancedDays = await Promise.all(
      revisedDays.map(async (dayObj: any) => {
        if (Array.isArray(dayObj.activities)) {
          dayObj.activities = await Promise.all(
            dayObj.activities.map(async (act: any, idx: number) => {
              const photoRef = await fetchRealPlacePhotoRef(act.title, destination);
              act.imageUrl = photoRef
                ? `/api/place-photo?ref=${encodeURIComponent(photoRef)}`
                : getMockupImage(act.category, destination, idx);
              return act;
            })
          );
        }
        return dayObj;
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, planContent: enhancedDays }),
    };
  } catch (err) {
    console.error("★ [Netlify Function] revise-plan 실패:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, message: "AI가 피드백을 반영하는 데 실패했습니다. 잠시 후 다시 시도해 주세요." }),
    };
  }
};
