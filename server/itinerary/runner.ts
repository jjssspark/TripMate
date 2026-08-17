import { GoogleGenAI } from "@google/genai";
import { fetchCandidates } from "./candidates";
import { narrateTrip } from "./narrate";
import { generateItinerary, type PipelineDeps, type PlanDay, type PlanRequest } from "./pipeline";
import { applyIntent, classifyFeedback } from "./intent";
import { wantsDifferentPlaces } from "./revise";
import { createKakaoResolver } from "../places/kakao";
import { isQuotaError, toQuotaError } from "./quota";
import { requireApiKeys } from "./config";
import { withTimeout, TimeoutError } from "./timeout";

const CANDIDATE_TIMEOUT_MS = 14_000;
const CANDIDATE_RETRY_TIMEOUT_MS = 5_000;
// 여행 전체를 한 번에 받으므로 일차 하나짜리 호출보다 오래 걸린다.
const NARRATE_TIMEOUT_MS = 14_000;
export const TOTAL_BUDGET_MS = 25_000;

const createClient = (apiKey: string) =>
  new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

// 설명이 끝난 뒤에도 이 예산 안에서 planContent 조립이 남는다. 그만큼은 설명에 주지 않는다.
// (사진 첨부는 runWithinBudget 바깥에서 도므로 이 예산에 포함되지 않는다.)
const NARRATE_RESERVE_MS = 1_000;
/**
 * 설명 호출이 성립하는 최소 예산. 실측에서 4일치 배치가 flash-lite로 8.4~10.3초 걸렸고,
 * 4초를 받은 호출은 4초를 다 태우고 실패했다. 이보다 적게 남았으면 부르지 않는다.
 */
const NARRATE_FLOOR_MS = 6_000;

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
    narrateTrip: (days, destination) => {
      const remaining = deadline - Date.now() - NARRATE_RESERVE_MS;
      // 남은 예산이 하한에 못 미치면 부르지 않는다. 실측에서 4초를 받은 호출이 4초를 다
      // 태우고 실패했다 — 어차피 강등될 일정에 벽시계 4초와 무료 한도 1회를 버린 셈이다.
      // 못 끝낼 걸 알면 즉시 최소 문구로 넘긴다.
      if (remaining < NARRATE_FLOOR_MS) return Promise.reject(new TimeoutError("설명", Math.max(remaining, 0)));
      return withTimeout(
        deps.narrateTrip(days, destination),
        Math.min(NARRATE_TIMEOUT_MS, remaining),
        "설명",
      );
    },
  };
  return withTimeout(generateItinerary(budgeted, request), budgetMs, "일정 생성");
}

/**
 * 시간 초과는 모델이 느린 것이라 다시 불러도 같다. 남은 예산만 태우고 끝난다.
 * 쿼터 소진도 다시 불러도 같은 429다 — 남은 한도만 한 번 더 깎는다.
 * 일시적 API 오류만 한 번 더 시도한다. 이쪽은 대개 즉시 실패해 예산을 거의 안 쓴다.
 */
export async function fetchWithRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await withTimeout(call(), CANDIDATE_TIMEOUT_MS, "후보 추출");
  } catch (err) {
    if (err instanceof TimeoutError) throw err;
    if (isQuotaError(err)) throw err;
    return withTimeout(call(), CANDIDATE_RETRY_TIMEOUT_MS, "후보 추출 재시도");
  }
}

function createDeps(ai: GoogleGenAI, kakaoKey: string): PipelineDeps {
  return {
    resolver: createKakaoResolver(kakaoKey),
    fetchCandidates: (req) => fetchWithRetry(() => fetchCandidates(ai, req)),
    narrateTrip: (days, destination) => narrateTrip(ai, days, destination),
  };
}

// 단계별 예산만으로는 총합이 안 잡힌다. 전체에도 상한을 둬서 클라이언트가 끊기 전에 우리가 끊는다.
export async function runPipeline(request: PlanRequest) {
  const { geminiKey, kakaoKey } = requireApiKeys();
  const ai = createClient(geminiKey);

  try {
    return await runWithinBudget(createDeps(ai, kakaoKey), request);
  } catch (err) {
    // 쿼터 소진을 진짜 서버 오류와 섞으면 사용자는 무엇을 해야 할지 알 수 없다.
    throw toQuotaError(err);
  }
}

/**
 * 수정은 피드백을 요청 조건으로 옮긴 뒤 파이프라인을 다시 태운다.
 *
 * 분류를 거치지 않으면 피드백이 comments 문자열에만 남는데, 그 뒤 단계가 전부
 * 결정론적이라 "여유롭게 해줘" 같은 요청이 결과를 바꾸지 못한다. applied는 무엇이
 * 실제로 반영됐는지이며, 비어 있으면 호출부가 수정했다고 말해서는 안 된다.
 */
export async function runRevision(
  base: PlanRequest,
  feedback: string,
  previousNames: readonly string[],
): Promise<{ planContent: PlanDay[]; narrationDegraded: boolean; applied: string[] }> {
  const { geminiKey, kakaoKey } = requireApiKeys();
  const ai = createClient(geminiKey);

  try {
    const classified = await classifyFeedback(ai, feedback, previousNames, base.days);
    // 분류가 아무것도 못 건졌을 때만 키워드 판정으로 받친다. 모델 호출이 실패하거나
    // 빈 객체를 돌려줘도 "장소 바꿔줘"만큼은 예전처럼 동작해야 한다.
    const intent = Object.keys(classified).length > 0
      ? classified
      : wantsDifferentPlaces(feedback) ? { replaceAllPlaces: true } : {};

    const { request, applied } = applyIntent(base, feedback, intent, previousNames);
    console.error(`[TripMate] 수정 의도 반영: ${applied.join(", ") || "없음"}`);

    const result = await runWithinBudget(createDeps(ai, kakaoKey), request);
    return { ...result, applied };
  } catch (err) {
    throw toQuotaError(err);
  }
}
