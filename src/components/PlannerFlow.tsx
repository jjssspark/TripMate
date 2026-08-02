/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FEATURED_DESTINATIONS, HERO_IMAGE } from "../lib/homeContent";
import { TravelPlan } from "../types";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon, EditIcon, LocationIcon, CalendarIcon } from "./Icons";
import { searchDestinations } from "../lib/destinations";
import { getRecommendedSpots } from "../lib/recommendedSpots";

interface PlannerFlowProps {
  /** 홈의 추천 여행지에서 넘어온 경우 목적지를 미리 채운다. */
  initialDestination?: string;
  onPlanGenerated: (plan: TravelPlan) => void;
  onError: (message: string) => void;
}

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

  // 초성 검색 지원. 관련도 순 정렬은 searchDestinations가 처리한다.
  const filteredDestinations = searchDestinations(destination);

  // 필수 방문 후보는 선택한 목적지에 따라 달라진다.
  const recommendedSpots = getRecommendedSpots(destination);

  // 폼 상단 사진도 목적지를 따라간다. 사진을 가진 8곳이 아니면 기본 이미지로 둔다.
  const destinationPhoto =
    FEATURED_DESTINATIONS.find((d) => destination.trim().startsWith(d.name))?.imageUrl ??
    HERO_IMAGE.url;

  const handleSelectDestination = (name: string) => {
    setDestination(name);
    setShowDestSuggestions(false);
  };

  // 종료일이 시작일보다 빠른 조합은 선택 시점에 막는다.
  // 날짜 문자열이 "YYYY-MM-DD" 고정 형식이라 문자열 비교로 대소가 정확히 나온다.
  const handleEndDateChange = (value: string) => {
    if (value && startDate && value < startDate) {
      onError("종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
      return;
    }
    setEndDate(value);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // 시작일을 기존 종료일보다 뒤로 옮기면 종료일이 무효가 되므로 비우고 알린다.
    if (value && endDate && endDate < value) {
      setEndDate("");
      onError("시작 날짜가 종료 날짜보다 늦어 종료 날짜를 다시 선택해주세요.");
    }
  };

  const companions = [
    { label: "혼자", icon: "person" },
    { label: "친구", icon: "group" },
    { label: "커플", icon: "favorite" },
    { label: "가족", icon: "family_restroom" }
  ];

  // 라벨은 그대로 AI 프롬프트에 실려 나가므로 서로 겹치지 않는 축으로만 늘린다.
  // (예: "바다"를 "자연"과 나눈 이유는 국내 여행에서 동선이 완전히 달라지기 때문)
  // 일정 속도는 아래 '여행 강도'가 전담한다. 여기에 "여유로운 일정" 같은 항목을 두면
  // 같은 질문을 한 화면에서 두 번 하게 된다.
  const travelStyles = [
    { label: "맛집", icon: "restaurant" },
    { label: "카페", icon: "local_cafe" },
    { label: "쇼핑", icon: "shopping_bag" },
    { label: "자연", icon: "forest" },
    { label: "바다/해변", icon: "beach_access" },
    { label: "역사/문화", icon: "history_edu" },
    { label: "전시/예술", icon: "palette" },
    { label: "액티비티", icon: "hiking" },
    { label: "야경/밤거리", icon: "nightlife" },
    { label: "온천/힐링", icon: "hot_tub" },
    { label: "사진 스팟", icon: "photo_camera" }
  ];

  // 전부 고르면 취향이 아니라 백화점이 된다. AI가 우선순위를 잡을 수 있도록 상한을 둔다.
  const MAX_STYLES = 5;
  const isStyleLimitReached = styles.length >= MAX_STYLES;

  const toggleStyle = (label: string) => {
    if (styles.includes(label)) {
      setStyles(styles.filter((s) => s !== label));
      return;
    }
    if (isStyleLimitReached) {
      onError(`여행 스타일은 최대 ${MAX_STYLES}개까지 고를 수 있어요.`);
      return;
    }
    setStyles([...styles, label]);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 IME 조합 중 Enter를 누르면 조합 확정 키다운과 실제 Enter 키다운이 연달아 발생해
    // 태그가 두 번 추가되는 문제가 있음 — 조합 중(isComposing)인 키다운은 무시한다.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, "");
      if (val && !mustVisitPlaces.includes(val)) {
        setMustVisitPlaces([...mustVisitPlaces, val]);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (index: number) => {
    setMustVisitPlaces(mustVisitPlaces.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setLoading(true);

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

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      console.log(`★ [TripMate AI] API 응답 수신 상태코드: ${response.status} (${response.statusText})`);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const plan: TravelPlan = await response.json();
      console.log("★ [TripMate AI] API 응답 파싱 성공. 생성된 일정 데이터:", plan);
      
      // Override default name if customized
      if (tripTitle.trim()) {
        plan.title = tripTitle.trim();
      }

      onPlanGenerated(plan);
    } catch (err) {
      console.error("★ [TripMate AI] AI Planner Flow Error (일정 생성 중 실패):", err);
      onError("일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-24 h-24 bg-primary-container/20 rounded-full flex items-center justify-center animate-pulse mb-6">
          <span className="material-symbols-outlined text-4xl text-primary-container animate-spin">
            progress_activity
          </span>
        </div>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-2 font-extrabold animate-bounce">
          AI 플래너 구성 중...
        </h3>
        <p className="font-body-md text-on-surface-variant max-w-sm leading-relaxed text-sm">
          TripMate AI가 사용님의 취향과 일정에 맞는 완벽한 동선과 식당 배치를 마법처럼 설계하고 있습니다. 잠시만 기다려주세요!
        </p>
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
          <div className="space-y-5">
            {/* Field: Trip Name */}
            <div className="space-y-1.5">
              <label className="block font-label-md text-on-surface-variant ml-1 text-xs" htmlFor="trip-title">
                여행 이름
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 transition-all border border-transparent">
                <span className="absolute left-4 text-outline flex items-center justify-center">
                  <EditIcon className="w-5 h-5" />
                </span>
                <input
                  id="trip-title"
                  type="text"
                  value={tripTitle}
                  onChange={(e) => setTripTitle(e.target.value)}
                  className="w-full bg-transparent border-none py-4 pl-12 pr-4 rounded-xl focus:ring-0 text-on-surface font-body-md placeholder:text-outline-variant outline-none"
                  placeholder={
                    destination.trim()
                      ? `예: ${destination.trim()}에서의 여름`
                      : "예: 제주도에서의 여름"
                  }
                />
              </div>
            </div>

            {/* Field: Destination */}
            <div className="relative space-y-1.5">
              <label className="block font-label-md text-on-surface-variant ml-1 text-xs" htmlFor="destination">
                목적지
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 transition-all border border-transparent">
                <span className="absolute left-4 text-outline flex items-center justify-center">
                  <LocationIcon className="w-5 h-5" />
                </span>
                <input
                  id="destination"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onFocus={() => setShowDestSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDestSuggestions(false), 150)}
                  autoComplete="off"
                  className="w-full bg-transparent border-none py-4 pl-12 pr-4 rounded-xl focus:ring-0 text-on-surface font-body-md placeholder:text-outline-variant outline-none"
                  placeholder="여행지를 입력하세요 (예: 강릉, 제주도, ㄱㄴ)"
                  required
                />
              </div>

              {/* 인기 여행지 자동완성 드롭다운 */}
              {showDestSuggestions && filteredDestinations.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-outline-variant/50 rounded-xl shadow-lg overflow-hidden">
                  {filteredDestinations.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDestination(name)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-on-surface hover:bg-primary/5 border-none bg-transparent cursor-pointer"
                      >
                        <LocationIcon className="w-4 h-4 text-outline shrink-0" />
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Field: Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-label-md text-on-surface-variant ml-1 text-xs">
                  시작 날짜
                </label>
                <div className="relative flex items-center bg-surface-container-low rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 transition-all border border-transparent">
                  <span className="absolute left-4 text-outline flex items-center justify-center pointer-events-none">
                    <CalendarIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full bg-transparent border-none py-4 pl-12 pr-4 rounded-xl focus:ring-0 text-on-surface font-body-md outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-label-md text-on-surface-variant ml-1 text-xs">
                  종료 날짜
                </label>
                <div className="relative flex items-center bg-surface-container-low rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 transition-all border border-transparent">
                  <span className="absolute left-4 text-outline flex items-center justify-center pointer-events-none">
                    <CalendarIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full bg-transparent border-none py-4 pl-12 pr-4 rounded-xl focus:ring-0 text-on-surface font-body-md outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Field: Companion Chips */}
            <div className="space-y-3 pt-2">
              <label className="block font-label-md text-on-surface-variant ml-1 text-xs">
                누구와 함께하시나요?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {companions.map((comp) => {
                  const isActive = companion === comp.label;
                  return (
                    <button
                      key={comp.label}
                      type="button"
                      onClick={() => setCompanion(comp.label)}
                      className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white shadow-md font-bold"
                          : "border-outline-variant text-on-surface-variant hover:border-slate-400 bg-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px] flex items-center justify-center">
                        {comp.icon}
                      </span>
                      <span className="font-label-md text-xs">{comp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Travel Style Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">style</span>
                <h3 className="font-headline-md text-base leading-6 font-bold">여행 스타일</h3>
                <span
                  aria-live="polite"
                  className={`ml-auto font-label-md text-xs font-bold tabular-nums ${
                    isStyleLimitReached ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {styles.length} / {MAX_STYLES}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {travelStyles.map((style) => {
                  const isActive = styles.includes(style.label);
                  // 상한에 걸린 항목은 흐리게 보여 주되 클릭은 살려 둔다.
                  // disabled로 막으면 왜 안 눌리는지 알려줄 기회가 없다.
                  const isMuted = !isActive && isStyleLimitReached;
                  return (
                    <button
                      key={style.label}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleStyle(style.label)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-primary border-primary text-white font-semibold"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-slate-400"
                      } ${isMuted ? "opacity-40" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[16px] flex items-center justify-center">
                        {style.icon}
                      </span>
                      <span className="font-label-md text-xs">{style.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Budget Level selection */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl font-bold">
                  payments
                </span>
                <h3 className="font-headline-md text-base leading-6 font-bold">예산 수준</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["절약형", "표준형", "고급형"].map((lvl) => {
                  const isActive = budget === lvl;
                  const icons = {
                    절약형: "savings",
                    표준형: "account_balance_wallet",
                    고급형: "diamond"
                  };
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setBudget(lvl)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white font-bold"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl flex items-center justify-center">
                        {lvl === "절약형" ? icons.절약형 : lvl === "표준형" ? icons.표준형 : icons.고급형}
                      </span>
                      <span className="font-label-sm text-xs">{lvl}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Travel Intensity (하루 스팟 개수) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl font-bold">
                  speed
                </span>
                <h3 className="font-headline-md text-base leading-6 font-bold">여행 강도</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "여유롭게", desc: "하루 1~3곳 (식사 제외)", icon: "self_improvement" },
                  { label: "빡빡하게", desc: "하루 4~8곳 (식사 제외)", icon: "directions_run" }
                ].map((opt) => {
                  const isActive = intensity === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setIntensity(opt.label)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white font-bold"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl flex items-center justify-center">
                        {opt.icon}
                      </span>
                      <span className="font-label-sm text-xs">{opt.label}</span>
                      <span className={`text-[10px] ${isActive ? "text-white/80" : "text-outline"}`}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Transport Mode (동선 계산에 반영) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl font-bold">
                  directions
                </span>
                <h3 className="font-headline-md text-base leading-6 font-bold">이동수단</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "도보", icon: "directions_walk" },
                  { label: "대중교통", icon: "directions_bus" },
                  { label: "자차", icon: "directions_car" }
                ].map((opt) => {
                  const isActive = transportMode === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setTransportMode(opt.label)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white font-bold"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl flex items-center justify-center">
                        {opt.icon}
                      </span>
                      <span className="font-label-sm text-xs">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {/* Must Visit tags input box */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-[0_4px_16px_rgba(0,0,0,0.03)] space-y-4">
              <p className="font-body-md text-sm text-on-surface-variant">
                놓치고 싶지 않은 명소, 식당 또는 특별한 경험을 입력해 주세요. (엔터 또는 쉼표 입력)
              </p>
              
              <div className="flex flex-wrap gap-2 p-3 bg-surface-container-low rounded-xl border border-transparent focus-within:border-primary-container focus-within:bg-white transition-all">
                <div className="flex flex-wrap gap-2">
                  {mustVisitPlaces.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full font-label-md text-xs select-none"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="material-symbols-outlined text-[14px] hover:text-error transition-colors p-0 border-0 bg-transparent cursor-pointer flex items-center justify-center font-bold"
                      >
                        close
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-body-md text-on-surface min-w-[120px] outline-none h-6 text-sm"
                  placeholder={
                    recommendedSpots.length > 0
                      ? `예: ${recommendedSpots.slice(0, 2).join(", ")} 등`
                      : "예: 성산일출봉, 감천문화마을, 전주한옥마을 등"
                  }
                />
              </div>

              {/* 선택한 목적지의 실제 명소를 추천한다. 매칭되는 곳이 없으면 줄 자체를 감춘다. */}
              {recommendedSpots.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center pt-1.5">
                <span className="font-label-sm text-on-surface-variant text-xs mr-1 opacity-80">
                  {destination.trim()} 추천 장소:
                </span>
                {recommendedSpots.map((sg) => (
                  <button
                    key={sg}
                    type="button"
                    onClick={() => {
                      if (!mustVisitPlaces.includes(sg)) {
                        setMustVisitPlaces([...mustVisitPlaces, sg]);
                      }
                    }}
                    className="px-2.5 py-1 text-xs border border-outline-variant hover:border-primary rounded-full hover:bg-primary/5 transition-all text-on-surface-variant font-medium cursor-pointer"
                  >
                    {sg}
                  </button>
                ))}
              </div>
              )}
            </div>

            {/* Field: Comments requesting prompt adjustments */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-[0_4px_16px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined font-extrabold flex items-center justify-center">
                  notes
                </span>
                <h3 className="font-headline-md text-base leading-6 font-bold">AI 추가 요청 사항</h3>
              </div>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full h-32 bg-surface-container-low border-none rounded-xl p-3 focus:ring-2 focus:ring-primary-container focus:bg-white transition-all text-on-surface placeholder:text-outline text-sm resize-none outline-none"
                placeholder="예: '대중교통보다는 걷는 것을 선호해요', '숨겨진 조용한 힐링 코스 추천해주세요', '어린 아이와 함께 가기 편한 동선이 필요해요' 등 특별히 원하시는 필터를 입력해주세요."
              />
            </div>

            {/* AI Insights Card */}
            <div className="p-4 bg-primary-container/10 border border-primary/10 rounded-2xl flex gap-3 items-start select-text">
              <span className="material-symbols-outlined text-primary bg-white p-2 rounded-full shrink-0 shadow-sm text-lg font-bold flex items-center justify-center">
                auto_awesome
              </span>
              <div className="flex flex-col gap-0.5">
                <h4 className="font-label-md text-xs text-primary font-bold uppercase tracking-wider">
                  AI 추천 가이드
                </h4>
                <p className="text-xs text-on-surface-variant italic leading-relaxed">
                  "취향 분석 결과, '{styles.join(", ")}' 테마를 극대화할 수 있도록 일정을 배치할게요. 구체적인 메모를 추가해 주시면 현지 혼잡도를 피해 맞춤 설계가 가능합니다."
                </p>
              </div>
            </div>
          </div>
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
