/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditIcon, LocationIcon, CalendarIcon } from "../Icons";
import { searchDestinations } from "../../lib/destinations";
import { companions } from "./options";

interface StepBasicInfoProps {
  tripTitle: string;
  setTripTitle: (value: string) => void;
  destination: string;
  setDestination: (value: string) => void;
  showDestSuggestions: boolean;
  setShowDestSuggestions: (value: boolean) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  companion: string;
  setCompanion: (value: string) => void;
  onError: (message: string) => void;
}

/** 1단계 — 기본 정보: 여행 이름, 목적지(자동완성), 날짜, 동행. */
export default function StepBasicInfo({
  tripTitle,
  setTripTitle,
  destination,
  setDestination,
  showDestSuggestions,
  setShowDestSuggestions,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  companion,
  setCompanion,
  onError,
}: StepBasicInfoProps) {
  // 초성 검색 지원. 관련도 순 정렬은 searchDestinations가 처리한다.
  const filteredDestinations = searchDestinations(destination);

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

  return (
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
  );
}
