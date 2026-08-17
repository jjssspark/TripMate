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
import { attachPhotos, getMockupImage } from "./places/photos";
import { parsePlanInput } from "./itinerary/entry";
import { NotEnoughPlacesError } from "./itinerary/pipeline";
import { QuotaExceededError } from "./itinerary/quota";
import { ConfigMissingError } from "./itinerary/config";
import { mergeFeedbackIntoRequest, excludeNamesFor } from "./itinerary/revise";

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
    // 장소 부족은 서버 오류가 아니라 조건 문제다. 무엇을 조정하면 되는지 그대로 내려보낸다.
    if (err instanceof NotEnoughPlacesError) {
      return res.status(422).json({
        success: false, data: null,
        error: { code: "NOT_ENOUGH_PLACES", message: err.message, field: null },
      });
    }
    // 쿼터 소진도 서버 오류가 아니다. 조건을 바꿔도 소용없고, 기다리는 것 외에 할 일이 없다.
    if (err instanceof QuotaExceededError) {
      return res.status(429).json({
        success: false, data: null,
        error: { code: "AI_QUOTA_EXCEEDED", message: err.message, field: null },
      });
    }
    // 설정 누락은 재시도로 풀리지 않는다. 500으로 뭉개면 "잠시 후 다시" 안내가 나가 헛되이 기다리게 된다.
    if (err instanceof ConfigMissingError) {
      console.error("[TripMate] 필수 환경변수 누락:", err.missing.join(", "));
      return res.status(503).json({
        success: false, data: null,
        error: { code: "SERVICE_NOT_CONFIGURED", message: err.message, field: null },
      });
    }
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
  // body-parser가 content-type 검사 전에 req.body = req.body || {}를 넣으므로 실제로
  // undefined가 되지는 않는다. 그래도 아래 parsePlanInput(req.body ?? {})과 형태를 맞춰
  // 두 진입점이 같은 입력에서 똑같이 400 REVISE_INPUT_INVALID를 내도록 둔다.
  const { planContent, feedback } = req.body ?? {};

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

  // 장소를 바꿔 달라는 피드백일 때만 이전 장소를 제외 지시로 넘긴다.
  const previousNames: string[] = planContent.flatMap((d: any) =>
    Array.isArray(d.activities) ? d.activities.map((a: any) => a.title) : [],
  );

  try {
    const { planContent: revised, narrationDegraded } = await runPipeline(
      mergeFeedbackIntoRequest(request, feedback, excludeNamesFor(feedback, previousNames)),
    );

    return res.json({
      success: true,
      planContent: await attachPhotos(revised, destination),
      narrationDegraded,
    });
  } catch (err) {
    console.error("[TripMate] 일정 수정 실패:", err);
    if (err instanceof NotEnoughPlacesError) {
      return res.status(422).json({
        success: false, data: null,
        error: { code: "NOT_ENOUGH_PLACES", message: err.message, field: null },
      });
    }
    // 쿼터 소진은 서버 오류가 아니다. 다시 눌러도 소용없고, 기다리는 것 외에 할 일이 없다.
    if (err instanceof QuotaExceededError) {
      return res.status(429).json({
        success: false, data: null,
        error: { code: "AI_QUOTA_EXCEEDED", message: err.message, field: null },
      });
    }
    // 설정 누락은 재시도로 풀리지 않는다. 500으로 뭉개면 "잠시 후 다시" 안내가 나가 헛되이 기다리게 된다.
    if (err instanceof ConfigMissingError) {
      console.error("[TripMate] 필수 환경변수 누락:", err.missing.join(", "));
      return res.status(503).json({
        success: false, data: null,
        error: { code: "SERVICE_NOT_CONFIGURED", message: err.message, field: null },
      });
    }
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
  } catch (err) {
    // 예외 메시지에는 내부 URL·경로가 실린다. 로그에만 남기고 응답에는 넣지 않는다.
    console.error("Server geocoding error:", err);
    return res.status(500).json({ error: "Internal server error" });
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
