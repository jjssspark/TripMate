import { GoogleGenAI } from "@google/genai";
import { fetchCandidates } from "./candidates";
import { narrateDay } from "./narrate";
import { generateItinerary, type PlanRequest } from "./pipeline";
import { createKakaoResolver } from "../places/kakao";
import { withTimeout, TimeoutError } from "./timeout";

const CANDIDATE_TIMEOUT_MS = 14_000;
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
      // 시간 초과는 모델이 느린 것이라 다시 불러도 같다. 남은 예산만 태우고 끝난다.
      // 일시적 API 오류만 한 번 더 시도한다 — 이쪽은 대개 즉시 실패해 예산을 거의 안 쓴다.
      fetchCandidates: async (req) => {
        try {
          return await withTimeout(fetchCandidates(ai, req), CANDIDATE_TIMEOUT_MS, "후보 추출");
        } catch (err) {
          if (err instanceof TimeoutError) throw err;
          return withTimeout(fetchCandidates(ai, req), CANDIDATE_RETRY_TIMEOUT_MS, "후보 추출 재시도");
        }
      },
      narrateDay: (day, destination) =>
        withTimeout(narrateDay(ai, day, destination), NARRATE_TIMEOUT_MS, `${day.day}일차 설명`),
    },
    request,
  );
}
