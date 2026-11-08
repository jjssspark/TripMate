/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { getRecommendedSpots } from "../../lib/recommendedSpots";

interface StepDetailsProps {
  destination: string;
  styles: string[];
  tagInput: string;
  setTagInput: (value: string) => void;
  mustVisitPlaces: string[];
  setMustVisitPlaces: (value: string[]) => void;
  comments: string;
  setComments: (value: string) => void;
}

/** 3단계 — 최종 세부사항: 필수 방문 태그, AI 추가 요청. */
export default function StepDetails({
  destination,
  styles,
  tagInput,
  setTagInput,
  mustVisitPlaces,
  setMustVisitPlaces,
  comments,
  setComments,
}: StepDetailsProps) {
  // 필수 방문 후보는 선택한 목적지에 따라 달라진다.
  const recommendedSpots = getRecommendedSpots(destination);

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

  return (
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
  );
}
