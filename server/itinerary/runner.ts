import { GoogleGenAI } from "@google/genai";
import { fetchCandidates } from "./candidates";
import { narrateDay } from "./narrate";
import { generateItinerary, type PlanRequest } from "./pipeline";
import { createKakaoResolver } from "../places/kakao";
import { withTimeout } from "./timeout";

const CANDIDATE_TIMEOUT_MS = 8_000;
const CANDIDATE_RETRY_TIMEOUT_MS = 5_000;
const NARRATE_TIMEOUT_MS = 10_000;

export async function runPipeline(request: PlanRequest) {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  return generateItinerary(
    {
      resolver: createKakaoResolver(kakaoKey),
      // 1단계는 파이프라인 전체의 전제다. 한 번만 재시도한다.
      fetchCandidates: (req) =>
        withTimeout(fetchCandidates(ai, req), CANDIDATE_TIMEOUT_MS, "후보 추출").catch(() =>
          withTimeout(fetchCandidates(ai, req), CANDIDATE_RETRY_TIMEOUT_MS, "후보 추출 재시도"),
        ),
      narrateDay: (day, destination) =>
        withTimeout(narrateDay(ai, day, destination), NARRATE_TIMEOUT_MS, `${day.day}일차 설명`),
    },
    request,
  );
}
