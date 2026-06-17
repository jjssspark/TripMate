/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { TravelPlan } from "../types";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon, EditIcon, LocationIcon, CalendarIcon, UsersIcon } from "./Icons";

interface PlannerFlowProps {
  onPlanGenerated: (plan: TravelPlan) => void;
}

export default function PlannerFlow({ onPlanGenerated }: PlannerFlowProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form Fields (테스트용 기본값 설정)
  const [tripTitle, setTripTitle] = useState("대전으로 떠나는 먹방 여행");
  const [destination, setDestination] = useState("대전");
  const [startDate, setStartDate] = useState("2026-06-10");
  const [endDate, setEndDate] = useState("2026-06-12");
  const [companion, setCompanion] = useState("혼자");
  
  // Preference styles (multiple select)
  const [styles, setStyles] = useState<string[]>(["맛집", "자연"]);
  const [tagInput, setTagInput] = useState("");
  const [mustVisitPlaces, setMustVisitPlaces] = useState<string[]>(["성심당", "한밭수목원"]);
  const [budget, setBudget] = useState("표준형");

  // Extra details
  const [comments, setComments] = useState("넉넉한 여행 스케쥴");

  const companions = [
    { label: "혼자", icon: "person" },
    { label: "친구", icon: "group" },
    { label: "커플", icon: "favorite" },
    { label: "가족", icon: "family_restroom" }
  ];

  const travelStyles = [
    { label: "맛집", icon: "restaurant" },
    { label: "카페", icon: "local_cafe" },
    { label: "쇼핑", icon: "shopping_bag" },
    { label: "자연", icon: "forest" },
    { label: "역사/문화", icon: "history_edu" },
    { label: "사진 스팟", icon: "photo_camera" },
    { label: "여유로운 일정", icon: "spa" }
  ];

  const toggleStyle = (label: string) => {
    if (styles.includes(label)) {
      setStyles(styles.filter((s) => s !== label));
    } else {
      setStyles([...styles, label]);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      // Fallback is also sent by server, so we are safe
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
    <div className="w-full max-w-[640px] mx-auto select-none py-4">
      {/* Progress Header */}
      <header className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="font-label-md text-primary font-bold text-xs uppercase tracking-wider">
            {step} / 3 단계
          </span>
          <span className="font-label-sm text-on-surface-variant text-xs font-semibold text-outline">
            {step === 1 && "기본 정보 & 분위기"}
            {step === 2 && "나의 여행 취향"}
            {step === 3 && "최종 세부사항"}
          </span>
        </div>
        <div className="flex gap-2 h-1.5 w-full bg-surface-variant/35 rounded-full overflow-hidden">
          <div
            className={`h-full bg-primary rounded-full transition-all duration-500`}
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </header>

      {/* Hero Welcome Prompts */}
      <div className="mb-8">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-extrabold leading-tight">
          {step === 1 && (
            <>
              <span className="text-primary-container">꿈꾸던 여행</span>을 시작해보세요.
            </>
          )}
          {step === 2 && "취향을 알려주세요."}
          {step === 3 && "반드시 방문하고 싶은 장소"}
        </h2>
        <p className="text-on-surface-variant font-body-md text-sm mt-1">
          {step === 1 && "기본 정보를 입력해주시면 AI가 맞춤 일정을 제안해 드립니다."}
          {step === 2 && "입력하신 정보를 바탕으로 당신만을 위한 맞춤 일정을 구성합니다."}
          {step === 3 && "놓치고 싶지 않은 랜드마크, 식당 또는 경험을 태그로 추가해 주세요."}
        </p>
      </div>

      {/* Step Contents */}
      <div className="space-y-6">
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
                  placeholder="예: 아말피 해안에서의 여름"
                />
              </div>
            </div>

            {/* Field: Destination */}
            <div className="space-y-1.5">
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
                  className="w-full bg-transparent border-none py-4 pl-12 pr-4 rounded-xl focus:ring-0 text-on-surface font-body-md placeholder:text-outline-variant outline-none"
                  placeholder="도시 또는 국가를 입력하세요 (예: 도쿄, 제주도 등)"
                  required
                />
              </div>
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
                    onChange={(e) => setStartDate(e.target.value)}
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
                    onChange={(e) => setEndDate(e.target.value)}
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
              </div>
              <div className="flex flex-wrap gap-2">
                {travelStyles.map((style) => {
                  const isActive = styles.includes(style.label);
                  return (
                    <button
                      key={style.label}
                      type="button"
                      onClick={() => toggleStyle(style.label)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-primary border-primary text-white font-semibold"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-slate-400"
                      }`}
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
                  placeholder="예: 츠키지 시장, 루브르 박물관, 에펠탑 등"
                />
              </div>

              {/* Sample suggestion buttons */}
              <div className="flex flex-wrap gap-1.5 items-center pt-1.5">
                <span className="font-label-sm text-on-surface-variant text-xs mr-1 opacity-80">추천 장소:</span>
                {["몽마르뜨 언덕", "세느강 크루즈", "현지 로컬빵집", "전망대"].map((sg) => (
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
      </div>

      {/* Stepper Actions footer */}
      <footer className="pt-10 flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
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
              if (step === 1 && !destination.trim()) {
                alert("목적지를 입력해주세요!");
                return;
              }
              setStep(step + 1);
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
  );
}
