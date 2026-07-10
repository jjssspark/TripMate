/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { TravelPlan } from "../types";
import { fetchPublicPlan } from "../lib/supabaseClient";
import PlanResultView from "./PlanResultView";
import { ExploreIcon } from "./Icons";

interface PublicTripViewProps {
  planId: string;
}

// 공유 링크(/trip/:id) 전용 진입점 — 로그인/세션과 무관하게 공개 설정된(is_shared=true)
// 일정 하나만 읽기 전용으로 보여준다. App.tsx의 tab 기반 화면 구조와는 완전히 분리되어 있다.
export default function PublicTripView({ planId }: PublicTripViewProps) {
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not_found">("loading");

  useEffect(() => {
    let isMounted = true;
    fetchPublicPlan(planId).then((result) => {
      if (!isMounted) return;
      if (result) {
        setPlan(result);
        setStatus("ready");
      } else {
        setStatus("not_found");
      }
    });
    return () => {
      isMounted = false;
    };
  }, [planId]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white/90 backdrop-blur-md flex items-center px-6 w-full h-16 border-b border-surface-variant select-none">
        <a href="/" className="flex items-center gap-2 cursor-pointer select-none">
          <ExploreIcon className="text-primary w-8 h-8 fill-primary/10" />
          <h1 className="text-xl font-extrabold text-black tracking-tight font-headline-lg">TripMate AI</h1>
        </a>
      </header>

      <main className="flex-grow pt-10 px-6 pb-16">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <p className="text-sm font-semibold">공유된 일정을 불러오는 중...</p>
          </div>
        )}

        {status === "not_found" && (
          <div className="max-w-md mx-auto text-center py-24 space-y-3">
            <span className="material-symbols-outlined text-5xl text-outline-variant">link_off</span>
            <h2 className="text-lg font-extrabold text-on-surface">일정을 찾을 수 없어요</h2>
            <p className="text-xs text-outline leading-relaxed">
              링크가 잘못되었거나, 작성자가 공유를 비공개로 전환했을 수 있어요.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 mt-4 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs"
            >
              TripMate AI 홈으로 이동
            </a>
          </div>
        )}

        {status === "ready" && plan && (
          <>
            <div className="max-w-[1000px] mx-auto mb-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-bold text-primary">
                👀 {plan.destination} 여행 일정을 공유받았어요. 마음에 든다면 나만의 일정도 만들어보세요!
              </p>
              <a
                href="/"
                className="shrink-0 bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs"
              >
                나도 만들어보기
              </a>
            </div>
            <PlanResultView plan={plan} readOnly />
          </>
        )}
      </main>
    </div>
  );
}
