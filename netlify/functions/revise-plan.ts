import { GoogleGenAI, Type } from "@google/genai";
import https from "https";

// -------------------------------------------------------------
// Google Places 실사진 조회 (서버 전용 키 — 클라이언트에는 절대 노출하지 않음)
// generate-plan.ts와 동일한 헬퍼 (Netlify Functions는 함수별로 독립 번들되므로 중복 유지)
// -------------------------------------------------------------
const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY || "";

function fetchJsonHttps(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

async function fetchRealPlacePhotoRef(placeName: string, destination: string): Promise<string | null> {
  if (!googlePlacesApiKey) return null;

  try {
    const query = `${destination} ${placeName}`;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      query
    )}&inputtype=textquery&fields=photos&key=${googlePlacesApiKey}`;
    const data = await fetchJsonHttps(url);
    const photoRef = data?.candidates?.[0]?.photos?.[0]?.photo_reference;
    return photoRef || null;
  } catch (err) {
    console.error(`Google Places photo lookup failed for "${placeName}":`, err);
    return null;
  }
}

function getMockupImage(category: string, destination: string, index: number): string {
  const normalizedDest = (destination || "").toLowerCase();

  if (normalizedDest.includes("도쿄") || normalizedDest.includes("tokyo")) {
    const tokyoImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAWwaT6yvcSZZqChzslpAIM-mXP8HAwO9RMpNMpU7_5xZGThTemplate_Tokyo1",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBllgP_UuFlsuNLoH173ZzuFyP9PZaJq5OUAmeY5Ooz6fWjhkQQBNXQ1DEOmqu9c3gCL38VPDPvIVC3w990VWNSZXB_LQPtJHm7fcSoLlE8HreOLiMXg530fU9EkkxE_fXyS4BEDSQiH4pCEL6YfkWlL-4Gx_fSWD3fc8goz7GSS9dgKBJ1SXUeJNt6rKisTmGzr49QFoDLUthI2WefckMbyYnwyD5sjQ_GkOsguLThMZP7Z90zFtWXj_rZyL1fzcTMqBe_Q7WHuhc"
    ];
    if (category === "맛집") return tokyoImages[2];
    return tokyoImages[index % tokyoImages.length];
  }

  if (normalizedDest.includes("오사카") || normalizedDest.includes("osaka")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU";
  }

  if (normalizedDest.includes("제주") || normalizedDest.includes("jeju")) {
    const jejuImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAUTR_9HCW54fzsiXaYN2YmCIRLEgxy4YIkOD1wBZzaO-Ts36HmEsL8eMKtMyK_-gwAfSLBKAP8nwUn4Vyi4JkHuGAFCe0A8ivZFxNLfxmPKNRwPVmYjDuKURN3AbU_iF6EQhrQaevbCbfZ08Sgz165GeGegwDJ_1EQVl1vRAexGFh8RoQCFTEfrc2x8MB6uOwUnZqkYl_lTkl8QU2C0KQf_ENYwYINIH3qV5U2P9D1mjgBeDWOgJ0aUXkDl5VRg8G4RkGIvtRyFVU",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAe1AnkbJXhO5lId58Y7sCZa65LR0MrW3CyEc967MhQiv_RshiB3M5HFxjCzvWi5-ln0cMi-xYhLzRj1ucGSYeHiu1stONtNrjn-KpVT6-KtnJhcM98N1SO9f73MbPEtk-OkeFcbpy6OxdgUovNE9wRAw7r-ItJd35h5jLX_78PnU0F3DXubr9S_2XsphFA7LmCYxyj8Nq_Tmw-bQ2F-NVkCjGvMKBUWsAIO1Tor4d8kHcWgA6TTjO3gMFU66LN4jPskSYysIfHaiI"
    ];
    if (category === "맛집") return "https://lh3.googleusercontent.com/aida-public/AB6AXuA3STExzheMVpQQhHTarK2ZOjX-mOyyV01pI1NEsJuwYCBoSt092OBTza3HTjWRB2NjsIc8ol5YPAdu2TzpDivFIksAyH85Akr8OslClMEezIAv3_arMKUDNeByCHTxhEqjqgm8C19B5KDQN0ZxdfkVHOYJdszYeZaMKh5PJrlbT6433tYxPGVNWbU2xk-VUvb9J2AxM_aWQboLDKDjwPHoUk7q-6b-LuejTV4Qxa_fJua29RBf4O1IYdb2sH11NK548qKMAzhmgho";
    return jejuImages[index % jejuImages.length];
  }

  if (normalizedDest.includes("파리") || normalizedDest.includes("paris")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuAq2FzS7k5PqYPGG9LxZA5osqN7WMk-CwGN7HxAjLjFxOW2gfBdL_HwK9Tk9R1QQJf_tJu_JI42bMPyZkHYWvgkKKYZzPOoAI205klU4BCMsRIPf5vHRqaQgc4GJ7VvoHP4JV3rOFQ81EeZRkSUC6YuCKsadwYwzDyqmmAZSB3GWTRHWTLCrg7JKNs_V5whppspWGnvg9mMZDGxc76Wg-EHCIIZIy11P1R_KVMWUYPW8CYyImDMjRBA7vWC-CrqN28LdFqdSvoPH4o";
  }

  if (normalizedDest.includes("시드니") || normalizedDest.includes("sydney")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuBNj026qW-ZpTYzKavkSWxoW6ztR42Cm0-_DYA0Vrty1MhmDNAhOYT4SgRZIMzAlQs6AQoVP-_nDtUBBhFI7OmwrKePBp2LfkPUYKIucszll7pjwndHWyTHfial5G3ulwYH5oJn0027Ih50_A2V-SJffgPzfZ4prZprIcilvkvMCR0LGwwOQ04M75R3WE4U-wB7DidTpsFLZ4RG0WdtlGIEHs24Q53QHF7wMoEzGmpGkNBd5C_NGN9UeTYR2mJ-1Aqy1BH_hGJfgtg";
  }

  if (category === "맛집" || category.includes("맛집")) {
    return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop";
  } else if (category === "카페" || category.includes("카페")) {
    return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop";
  } else if (category === "쇼핑" || category.includes("쇼핑")) {
    return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop";
  } else if (category === "숙소" || category.includes("숙소") || category.includes("호텔") || category.includes("펜션")) {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop";
  } else if (category === "관광" || category === "명소" || category.includes("관광") || category.includes("명소") || category.includes("랜드마크") || category.includes("유적")) {
    return "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&auto=format&fit=crop";
  } else if (category === "자연" || category.includes("자연") || category.includes("산") || category.includes("바다") || category.includes("공원") || category.includes("계곡")) {
    return "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500&auto=format&fit=crop";
  } else if (category === "액티비티" || category === "체험" || category.includes("액티비티") || category.includes("체험") || category.includes("테마파크") || category.includes("레저")) {
    return "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=500&auto=format&fit=crop";
  } else if (category === "힐링" || category === "문화" || category.includes("힐링") || category.includes("문화") || category.includes("미술관") || category.includes("박물관") || category.includes("전시")) {
    return "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&auto=format&fit=crop";
  }

  return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500&auto=format&fit=crop";
}

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
  } catch (err) {
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
