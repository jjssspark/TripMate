import { GoogleGenAI } from "@google/genai";
import { fetchCandidates } from "./candidates";
import { narrateDay } from "./narrate";
import { generateItinerary, type PipelineDeps, type PlanRequest } from "./pipeline";
import { createKakaoResolver } from "../places/kakao";
import { withTimeout, TimeoutError } from "./timeout";

const CANDIDATE_TIMEOUT_MS = 14_000;
const CANDIDATE_RETRY_TIMEOUT_MS = 5_000;
const NARRATE_TIMEOUT_MS = 10_000;
export const TOTAL_BUDGET_MS = 25_000;
// 설명이 끝난 뒤에도 결과 조립·사진 첨부·직렬화가 남는다. 그만큼은 설명에 주지 않는다.
const NARRATE_RESERVE_MS = 1_000;

/**
 * 총 예산 안에서 파이프라인을 돌린다. 바깥 타임아웃만 두면 설명 단계가 예산을 넘길 때
 * 검증·동선·시간 배치까지 끝난 일정을 통째로 버린다. 설명은 남은 예산만 쓰게 하고,
 * 예산이 없으면 아예 호출하지 않아 파이프라인의 강등 폴백으로 넘긴다.
 */
export async function runWithinBudget(
  deps: PipelineDeps,
  request: PlanRequest,
  budgetMs: number = TOTAL_BUDGET_MS,
): Promise<Awaited<ReturnType<typeof generateItinerary>>> {
  const deadline = Date.now() + budgetMs;
  const budgeted: PipelineDeps = {
    ...deps,
    narrateDay: (day, destination) => {
      const remaining = deadline - Date.now() - NARRATE_RESERVE_MS;
      // 남은 예산이 없으면 호출하지 않는다. 없는 예산으로 불러 놓고 타임아웃을 기다릴 이유가 없다.
      if (remaining <= 0) return Promise.reject(new TimeoutError(`${day.day}일차 설명`, 0));
      return withTimeout(
        deps.narrateDay(day, destination),
        Math.min(NARRATE_TIMEOUT_MS, remaining),
        `${day.day}일차 설명`,
      );
    },
  };
  return withTimeout(generateItinerary(budgeted, request), budgetMs, "일정 생성");
}

// 단계별 예산만으로는 총합이 안 잡힌다. 전체에도 상한을 둬서 클라이언트가 끊기 전에 우리가 끊는다.
export async function runPipeline(request: PlanRequest) {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  return runWithinBudget(
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
      narrateDay: (day, destination) => narrateDay(ai, day, destination),
    },
    request,
  );
}
