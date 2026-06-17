import { GoogleGenAI, Type } from "@google/genai";

// -------------------------------------------------------------
// Image Mockup Helpers (from server.ts)
// -------------------------------------------------------------
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
    const osakaImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU"
    ];
    return osakaImages[0];
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

  // Fallbacks based on category
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
// Netlify Function Handler
// -------------------------------------------------------------
export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    console.warn(`★ [Netlify Function] 지원되지 않는 요청 메서드 수신: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    console.error("★ [Netlify Function] JSON 바디 파싱 오류:", err);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const {
    destination,
    startDate,
    endDate,
    companion,
    budget,
    styles,
    mustVisitPlaces,
    comments
  } = body;

  console.log("==================================================");
  console.log("★ [Netlify Function] 일정 생성 요청이 들어왔습니다.");
  console.log(`- 목적지: ${destination}`);
  console.log(`- 일정: ${startDate} ~ ${endDate}`);
  console.log(`- 동행인: ${companion}`);
  console.log(`- 예산: ${budget}`);
  console.log(`- 스타일: ${Array.isArray(styles) ? styles.join(", ") : styles}`);
  console.log(`- 필수방문지: ${mustVisitPlaces || "없음"}`);
  console.log(`- 추가요청: ${comments || "없음"}`);
  console.log("==================================================");

  if (!destination) {
    console.error("★ [Netlify Function] 필수 항목 누락: 목적지가 비어있습니다.");
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Destination is required" }),
    };
  }

  // Calculate duration
  let durationText = "2박 3일";
  if (startDate && endDate) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    durationText = `${diffDays - 1}박 ${diffDays}일`;
  }
  console.log(`★ [Netlify Function] 계산된 여행 기간: ${durationText}`);

  const createFallbackPlan = () => {
    console.log("★ [Netlify Function] 시스템 대체(Fallback) 기본 일정을 생성하여 반환합니다.");
    const dCount = startDate && endDate ? Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 3;
    const fallbackDays = [];

    for (let d = 1; d <= dCount; d++) {
      fallbackDays.push({
        day: d,
        theme: `${destination}에서의 특별한 하루 - ${d}일차`,
        description: `${destination}의 핵심 하이라이트를 탐방하는 일차별 스마트 동선입니다.`,
        activities: [
          {
            time: "오전 09:30",
            title: d === 1 && mustVisitPlaces ? mustVisitPlaces : `${destination} 인기 탐방 명소`,
            description: "놓치고 싶지 않은 이 지역 최고의 랜드마크를 방문하여 아침 산책과 기념사진 촬영을 즐깁니다.",
            location: `${destination} 시내 중심가`,
            category: "관광",
            mustVisit: d === 1 && !!mustVisitPlaces,
            tags: ["랜드마크", "아침산책", "인생샷"],
            latitude: d === 1 && mustVisitPlaces ? 36.3276 : 36.3504 + d * 0.005,
            longitude: d === 1 && mustVisitPlaces ? 127.4272 : 127.3845 + d * 0.005
          },
          {
            time: "오후 12:30",
            title: "추천 한식/현지식 소문난 맛집",
            description: "인근에서 가장 유명하고 후기가 극찬인 레스토랑에서 든든하게 점심 식사를 즐깁니다.",
            location: `${destination} 번화가`,
            category: "맛집",
            tags: ["현지맛집", "미식탐방", "강력추천"],
            latitude: 36.3504 + d * 0.005 - 0.002,
            longitude: 127.3845 + d * 0.005 + 0.003
          },
          {
            time: "오후 02:30",
            title: "감성 가득한 로컬 스페셜티 카페",
            description: "스타일리시한 인테리어와 수제 디저트가 일품인 핫플레이스 카페에서 차 한잔을 기울이며 휴식을 누립니다.",
            location: `${destination} 골목 정취`,
            category: "카페",
            tags: ["감성카페", "수제디저트", "힐링"],
            latitude: 36.3504 + d * 0.005 + 0.004,
            longitude: 127.3845 + d * 0.005 - 0.002
          },
          {
            time: "오후 05:00",
            title: "쇼핑 스트리트 및 소품샵 구경",
            description: "로컬 소품과 한정판 기념품을 만나볼 수 있는 개성 넘치는 거리를 구경하며 지인들 선물을 마련합니다.",
            location: `${destination} 쇼핑 에비뉴`,
            category: "쇼핑",
            tags: ["쇼핑", "기념품", "거리탐방"],
            latitude: 36.3504 + d * 0.005 - 0.003,
            longitude: 127.3845 + d * 0.005 + 0.001
          }
        ]
      });
    }

    return {
      title: `${destination} ${durationText} 여행`,
      destination,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      duration: durationText,
      budget: budget || "표준형",
      companion: companion || "혼자",
      styles: styles || ["맛집", "자연"],
      mustVisitPlaces: mustVisitPlaces || "",
      planContent: fallbackDays,
    };
  };

  // Initialize Gemini AI (using Netlify environment variables)
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey && apiKey.trim() !== "") {
    try {
      console.log(`★ [Netlify Function] API Key가 감지되었습니다. (앞 4자리: ${apiKey.substring(0, 4)}...)`);
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("★ [Netlify Function] GoogleGenAI 클라이언트 초기화 완료.");
    } catch (err) {
      console.error("★ [Netlify Function] GoogleGenAI 클라이언트 초기화 실패:", err);
    }
  } else {
    console.warn("★ [Netlify Function] 경고: VITE_GEMINI_API_KEY 또는 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  if (!ai) {
    console.log("★ [Netlify Function] AI 클라이언트가 준비되지 않았습니다. 즉시 대체 일정을 반환합니다.");
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(createFallbackPlan()),
    };
  }

  // Gemini model prompt construction
  const prompt = `당신은 세계적인 여행 가이드이자 전문 AI 여행 컨시어지입니다.
사용자의 아래 요청 사항을 반영하여, 완벽한 동선과 점심/저녁 식사 시간이 유기적으로 배치된 일자별(Day별) 상세 여행 계획을 세워주세요.

[여행 기본 정보]
- 목적지: ${destination}
- 일정(날짜): ${startDate} ~ ${endDate} (여행 기간: ${durationText})
- 동행자 유형: ${companion}
- 예산 수준: ${budget} (절약형, 표준형, 고급형 중 하나)
- 선호하는 스타일 키워드들: ${Array.isArray(styles) ? styles.join(", ") : styles}
- 반드시 꼭 방문해야 할 장소 (Must-Visit): ${mustVisitPlaces}
- 추가 요청 및 피드백 메모사항: ${comments || "없음"}

[동선 설계 안내 및 제약사항]
1. 하루에 3~4개의 명확히 구분된 시간대별 일정을 배치하세요. (오전, 점심식사, 오후, 저녁식사 혹은 쇼핑/카페 등)
2. 맛집이나 카페 스타일을 선호하는 경우 점심/저녁 식사 시간대에 어울리는 식당이나 명소를 동선 상에 스마트하게 배치하세요.
3. 요청한 필수 방문 장소([Must-Visit])가 있다면, 일치하는 활동에서  "mustVisit": true 로 설정하고 실제 여행 일정에 반드시 포함하세요.
4. 설명은 여행 가이드북처럼 구체적이고 현지 감성을 살려 팁과 정겨운 톤("~를 강력 추천합니다", "~를 만끽해보세요" 처럼 존댓말 한글)으로 작성해주세요.
5. 모든 장소 활동(activities)에 대해 지도로 표현하고 이동 선을 그릴 수 있도록 실제 위도(latitude)와 경도(longitude) 값(실수형 숫자 형태)을 유추하여 반드시 포함시켜주세요. (예: 대전 성심당 본점인 경우 36.3276, 127.4272)

반드시 명시된 JSON 스키마를 준수하여 응답해 주세요.`;

  const generateWithModel = async (aiClient: GoogleGenAI, modelName: string) => {
    console.log(`★ [Netlify Function] 모델 콘텐츠 생성 시도 중... (사용 모델: ${modelName})`);
    return await aiClient.models.generateContent({
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
                    title: { type: Type.STRING, description: "방문 장소명 또는 활동명" },
                    description: { type: Type.STRING, description: "여행 가이드북 감성의 풍부하고 실용적인 공간 묘사, 매장 팁, 먹어야 할 메뉴 추천" },
                    location: { type: Type.STRING, description: "그 장소의 추천 랜드마크 지역 혹은 도로명" },
                    category: { type: Type.STRING, description: "활동 유형 (관광, 맛집, 카페, 쇼핑, 숙소, 이동 중 하나를 매칭)" },
                    mustVisit: { type: Type.BOOLEAN, description: "사용자가 필수 지목한 가고싶은 곳인 경우 true, 아니면 false" },
                    latitude: { type: Type.NUMBER, description: "해당 장소의 위도 좌표 실수형 데이터 (예: 36.3276)" },
                    longitude: { type: Type.NUMBER, description: "해당 장소의 경도 좌표 실수형 데이터 (예: 127.4272)" },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "연관된 해시태그 목록 2-3개 (예: ['인생샷', '전위예술', '오션뷰'])"
                    }
                  },
                  required: ["time", "title", "description", "location", "category", "latitude", "longitude"]
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
      response = await generateWithModel(ai, "gemini-2.5-flash");
      console.log("★ [Netlify Function] 주 모델(gemini-2.5-flash) 콘텐츠 생성 완료.");
    } catch (primaryErr: any) {
      console.warn(`★ [Netlify Function] 주 모델(gemini-2.5-flash) 실패: ${primaryErr.message || primaryErr}`);
      console.log("★ [Netlify Function] 1.5초 대기 후 보조 모델로 재시도합니다...");
      await sleep(1500);

      try {
        response = await generateWithModel(ai, "gemini-2.5-flash-lite");
        console.log("★ [Netlify Function] 보조 모델(gemini-2.5-flash-lite) 콘텐츠 생성 완료.");
      } catch (backupErr: any) {
        console.warn(`★ [Netlify Function] 보조 모델도 실패: ${backupErr.message || backupErr}`);
        console.log("★ [Netlify Function] 1초 대기 후 마지막으로 주 모델을 1회 더 시도합니다...");
        await sleep(1000);
        response = await generateWithModel(ai, "gemini-2.5-flash");
        console.log("★ [Netlify Function] 주 모델 최종 시도 콘텐츠 생성 완료.");
      }
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response text from Gemini API");
    }

    console.log("==================================================");
    console.log("★ [Netlify Function] Gemini API 수신 원본 텍스트 데이터:");
    console.log(responseText);
    console.log("==================================================");

    const cleanedText = responseText.trim();
    const daysContent = JSON.parse(cleanedText);
    console.log("★ [Netlify Function] 수신한 JSON 텍스트 파싱 성공.");

    // Enhance images dynamically using category mockup image links
    const enhancedDays = daysContent.map((dayObj: any) => {
      if (Array.isArray(dayObj.activities)) {
        dayObj.activities = dayObj.activities.map((act: any, idx: number) => {
          act.imageUrl = getMockupImage(act.category, destination, idx);
          return act;
        });
      }
      return dayObj;
    });
    console.log("★ [Netlify Function] 일정별 장소 카테고리에 맞춰 목업 이미지 매칭 완료.");

    const finalPlan = {
      title: `${destination} ${durationText} 여행`,
      destination,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      duration: durationText,
      budget: budget || "표준형",
      companion: companion || "혼자",
      styles: styles || ["맛집", "자연"],
      mustVisitPlaces: mustVisitPlaces || "",
      planContent: enhancedDays,
    };

    console.log(`★ [Netlify Function] 플랜 구성 성공! 클라이언트로 결과를 반환합니다. (제목: ${finalPlan.title})`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(finalPlan),
    };

  } catch (err: any) {
    console.error("★ [Netlify Function] Gemini Content Generation Failed or Parsing Failed:", err);
    // Graceful fallback plan returned instead of crashing
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(createFallbackPlan()),
    };
  }
};
