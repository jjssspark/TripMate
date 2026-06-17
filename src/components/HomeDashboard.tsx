/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TravelPlan, UserSession } from "../types";
import { PlusCircleIcon } from "./Icons";

interface HomeDashboardProps {
  session: UserSession;
  savedPlans: TravelPlan[];
  onStartNewTrip: () => void;
  onViewPlan: (plan: TravelPlan) => void;
  onDeletePlan: (id: string) => void;
}

export default function HomeDashboard({
  session,
  savedPlans,
  onStartNewTrip,
  onViewPlan,
}: HomeDashboardProps) {
  // Take at most 2 plans for quick index view
  const recentPlans = savedPlans.slice(0, 2);

  const recommendedPlaces = [
    {
      name: "도쿄, 일본",
      description: "전통과 첨단이 공존하는 미식의 도시",
      category: "인기 급상승",
      imgUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWwaT6yvcSZZqChzslpAIM-mXP8HAwO9RMpNMpU7_5xZGThfsEePx0ScT3Qo0nX7SFSzH7HMHO3geh1p8DFWH9aDwH34TftFrWmxX3ddCs4Cep4uebO_YQCf4JYEEtYXSzj774RBfZMXnBNjImFCGNSEw61WdvtDLNmKNZ9PASDjeS6f-mmWoUdx7Ernoow4EJzBEGMnr9WpRC7zd7hLmk82gAxqi89dziKBSB17y5_hBkGyNm79guUxhg3YQ7Zvvxmm70aFmc0NE",
    },
    {
      name: "오사카, 일본",
      description: "환상적인 성과 따스한 가을의 정취",
      category: "가족들과 함께",
      imgUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU",
    },
    {
      name: "시드니, 호주",
      description: "신선한 연안 바람과 푸른 오션 하이라이트",
      category: "체험형 휴양",
      imgUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNj026qW-ZpTYzKavkSWxoW6ztR42Cm0-_DYA0Vrty1MhmDNAhOYT4SgRZIMzAlQs6AQoVP-_nDtUBBhFI7OmwrKePBp2LfkPUYKIucszll7pjwndHWyTHfial5G3ulwYH5oJn0027Ih50_A2V-SJffgPzfZ4prZprIcilvkvMCR0LGwwOQ04M75R3WE4U-wB7DidTpsFLZ4RG0WdtlGIEHs24Q53QHF7wMoEzGmpGkNBd5C_NGN9UeTYR2mJ-1Aqy1BH_hGJfgtg",
    },
  ];

  return (
    <div className="w-full max-w-[1200px] mx-auto select-none animate-in fade-in slide-in-from-top duration-700">
      {/* Welcome Header */}
      <section className="mb-8">
        <p className="text-[10px] font-extrabold text-primary tracking-[0.2em] uppercase mb-1">
          당신만을 위한 퍼스널 컨시어지
        </p>
        <h2 className="text-3xl font-extrabold text-on-surface leading-tight font-headline-lg select-text">
          반가워요, {session.name}님!
        </h2>
        <p className="text-body-md text-on-surface-variant mt-2 leading-relaxed">
          다음 모험을 떠날 준비가 되셨나요? 인공지능이 당신을 위한 완벽한 여정을 설계해 드립니다.
        </p>
      </section>

      {/* CTA Card Section */}
      <section className="mb-10">
        <button
          onClick={onStartNewTrip}
          className="group relative w-full h-44 rounded-2xl overflow-hidden shadow-lg shadow-primary/10 active:scale-[0.98] transition-all bg-primary text-white border-none text-center cursor-pointer"
        >
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
              <circle cx="85" cy="15" fill="white" r="28" />
              <circle cx="15" cy="85" fill="white" r="38" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
            <div className="mb-3 bg-white/20 p-4 rounded-full group-hover:scale-105 transition-transform backdrop-blur-sm">
              <span className="material-symbols-outlined text-4xl font-bold flex items-center justify-center text-white">
                rocket_launch
              </span>
            </div>
            <span className="text-xl font-bold tracking-tight">여행 시작하기</span>
            <span className="text-sm opacity-90 mt-1 font-medium">
              AI와 함께 특별한 이야기를 만들어보세요
            </span>
          </div>
        </button>
      </section>

      {/* Gwak Jin-ah's Recent Trips (최근 저장된 여행) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-on-surface font-headline-md h-8 flex items-center">
            나의 최근 여행
          </h3>
          {savedPlans.length > 0 && (
            <button
              onClick={() => {}}
              className="text-primary font-bold text-sm bg-transparent border-0 hover:underline cursor-none pointer-events-none select-none"
            >
              총 {savedPlans.length}개 보관됨
            </button>
          )}
        </div>

        {recentPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recentPlans.map((plan) => {
              // Extract the first activity for card image background
              const displayImage =
                plan.planContent?.[0]?.activities?.[0]?.imageUrl ||
                "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500&auto=format&fit=crop";

              const primaryStyle = plan.styles?.[0] || "자유 여행";

              return (
                <div
                  key={plan.id}
                  onClick={() => onViewPlan(plan)}
                  className="bg-white rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_4px_12px_rgba(0,0,0,0.03)] group cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col h-full"
                >
                  <div className="h-44 relative overflow-hidden bg-surface-variant">
                    <img
                      alt={plan.destination}
                      src={displayImage}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/95 backdrop-blur-md text-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm font-bold flex items-center justify-center">
                          explore
                        </span>
                        {primaryStyle}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-lg font-bold mb-1 truncate text-on-surface group-hover:text-primary transition-colors">
                        {plan.title}
                      </h4>
                      <p className="text-on-surface-variant text-xs mb-4 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-sm flex items-center justify-center text-outline">
                          calendar_today
                        </span>
                        {plan.startDate.replace(/-/g, ".")} - {plan.endDate.replace(/-/g, ".")} ({plan.duration})
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                      <div className="flex -space-x-1.5">
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-primary-container flex items-center justify-center text-[10px] font-bold text-primary">
                          JD
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                          +{plan.companion === "혼자" ? 0 : 2}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all select-none">
                        <span className="material-symbols-outlined text-sm font-bold flex items-center justify-center">
                          arrow_forward
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-dashed border-outline-variant/40 p-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-outline-variant flex items-center justify-center">
              travel_explore
            </span>
            <div className="space-y-1">
              <p className="font-semibold text-sm">저장된 여행 계획이 없습니다.</p>
              <p className="text-xs text-outline">위의 '여행 시작하기'를 눌러 나만의 멋진 AI 일정을 완성해 보세요!</p>
            </div>
          </div>
        )}
      </section>

      {/* AI Suggestion Destinations */}
      <section className="pb-8">
        <h3 className="text-xl font-bold text-on-surface font-headline-md mb-4 flex items-center gap-2">
          AI가 추천하는 여행지
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide flex-nowrap shrink-0 snap-x">
          {recommendedPlaces.map((place, idx) => (
            <div
              key={idx}
              onClick={onStartNewTrip}
              className="flex-shrink-0 w-36 h-48 rounded-xl relative overflow-hidden cursor-pointer group shadow-md snap-start"
            >
              <img
                alt={place.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                src={place.imgUrl}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-4 left-3 right-3 text-white flex flex-col justify-end">
                <span className="text-[9px] text-primary font-bold uppercase tracking-wider mb-0.5">
                  {place.category}
                </span>
                <span className="text-sm font-extrabold tracking-tight truncate">
                  {place.name}
                </span>
              </div>
            </div>
          ))}

          <div
            onClick={onStartNewTrip}
            className="flex-shrink-0 w-36 h-48 rounded-xl bg-primary-container/10 border border-dashed border-primary/30 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-primary-container/20 transition-colors select-none"
          >
            <PlusCircleIcon className="text-primary w-8 h-8 mb-2" />
            <span className="text-primary text-[11px] font-extrabold">더 많은 여행지</span>
          </div>
        </div>
      </section>
    </div>
  );
}
