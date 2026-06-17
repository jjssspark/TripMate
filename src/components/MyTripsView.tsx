/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TravelPlan, UserSession } from "../types";
import { TrashIcon, ShareIcon, LocationIcon } from "./Icons";
import { getSupabaseConfig } from "../lib/supabaseClient";

interface MyTripsViewProps {
  session: UserSession;
  plans: TravelPlan[];
  onViewPlan: (plan: TravelPlan) => void;
  onDeletePlan: (id: string) => void;
}

export default function MyTripsView({
  session,
  plans,
  onViewPlan,
  onDeletePlan,
}: MyTripsViewProps) {
  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    const yes = window.confirm(`[${title}] 여행 일정을 보관함에서 영구 삭제하시겠습니까?`);
    if (yes) {
      onDeletePlan(id);
    }
  };

  // Profile levels and custom preferences stats
  const totalDays = plans.reduce((accum, curr) => {
    const isNumber = parseInt(curr.duration);
    return accum + (isNaN(isNumber) ? 3 : isNumber + 1);
  }, 0);

  const uniqueDestinations = Array.from(new Set(plans.map((p) => p.destination)));

  return (
    <div className="w-full max-w-[1240px] mx-auto select-none animate-in fade-in slide-in-from-bottom duration-500 pb-16">
      {/* Banner / Header profile summary details exactly from My Page Mockup */}
      <section className="mb-10 bg-slate-950 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg shadow-black/10 select-text">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 Q50,60 100,0 T200,0 L200,100 L0,100 Z" fill="white" />
          </svg>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-inner shrink-0 select-none">
              <img alt="User" src={session.avatarUrl} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight">{session.name}</h2>
                <span className="bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  Level 4 • 메달리스트
                </span>
              </div>
              <p className="text-xs text-white/70 mt-1 leading-relaxed max-w-sm">
                "{plans.length > 0 ? "나만의 취향 일정이 차곡차곡 쌓이고 있어요!" : "새로운 모험이 가득한 여행을 추가해보세요"}"
              </p>
            </div>
          </div>

          <div className="flex gap-4 md:gap-8 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm self-start md:self-auto min-w-[240px] select-all">
            <div className="flex-1 text-center">
              <p className="text-xs text-white/50 font-semibold mb-1">총 계획</p>
              <p className="text-xl font-extrabold text-primary leading-none select-text">{plans.length}개</p>
            </div>
            <div className="w-[1px] bg-white/10 self-stretch"></div>
            <div className="flex-1 text-center">
              <p className="text-xs text-white/50 font-semibold mb-1">방문한 도시</p>
              <p className="text-xl font-extrabold text-white leading-none select-text">{uniqueDestinations.length}곳</p>
            </div>
            <div className="w-[1px] bg-white/10 self-stretch"></div>
            <div className="flex-1 text-center">
              <p className="text-xs text-white/50 font-semibold mb-1">여행 누적일</p>
              <p className="text-xl font-extrabold text-white leading-none select-text">{totalDays}일</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Saved plans list title */}
      <h3 className="text-xl font-bold text-on-surface font-headline-md mb-6 flex items-center gap-2">
        내 저장된 여행 리스트
      </h3>

      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            // First activity image fallback
            const displayImage =
              plan.planContent?.[0]?.activities?.[0]?.imageUrl ||
              "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500&auto=format&fit=crop";

            return (
              <div
                key={plan.id}
                onClick={() => onViewPlan(plan)}
                className="bg-white rounded-2xl overflow-hidden border border-outline-variant/35 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full relative"
              >
                {/* Image Backdrop inside card banner */}
                <div className="h-44 bg-surface-variant relative overflow-hidden">
                  <img
                    alt={plan.destination}
                    src={displayImage}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                  
                  {/* Category overlay tags */}
                  <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap max-w-[80%] select-none items-center">
                    {getSupabaseConfig().active ? (
                      <span className="bg-emerald-500/95 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        Supabase Cloud
                      </span>
                    ) : (
                      <span className="bg-slate-800/90 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-sm">
                        📂 Local DB
                      </span>
                    )}
                    {plan.styles?.slice(0, 2).map((st) => (
                      <span
                        key={st}
                        className="bg-white/95 text-primary text-[10px] font-bold px-2 rounded-md py-1 shadow-sm"
                      >
                        #{st}
                      </span>
                    ))}
                  </div>

                  {/* Immediate Delete action (Gwak Jin-ah's delete functional requirement!) */}
                  <button
                    onClick={(e) => handleDeleteClick(e, plan.id, plan.title)}
                    className="absolute top-4 right-4 bg-white/90 text-on-surface-variant hover:text-error hover:bg-white p-2 border border-transparent rounded-full shadow-sm cursor-pointer transition-all active:scale-90"
                    title="일정 삭제"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Info Text sections */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-base font-extrabold text-on-surface mb-1 group-hover:text-primary transition-colors truncate">
                      {plan.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant mb-4 flex items-center gap-1.5 font-medium leading-relaxed">
                      <span className="material-symbols-outlined text-[15px] text-outline flex items-center justify-center font-bold">
                        calendar_today
                      </span>
                      {plan.startDate.replace(/-/g, ".")} - {plan.endDate.replace(/-/g, ".")} ({plan.duration})
                    </p>
                  </div>

                  {/* Secondary info and button details links */}
                  <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between select-none">
                    <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                      <LocationIcon className="w-3.5 h-3.5" />
                      {plan.destination}
                    </span>
                    <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      자세히 보기
                      <span className="material-symbols-outlined text-xs flex items-center justify-center font-bold">
                        chevron_right
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-outline-variant/40 p-12 text-center text-on-surface-variant flex flex-col items-center justify-center gap-4">
          <span className="material-symbols-outlined text-5xl text-outline-variant flex items-center justify-center">
            bookmarks
          </span>
          <div className="space-y-1.5 max-w-sm">
            <p className="font-extrabold text-sm text-on-surface">여행 보관함이 비어있습니다.</p>
            <p className="text-xs text-outline leading-relaxed">
              트립메이트 AI에서 당신의 여행 취미와 예산에 꼭 맞는 개인 스케줄 일정을 생성하고 이곳 보관함에 안전하게 저장해 보세요!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
