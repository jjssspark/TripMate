/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FEATURED_DESTINATIONS, HERO_IMAGE } from "../lib/homeContent";
import { TravelPlan } from "../types";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from "./Icons";
import StepBasicInfo from "./planner/StepBasicInfo";
import StepPreferences from "./planner/StepPreferences";
import StepDetails from "./planner/StepDetails";

// 서버가 준 메시지만 사용자에게 보여준다. 네트워크·파싱 예외의 영문 원문은
// 사용자에게 의미가 없고 내부 사정을 드러낸다.
class PlanRequestError extends Error {}

interface PlannerFlowProps {
  /** 홈의 추천 여행지에서 넘어온 경우 목적지를 미리 채운다. */
  initialDestination?: string;
  onPlanGenerated: (plan: TravelPlan) => void;
  /** type을 생략하면 실패("error")로 취급한다. 실패가 아닌 안내(예: 설명 누락)는 "success"로 넘긴다. */
  onError: (message: string, type?: "success" | "error") => void;
}

/** 생성 요청을 끊는 상한. 서버 예산(25초)보다 넉넉히 잡아 서버의 실패 응답이 먼저 도착하게 한다.
 *  여기서 먼저 끊으면 사용자는 이유 없는 타임아웃만 보고, 서버가 준비한 안내(장소 부족·한도 소진)를 놓친다. */
const GENERATION_TIMEOUT_MS = 30_000;

export default function PlannerFlow({
  initialDestination = "",
  onPlanGenerated,
  onError,
}: PlannerFlowProps) {
  const [step, setStep] = useState(1);
  // 단계 전환 방향(1=다음, -1=이전). 슬라이드가 진행 방향과 반대로 나가면 어색하다.
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();

  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  const [loading, setLoading] = useState(false);
  // 로딩이 얼마나 남았는지 보여 주려면 경과 시간이 필요하다.
  const [elapsed, setElapsed] = useState(0);

  // Form Fields — 사용자가 직접 입력한다. 기본값을 넣지 않는다.
  const [tripTitle, setTripTitle] = useState("");
  const [destination, setDestination] = useState(initialDestination);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 단일 선택 항목은 하나를 기본으로 둔다 (미선택 상태를 허용하면 별도 검증이 필요해진다)
  const [companion, setCompanion] = useState("혼자");

  // 인기 여행지 자동완성 드롭다운
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  // Preference styles (multiple select)
  const [styles, setStyles] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [mustVisitPlaces, setMustVisitPlaces] = useState<string[]>([]);
  const [budget, setBudget] = useState("표준형");
  const [intensity, setIntensity] = useState("여유롭게");
  const [transportMode, setTransportMode] = useState("대중교통");

  // Extra details
  const [comments, setComments] = useState("");

  // 폼 상단 사진도 목적지를 따라간다. 사진을 가진 8곳이 아니면 기본 이미지로 둔다.
  const destinationPhoto =
    FEATURED_DESTINATIONS.find((d) => destination.trim().startsWith(d.name))?.imageUrl ??
    HERO_IMAGE.url;

  // 로딩 중 경과 시간을 0.1초 단위로 센다. 끝나면 인터벌을 반드시 정리한다.
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(id);
  }, [loading]);

  const handleGenerate = async () => {
    setLoading(true);
    setElapsed(0);

    const requestPayload = {
      destination,
      startDate,
      endDate,
      companion,
      budget,
      intensity,
      transportMode,
      styles,
      mustVisitPlaces: mustVisitPlaces.join(", "),
      comments
    };

    console.log("★ [TripMate AI] AI 일정 생성 요청 시작:", requestPayload);

    // 서버는 25초 예산 안에서 응답하도록 되어 있다. 여기서 30초에 한 번 더 끊어
    // 네트워크가 멈춰도 로딩 화면이 무한정 돌지 않게 한다.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      console.log(`★ [TripMate AI] API 응답 수신 상태코드: ${response.status} (${response.statusText})`);

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new PlanRequestError(payload?.error?.message || "일정 생성에 실패했습니다.");
      }

      const plan: TravelPlan = await response.json();
      console.log("★ [TripMate AI] API 응답 파싱 성공. 생성된 일정 데이터:", plan);

      // Override default name if customized
      if (tripTitle.trim()) {
        plan.title = tripTitle.trim();
      }

      // 장소와 동선은 확정됐지만 설명 생성이 실패한 경우. 가짜 일정이 아니라 설명만 짧다.
      // 실패가 아니므로 error 배너가 아니라 success 톤 토스트로 안내한다.
      if (plan.narrationDegraded) {
        onError("일정은 만들었지만 설명을 다 쓰지 못했습니다. 다시 시도하면 설명이 채워집니다.", "success");
      }

      onPlanGenerated(plan);
    } catch (err) {
      console.error("★ [TripMate AI] AI Planner Flow Error (일정 생성 중 실패):", err);
      if (err instanceof DOMException && err.name === "AbortError") {
        onError("일정 생성이 30초를 넘겨 중단했습니다. 조건을 줄이고 다시 시도해 주세요.");
      } else {
        onError(
          err instanceof PlanRequestError
            ? err.message
            : "일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      clearTimeout(abortTimer);
      setLoading(false);
    }
  };

  if (loading) {
    const progress = Math.min(1, elapsed / GENERATION_TIMEOUT_MS);
    const secondsLeft = Math.max(0, Math.ceil((GENERATION_TIMEOUT_MS - elapsed) / 1000));

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        <img
          src={destinationPhoto}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover ${reduceMotion ? "" : "animate-ken-burns"}`}
        />
        <div className="absolute inset-0 bg-[#00131c]/80 backdrop-blur-md" />

        <div className="relative flex flex-col items-center max-w-sm">
          <div className="w-20 h-20 rounded-full border border-white/25 bg-white/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-3xl text-primary-fixed-dim animate-spin">
              progress_activity
            </span>
          </div>

          <h3 className="font-headline-md text-white text-xl mb-2 font-extrabold">
            {destination.trim() || "여행"} 일정을 그리는 중
          </h3>
          <p className="font-body-md text-white/70 leading-relaxed text-sm">
            취향에 맞는 동선과 식사 시간을 배치하고 있어요.
          </p>

          {/* 남은 시간을 보여 줘야 기다림이 예측 가능해진다. 30초를 넘기면 자동으로 중단된다. */}
          <div className="w-64 mt-7">
            <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-fixed-dim rounded-full transition-[width] duration-100 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2.5 text-[11px] font-semibold tracking-wide text-white/55 tabular-nums">
              최대 {secondsLeft}초 남음
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[720px] mx-auto select-none pb-4">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[26px] bg-surface-container-lowest border border-white/70 shadow-[0_28px_70px_-34px_rgba(0,60,90,0.5)]"
      >
        {/* 목적지 사진 헤더 — 고른 여행지에 따라 사진이 바뀐다 */}
        <div className="relative h-44 md:h-52 overflow-hidden rounded-t-[26px]">
          <AnimatePresence initial={false}>
            <motion.img
              key={destinationPhoto}
              src={destinationPhoto}
              alt=""
              aria-hidden="true"
              decoding="async"
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-[#00131c]/95 via-[#00131c]/55 to-[#00131c]/15" />

          <div className="relative h-full flex flex-col justify-end p-6 md:p-7">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-label-md text-primary-fixed-dim font-extrabold text-[11px] uppercase tracking-[0.22em]">
                Step {step} / 3
              </span>
              <span className="font-label-sm text-white/60 text-xs font-semibold">
                {step === 1 && "기본 정보 & 분위기"}
                {step === 2 && "나의 여행 취향"}
                {step === 3 && "최종 세부사항"}
              </span>
            </div>
            <h2 className="font-headline-lg text-white text-[26px] md:text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
              {step === 1 && (
                <>
                  <span className="text-primary-fixed-dim">꿈꾸던 여행</span>을 시작해보세요.
                </>
              )}
              {step === 2 && "취향을 알려주세요."}
              {step === 3 && "반드시 가고 싶은 곳"}
            </h2>
            <p className="text-white/70 font-body-md text-sm mt-1.5">
              {step === 1 && "기본 정보를 입력해주시면 AI가 맞춤 일정을 제안해 드립니다."}
              {step === 2 && "입력하신 정보를 바탕으로 당신만을 위한 맞춤 일정을 구성합니다."}
              {step === 3 && "놓치고 싶지 않은 랜드마크, 식당 또는 경험을 태그로 추가해 주세요."}
            </p>
          </div>

          {/* 진행 바 — 사진과 본문이 만나는 경계선에 붙인다 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
            <motion.div
              className="h-full bg-primary-container"
              initial={false}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* 단계 전환. direction에 따라 들어오고 나가는 방향이 뒤집힌다. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: reduceMotion ? 0 : direction * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduceMotion ? 0 : direction * -36 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {step === 1 && (
                <StepBasicInfo
                  tripTitle={tripTitle}
                  setTripTitle={setTripTitle}
                  destination={destination}
                  setDestination={setDestination}
                  showDestSuggestions={showDestSuggestions}
                  setShowDestSuggestions={setShowDestSuggestions}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  companion={companion}
                  setCompanion={setCompanion}
                  onError={onError}
                />
              )}

              {step === 2 && (
                <StepPreferences
                  styles={styles}
                  setStyles={setStyles}
                  budget={budget}
                  setBudget={setBudget}
                  intensity={intensity}
                  setIntensity={setIntensity}
                  transportMode={transportMode}
                  setTransportMode={setTransportMode}
                  onError={onError}
                />
              )}

              {step === 3 && (
                <StepDetails
                  destination={destination}
                  styles={styles}
                  tagInput={tagInput}
                  setTagInput={setTagInput}
                  mustVisitPlaces={mustVisitPlaces}
                  setMustVisitPlaces={setMustVisitPlaces}
                  comments={comments}
                  setComments={setComments}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper Actions footer */}
          <footer className="pt-8 flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            onClick={() => goToStep(step - 1)}
            type="button"
            className="px-6 py-3.5 rounded-xl border border-outline-variant hover:border-slate-400 font-label-md text-sm text-on-surface-variant font-bold bg-white active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            이전
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 1) {
                if (!destination.trim()) {
                  onError("목적지를 입력해주세요.");
                  return;
                }
                if (!startDate || !endDate) {
                  onError("여행 시작일과 종료일을 선택해주세요.");
                  return;
                }
                if (endDate < startDate) {
                  onError("종료일은 시작일보다 빠를 수 없습니다.");
                  return;
                }
              }
              goToStep(step + 1);
            }}
            type="button"
            className="flex-grow sm:flex-initial px-8 py-3.5 rounded-xl bg-primary text-white font-bold font-label-md text-sm shadow-md hover:opacity-95 active:scale-95 transition-all flex justify-center items-center gap-2 cursor-pointer border-none"
          >
            다음 단계
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            type="button"
            className="flex-grow sm:flex-initial px-8 py-3.5 rounded-xl bg-primary text-white font-extrabold font-headline-md text-sm shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer border-none"
          >
            일정 생성하기
            <SparklesIcon className="w-4 h-4" />
          </button>
        )}
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
