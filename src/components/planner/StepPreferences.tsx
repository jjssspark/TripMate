/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { travelStyles, MAX_STYLES } from "./options";

interface StepPreferencesProps {
  styles: string[];
  setStyles: (value: string[]) => void;
  budget: string;
  setBudget: (value: string) => void;
  intensity: string;
  setIntensity: (value: string) => void;
  transportMode: string;
  setTransportMode: (value: string) => void;
  onError: (message: string) => void;
}

/** 2단계 — 여행 취향: 스타일(복수 선택), 예산, 강도, 이동수단. */
export default function StepPreferences({
  styles,
  setStyles,
  budget,
  setBudget,
  intensity,
  setIntensity,
  transportMode,
  setTransportMode,
  onError,
}: StepPreferencesProps) {
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

  return (
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
  );
}
