/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion } from "motion/react";
import { TravelPlan, UserSession } from "../types";
import { getPlanCoverImage } from "../lib/planDisplay";
import HomeSideRails from "./HomeSideRails";
import {
  FEATURED_DESTINATIONS,
  HERO_IMAGE,
  PHOTO_CREDIT,
  getGreeting,
  getTripStats,
  getUpcomingTrip,
} from "../lib/homeContent";

interface HomeDashboardProps {
  session: UserSession;
  savedPlans: TravelPlan[];
  /** 목적지를 넘기면 일정 만들기 폼의 목적지 칸이 채워진 채로 열린다. */
  onStartNewTrip: (destination?: string) => void;
  onViewPlan: (plan: TravelPlan) => void;
  onDeletePlan: (id: string) => void;
}

export default function HomeDashboard({
  session,
  savedPlans,
  onStartNewTrip,
  onViewPlan,
}: HomeDashboardProps) {
  const reduceMotion = useReducedMotion();
  const upcoming = getUpcomingTrip(savedPlans);
  const stats = getTripStats(savedPlans);
  const recentPlans = savedPlans.slice(0, 2);

  // reduce-motion 사용자에게는 위치 이동을 없애고 페이드만 남긴다.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto select-none">
      <HomeSideRails />

      {/* ── 히어로 ─────────────────────────────────────────────── */}
      <section className="relative h-[460px] md:h-[540px] rounded-[28px] overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,40,60,0.45)]">
        <img
          src={HERO_IMAGE.url}
          alt={`${HERO_IMAGE.spot} 항공 전경`}
          width={1280}
          height={853}
          fetchPriority="high"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover ${reduceMotion ? "" : "animate-ken-burns"}`}
        />
        {/* 텍스트 가독성용 이중 그라데이션 — 왼쪽 아래로 갈수록 어둡게 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#00131c]/90 via-[#00131c]/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#00131c]/70 via-transparent to-transparent" />

        <div className="relative h-full flex flex-col justify-end p-7 md:p-12">
          <motion.p
            {...rise(0.1)}
            className="text-[11px] font-extrabold tracking-[0.28em] uppercase text-primary-fixed-dim mb-3"
          >
            {getGreeting()}, {session.name}님
          </motion.p>

          <motion.h2
            {...rise(0.2)}
            className="font-headline-lg text-white text-[34px] md:text-[52px] font-extrabold leading-[1.12] tracking-[-0.02em] max-w-[16ch] select-text"
          >
            다음 여행은
            <br />
            어디로 떠날까요?
          </motion.h2>

          <motion.p
            {...rise(0.3)}
            className="text-white/75 text-body-md mt-4 max-w-[42ch] leading-relaxed"
          >
            가고 싶은 곳과 며칠인지만 알려주세요. 나머지 일정은 AI가 짭니다.
          </motion.p>

          <motion.div {...rise(0.4)} className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onStartNewTrip()}
              className="group inline-flex items-center gap-2.5 bg-white text-primary font-bold text-[15px] pl-6 pr-5 py-4 rounded-full border-none cursor-pointer shadow-lg shadow-black/20 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              AI로 일정 만들기
              <span className="material-symbols-outlined text-lg transition-transform duration-300 group-hover:translate-x-1">
                arrow_forward
              </span>
            </button>

            {upcoming && (
              <button
                onClick={() => onViewPlan(upcoming.plan)}
                className="inline-flex items-center gap-2.5 bg-white/12 backdrop-blur-md text-white font-semibold text-[15px] px-5 py-4 rounded-full border border-white/25 cursor-pointer transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <span className="material-symbols-outlined text-lg text-primary-fixed-dim">
                  flight_takeoff
                </span>
                {upcoming.plan.destination}
                <span className="font-extrabold tracking-tight tabular-nums">
                  {upcoming.inTrip
                    ? "여행 중"
                    : upcoming.daysLeft === 0
                      ? "D-DAY"
                      : `D-${upcoming.daysLeft}`}
                </span>
              </button>
            )}
          </motion.div>
        </div>

        <p className="absolute bottom-4 right-5 text-[10px] text-white/45 tracking-wide">
          {HERO_IMAGE.spot}
        </p>
      </section>

      {/* ── 여행 기록 스트립 (보딩패스 모티프) ──────────────────── */}
      {stats.planCount > 0 && (
        <motion.section
          {...rise(0.5)}
          className="relative -mt-8 mx-4 md:mx-10 z-10 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_12px_32px_-16px_rgba(0,40,60,0.35)] px-6 py-5 flex items-stretch divide-x divide-dashed divide-outline-variant/50"
        >
          {[
            { label: "저장한 일정", value: stats.planCount, unit: "개" },
            { label: "떠날 도시", value: stats.cityCount, unit: "곳" },
            { label: "여행 일수", value: stats.nightCount, unit: "박" },
          ].map((item) => (
            <div key={item.label} className="flex-1 px-3 first:pl-0 last:pr-0 text-center">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-outline mb-1.5">
                {item.label}
              </p>
              <p className="font-headline-lg text-2xl font-extrabold text-on-surface tabular-nums leading-none">
                {item.value}
                <span className="text-sm font-bold text-on-surface-variant ml-0.5">{item.unit}</span>
              </p>
            </div>
          ))}
        </motion.section>
      )}

      {/* ── 내 최근 여행 ───────────────────────────────────────── */}
      <section className="mt-14">
        <motion.div {...reveal(0)} className="flex items-end justify-between mb-5">
          <div>
            <h3 className="font-headline-md text-xl font-extrabold text-on-surface">
              나의 최근 여행
            </h3>
            <p className="text-label-md text-on-surface-variant mt-1">
              {savedPlans.length > 0
                ? `보관 중인 일정 ${savedPlans.length}개`
                : "아직 저장한 일정이 없어요"}
            </p>
          </div>
        </motion.div>

        {recentPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recentPlans.map((plan, idx) => (
              <motion.button
                key={plan.id}
                {...reveal(idx * 0.08)}
                onClick={() => onViewPlan(plan)}
                className="group text-left bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_4px_16px_-8px_rgba(0,40,60,0.25)] cursor-pointer p-0 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,40,60,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="h-48 relative overflow-hidden bg-surface-variant">
                  <img
                    alt={plan.destination}
                    src={getPlanCoverImage(plan)}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-primary px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm">
                    {plan.styles?.[0] || "자유 여행"}
                  </span>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white/70 text-[11px] font-semibold tracking-wide mb-0.5">
                      {plan.destination}
                    </p>
                    <h4 className="text-white font-bold text-lg leading-tight truncate">
                      {plan.title}
                    </h4>
                  </div>
                </div>

                <div className="px-5 py-4 flex items-center justify-between">
                  <p className="text-on-surface-variant text-xs font-medium flex items-center gap-1.5 tabular-nums">
                    <span className="material-symbols-outlined text-sm text-outline">
                      calendar_today
                    </span>
                    {plan.startDate.replace(/-/g, ".")} – {plan.endDate.replace(/-/g, ".")}
                    <span className="text-outline">·</span>
                    {plan.duration}
                  </p>
                  <span className="w-8 h-8 shrink-0 rounded-full bg-primary-container/25 flex items-center justify-center text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
                    <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <motion.div
            {...reveal(0)}
            className="rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-lowest/60 p-10 text-center flex flex-col items-center gap-3"
          >
            <span className="material-symbols-outlined text-4xl text-outline-variant">
              travel_explore
            </span>
            <p className="font-semibold text-sm text-on-surface-variant">
              첫 여행을 만들면 여기에 쌓입니다.
            </p>
            <button
              onClick={() => onStartNewTrip()}
              className="mt-1 text-primary font-bold text-sm bg-transparent border-none cursor-pointer hover:underline"
            >
              지금 시작하기 →
            </button>
          </motion.div>
        )}
      </section>

      {/* ── 국내 여행지 무드보드 ───────────────────────────────── */}
      <section className="mt-16 pb-10">
        <motion.div {...reveal(0)} className="mb-6">
          <p className="text-[11px] font-extrabold tracking-[0.24em] uppercase text-primary mb-1.5">
            Domestic Picks
          </p>
          <h3 className="font-headline-md text-2xl font-extrabold text-on-surface tracking-[-0.01em]">
            지금 떠나기 좋은 곳
          </h3>
          <p className="text-label-md text-on-surface-variant mt-1.5">
            마음에 드는 사진을 누르면 그 목적지로 일정 만들기가 시작됩니다.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[168px] lg:auto-rows-[152px] gap-3 md:gap-4">
          {FEATURED_DESTINATIONS.map((place, idx) => (
            <motion.button
              key={place.name}
              {...reveal(Math.min(idx, 5) * 0.06)}
              onClick={() => onStartNewTrip(place.name)}
              aria-label={`${place.name}로 일정 만들기`}
              className={`${place.spanClass} group relative rounded-2xl overflow-hidden p-0 border-none cursor-pointer bg-surface-variant text-left shadow-[0_6px_20px_-12px_rgba(0,40,60,0.5)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(0,40,60,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
            >
              <img
                src={place.imageUrl}
                alt={`${place.name} ${place.spot}`}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
              />
              {/* 사진은 살리고 이름이 놓이는 아래쪽만 눌러 대비를 만든다 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 via-45% to-transparent transition-opacity duration-300 group-hover:opacity-95" />

              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="inline-block text-[9px] font-extrabold tracking-[0.2em] uppercase text-primary-fixed-dim mb-1">
                  {place.region}
                </span>
                <p className="text-white font-extrabold text-lg leading-none tracking-[-0.01em]">
                  {place.name}
                </p>
                {/* 태그라인은 평소 접혀 있다가 hover 시 펼쳐진다 (grid-rows 트랜지션) */}
                <span className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                  <span className="overflow-hidden">
                    <span className="block text-white/85 text-xs leading-snug pt-1.5">
                      {place.tagline}
                    </span>
                  </span>
                </span>
              </div>
            </motion.button>
          ))}

          <motion.button
            {...reveal(0.3)}
            onClick={() => onStartNewTrip()}
            className="col-span-1 lg:col-span-2 group relative rounded-2xl border-2 border-dashed border-primary/35 bg-primary-container/10 flex flex-col items-center justify-center gap-2 cursor-pointer p-4 transition-colors duration-200 hover:bg-primary-container/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-3xl text-primary transition-transform duration-300 group-hover:rotate-90">
              add
            </span>
            <span className="text-primary text-xs font-extrabold">직접 목적지 입력하기</span>
          </motion.button>
        </div>

        <p className="mt-5 text-[10px] leading-relaxed text-outline">
          사진 © {PHOTO_CREDIT} / Wikimedia Commons (CC BY·CC BY-SA·CC0)
        </p>
      </section>
    </div>
  );
}
