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
import dotenv from "dotenv";
import { runPipeline } from "./itinerary/runner";
import { attachPhotos } from "./places/photos";
import { parsePlanInput } from "./itinerary/entry";
import { mergeFeedbackIntoRequest } from "./itinerary/revise";

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
// Google Places 실사진 조회 (서버 전용 키 — 클라이언트에는 절대 노출하지 않음)
// -------------------------------------------------------------
const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY || "";

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
  const parsed = parsePlanInput(req.body ?? {});
  if (parsed.ok === false) {
    return res.status(400).json({
      success: false, data: null,
      error: { code: parsed.code, message: parsed.message, field: parsed.field },
    });
  }

  const { request, days } = parsed.value;
  const destination = request.destination;
  const { startDate, endDate, companion, budget, intensity, transportMode, styles, mustVisitPlaces } = req.body;

  try {
    const { planContent, narrationDegraded } = await runPipeline(request);

    return res.json({
      title: `${destination} ${days - 1}박 ${days}일 여행`,
      destination,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || new Date().toISOString().split("T")[0],
      duration: `${days - 1}박 ${days}일`,
      budget: budget || "표준형",
      companion: companion || "혼자",
      intensity: intensity || "여유롭게",
      transportMode: transportMode || "대중교통",
      styles: styles || [],
      mustVisitPlaces: mustVisitPlaces || "",
      planContent: await attachPhotos(planContent, destination),
      narrationDegraded,
    });
  } catch (err) {
    console.error("[TripMate] 일정 생성 실패:", err);
    return res.status(500).json({
      success: false, data: null,
      error: { code: "PLAN_GENERATION_FAILED", message: "일정을 만들지 못했습니다. 조건을 조금 바꿔 다시 시도해 주세요.", field: null },
    });
  }
});

// -------------------------------------------------------------
// 5.4 자연어 피드백 기반 일정 재생성 — 수정은 요청 조건에 피드백을 병합해 파이프라인을 다시 실행
// -------------------------------------------------------------
app.post("/api/revise-plan", async (req, res) => {
  const { planContent, feedback } = req.body;

  if (!Array.isArray(planContent) || typeof feedback !== "string" || !feedback.trim()) {
    return res.status(400).json({
      success: false, data: null,
      error: { code: "REVISE_INPUT_INVALID", message: "planContent, feedback가 모두 필요합니다.", field: null },
    });
  }

  const parsed = parsePlanInput(req.body ?? {});
  if (parsed.ok === false) {
    return res.status(400).json({
      success: false, data: null,
      error: { code: parsed.code, message: parsed.message, field: parsed.field },
    });
  }

  const { request } = parsed.value;
  const destination = request.destination;

  // 이전 일정에 있던 장소는 제외 지시로 넘겨, 재생성에서 같은 곳이 다시 나오지 않게 한다.
  const previousNames: string[] = planContent.flatMap((d: any) =>
    Array.isArray(d.activities) ? d.activities.map((a: any) => a.title) : [],
  );

  try {
    const { planContent: revised, narrationDegraded } = await runPipeline(
      mergeFeedbackIntoRequest(request, feedback, previousNames),
    );

    return res.json({
      success: true,
      planContent: await attachPhotos(revised, destination),
      narrationDegraded,
    });
  } catch (err) {
    console.error("[TripMate] 일정 수정 실패:", err);
    return res.status(500).json({
      success: false, data: null,
      error: { code: "PLAN_REVISION_FAILED", message: "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.", field: null },
    });
  }
});

// -------------------------------------------------------------
// 5.5 Google Places Photo Proxy — API 키를 클라이언트에 노출하지 않고 실사진을 서빙
// -------------------------------------------------------------
app.get("/api/place-photo", (req, res) => {
  const ref = req.query.ref as string;
  const maxwidth = (req.query.maxwidth as string) || "400";

  if (!ref) {
    return res.status(400).send("ref query parameter is required");
  }
  if (!googlePlacesApiKey) {
    return res.status(503).send("Google Places API key is not configured");
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${encodeURIComponent(
    maxwidth
  )}&photo_reference=${encodeURIComponent(ref)}&key=${googlePlacesApiKey}`;

  https.get(googleUrl, (googleRes) => {
    // Google Place Photo는 실제 이미지 CDN으로 302 리다이렉트를 반환한다.
    if (googleRes.statusCode === 302 && googleRes.headers.location) {
      https.get(googleRes.headers.location, (imgRes) => {
        res.setHeader("Content-Type", imgRes.headers["content-type"] || "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        imgRes.pipe(res);
      }).on("error", (err) => {
        console.error("Place photo redirect fetch failed:", err);
        res.status(502).send("Failed to fetch photo");
      });
    } else {
      res.setHeader("Content-Type", googleRes.headers["content-type"] || "image/jpeg");
      googleRes.pipe(res);
    }
  }).on("error", (err) => {
    console.error("Place photo fetch failed:", err);
    res.status(502).send("Failed to fetch photo");
  });
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
        } catch {
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
