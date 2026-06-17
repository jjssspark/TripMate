/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import https from "https";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// 비동기 예외로 인한 Node 프로세스 비정상 종료(crash) 방지 핸들러 추가
process.on("unhandledRejection", (reason, promise) => {
  console.error("[TripMate AI] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[TripMate AI] Uncaught Exception thrown:", err);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize database path
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "travel_plans.json");

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), "utf8");
}

// Read helper
function readPlans(): any[] {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading DB file:", err);
    return [];
  }
}

// Write helper
function writePlans(plans: any[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(plans, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to DB file:", err);
  }
}

// -------------------------------------------------------------
// Gemini AI API Utility
// -------------------------------------------------------------
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (apiKey && apiKey !== "" && apiKey.trim() !== "") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini AI initialized on server side successfully.");
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
} else {
  console.warn("GEMINI_API_KEY is not configured or using placeholder. Running in fallback mode.");
}

// Helper to choose corresponding high-quality mockup images for places
function getMockupImage(category: string, destination: string, index: number): string {
  const normalizedDest = (destination || "").toLowerCase();

  if (normalizedDest.includes("도쿄") || normalizedDest.includes("tokyo")) {
    const tokyoImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAWwaT6yvcSZZqChzslpAIM-mXP8HAwO9RMpNMpU7_5xZGThTemplate_Tokyo1",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I", // Seongsan (substitute as nice view)
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBllgP_UuFlsuNLoH173ZzuFyP9PZaJq5OUAmeY5Ooz6fWjhkQQBNXQ1DEOmqu9c3gCL38VPDPvIVC3w990VWNSZXB_LQPtJHm7fcSoLlE8HreOLiMXg530fU9EkkxE_fXyS4BEDSQiH4pCEL6YfkWlL-4Gx_fSWD3fc8goz7GSS9dgKBJ1SXUeJNt6rKisTmGzr49QFoDLUthI2WefckMbyYnwyD5sjQ_GkOsguLThMZP7Z90zFtWXj_rZyL1fzcTMqBe_Q7WHuhc" // Sushi
    ];
    if (category === "맛집") return tokyoImages[2];
    return tokyoImages[index % tokyoImages.length];
  }

  if (normalizedDest.includes("오사카") || normalizedDest.includes("osaka")) {
    const osakaImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU" // Osaka castle
    ];
    return osakaImages[0];
  }

  if (normalizedDest.includes("제주") || normalizedDest.includes("jeju")) {
    const jejuImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I", // Seongsan
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAUTR_9HCW54fzsiXaYN2YmCIRLEgxy4YIkOD1wBZzaO-Ts36HmEsL8eMKtMyK_-gwAfSLBKAP8nwUn4Vyi4JkHuGAFCe0A8ivZFxNLfxmPKNRwPVmYjDuKURN3AbU_iF6EQhrQaevbCbfZ08Sgz165GeGegwDJ_1EQVl1vRAexGFh8RoQCFTEfrc2x8MB6uOwUnZqkYl_lTkl8QU2C0KQf_ENYwYINIH3qV5U2P9D1mjgBeDWOgJ0aUXkDl5VRg8G4RkGIvtRyFVU", // Sea coast
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAe1AnkbJXhO5lId58Y7sCZa65LR0MrW3CyEc967MhQiv_RshiB3M5HFxjCzvWi5-ln0cMi-xYhLzRj1ucGSYeHiu1stONtNrjn-KpVT6-KtnJhcM98N1SO9f73MbPEtk-OkeFcbpy6OxdgUovNE9wRAw7r-ItJd35h5jLX_78PnU0F3DXubr9S_2XsphFA7LmCYxyj8Nq_Tmw-bQ2F-NVkCjGvMKBUWsAIO1Tor4d8kHcWgA6TTjO3gMFU66LN4jPskSYysIfHaiI" // Snoopy garden
    ];
    if (category === "맛집") return "https://lh3.googleusercontent.com/aida-public/AB6AXuA3STExzheMVpQQhHTarK2ZOjX-mOyyV01pI1NEsJuwYCBoSt092OBTza3HTjWRB2NjsIc8ol5YPAdu2TzpDivFIksAyH85Akr8OslClMEezIAv3_arMKUDNeByCHTxhEqjqgm8C19B5KDQN0ZxdfkVHOYJdszYeZaMKh5PJrlbT6433tYxPGVNWbU2xk-VUvb9J2AxM_aWQboLDKDjwPHoUk7q-6b-LuejTV4Qxa_fJua29RBf4O1IYdb2sH11NK548qKMAzhmgho"; // Coastal restaurant
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
// API Endpoints
// -------------------------------------------------------------

// 1. Get user's saved travel plans (여행 조회)
app.get("/api/plans", (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is required" });
  }

  const allPlans = readPlans();
  const userPlans = allPlans.filter((p) => p.userId === userId);
  return res.json(userPlans);
});

// 2. Save a new travel plan (여행 저장)
app.post("/api/plans", (express.json() as any), (req, res) => {
  const plan = req.body;
  if (!plan.userId || !plan.title || !plan.destination) {
    return res.status(400).json({ error: "Missing required plan fields (userId, title, destination)" });
  }

  const allPlans = readPlans();

  // Assign simple UUID if not provided
  if (!plan.id) {
    plan.id = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const nowStr = new Date().toISOString();
  plan.createdAt = plan.createdAt || nowStr;
  plan.updatedAt = nowStr;

  // Enhance activities with nice stock images if missing
  if (Array.isArray(plan.planContent)) {
    plan.planContent = plan.planContent.map((dayObj: any) => {
      if (Array.isArray(dayObj.activities)) {
        dayObj.activities = dayObj.activities.map((act: any, idx: number) => {
          if (!act.imageUrl) {
            act.imageUrl = getMockupImage(act.category, plan.destination, idx);
          }
          return act;
        });
      }
      return dayObj;
    });
  }

  allPlans.push(plan);
  writePlans(allPlans);

  return res.status(201).json(plan);
});

// 3. Update an existing travel plan (일정 편집)
app.put("/api/plans/:id", (req, res) => {
  const { id } = req.params;
  const updatedPlan = req.body;

  const allPlans = readPlans();
  const index = allPlans.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Plan not found" });
  }

  allPlans[index] = {
    ...allPlans[index],
    ...updatedPlan,
    updatedAt: new Date().toISOString(),
  };

  writePlans(allPlans);
  return res.json(allPlans[index]);
});

// 4. Delete a travel plan (여행 삭제)
app.delete("/api/plans/:id", (req, res) => {
  const { id } = req.params;
  const allPlans = readPlans();
  const filtered = allPlans.filter((p) => p.id !== id);

  if (allPlans.length === filtered.length) {
    return res.status(404).json({ error: "Plan not found" });
  }

  writePlans(filtered);
  return res.json({ success: true, message: "Travel plan deleted successfully" });
});

// 5. Generate Travel Plan using Gemini (AI 일정 생성)
app.post("/api/generate-plan", async (req, res) => {
  const {
    destination,
    startDate,
    endDate,
    companion,
    budget,
    styles,
    mustVisitPlaces,
    comments
  } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "Destination is required" });
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

  // Construct fallback mock data in case Gemini is not available or errors out
  const createFallbackPlan = () => {
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

  if (!ai) {
    console.log("No Gemini API key supplied or client initialization omitted. Serving fallback mock plan.");
    return res.json(createFallbackPlan());
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

  const generateWithModel = async (modelName: string) => {
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

  // 비동기 대기를 위한 헬퍼 함수 정의
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let response;
    try {
      console.log("Attempting generation with primary model: gemini-2.5-flash...");
      response = await generateWithModel("gemini-2.5-flash");
    } catch (primaryErr: any) {
      console.warn(`[TripMate AI] Primary model (gemini-2.5-flash) failed: ${primaryErr.message || primaryErr}`);
      console.log("Waiting 1.5 seconds to bypass temporary API traffic spikes...");

      // 1.5초 대기 후 백업 모델로 시도하여 구글 측 일시적 503 부하 우회
      await sleep(1500);

      try {
        console.log("Retrying with backup model: gemini-2.5-flash-lite...");
        response = await generateWithModel("gemini-2.5-flash-lite");
      } catch (backupErr: any) {
        console.warn(`[TripMate AI] Backup model (gemini-2.5-flash-lite) also failed. Trying gemini-2.5-flash one last time...`);
        await sleep(1000);
        response = await generateWithModel("gemini-2.5-flash");
      }
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response text from Gemini API");
    }

    // Gemini API 응답 원본을 개발자 콘솔(터미널)에 출력
    console.log("==================================================");
    console.log("★ [TripMate AI] Gemini API 수신 원본 텍스트 데이터:");
    console.log(responseText);
    console.log("==================================================");

    const cleanedText = responseText.trim();
    const daysContent = JSON.parse(cleanedText);

    // Enhance images dynamically on server-side using category mockups
    const enhancedDays = daysContent.map((dayObj: any) => {
      if (Array.isArray(dayObj.activities)) {
        dayObj.activities = dayObj.activities.map((act: any, idx: number) => {
          act.imageUrl = getMockupImage(act.category, destination, idx);
          return act;
        });
      }
      return dayObj;
    });

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

    return res.json(finalPlan);

  } catch (err) {
    console.error("Gemini Content Generation Failed or Schema Match Failed:", err);
    // Graceful fallback so the app experience is resilient and doesn't load infinitely
    const fallback = createFallbackPlan();
    return res.json(fallback);
  }
});

// -------------------------------------------------------------
// 6. Geocoding Proxy API to bypass browser CORS & 429 limit
// -------------------------------------------------------------
const serverGeocodeCache: { [key: string]: { lat: number; lon: number } } = {};

function fetchCoordinatesFromOSM(searchQuery: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "TripMateAI/1.0 (contact: support@tripmate.ai)"
      }
    };

    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            if (parsed && parsed.length > 0) {
              resolve({
                lat: parseFloat(parsed[0].lat),
                lon: parseFloat(parsed[0].lon)
              });
              return;
            }
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

app.get("/api/geocode", async (req, res) => {
  const { query, city } = req.query;
  if (!query) {
    return res.status(400).json({ error: "query parameter is required" });
  }

  const dest = (city as string) || "";
  const searchKey = `${dest}_${query}`;

  if (serverGeocodeCache[searchKey]) {
    return res.json(serverGeocodeCache[searchKey]);
  }

  try {
    const searchQuery = (query as string).includes(dest) ? (query as string) : `${dest} ${query}`;
    const coord = await fetchCoordinatesFromOSM(searchQuery);
    
    if (coord) {
      serverGeocodeCache[searchKey] = coord;
      return res.json(coord);
    }
    return res.status(404).json({ error: "No location found" });
  } catch (err: any) {
    console.error("Server geocoding error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// -------------------------------------------------------------
// Vite Dev Server / Static Production Asset Serving
// -------------------------------------------------------------
async function startServer() {
  const server = createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[TripMate AI] Port ${PORT} is already in use. Stop the other process or run with PORT=<number> npm run dev`,
      );
      process.exit(1);
    }

    throw err;
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[TripMate AI] Server running at http://localhost:${PORT}`);
  });
}

startServer();
