/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { UserSession } from "../types";
import {
  BellIcon,
  LogOutIcon,
  SparklesIcon,
} from "./Icons";

interface ProfileViewProps {
  session: UserSession;
  onLogout: () => void;
}

export default function ProfileView({ session, onLogout }: ProfileViewProps) {
  // Profile preferences
  const [receiveEmail, setReceiveEmail] = useState(true);
  const [receiveSms, setReceiveSms] = useState(false);

  return (
    <div className="w-full max-w-[1000px] mx-auto select-none animate-in fade-in slide-in-from-bottom duration-500 pb-16">
      {/* Visual Tab Header navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface font-headline-lg select-text">
            마이페이지 설정
          </h2>
          <p className="text-xs text-outline font-semibold mt-1">
            계정 정보와 여행 기록을 관리합니다
          </p>
        </div>

      </div>

      <div className="space-y-6">
          {/* Account Profile card layout exactly consistent with MyPage Mock */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm flex flex-col sm:flex-row items-center gap-6 select-text">
            {/* 대부분의 계정에 avatarUrl이 없다. src가 비면 깨진 이미지가 뜨므로 기본 프로필을 그린다. */}
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 bg-primary-container/20 shrink-0 select-none flex items-center justify-center">
              {session.avatarUrl ? (
                <img alt="" src={session.avatarUrl} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-4xl text-primary">person</span>
              )}
            </div>
            <div className="text-center sm:text-left flex-grow">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h3 className="text-xl font-bold text-on-surface leading-tight select-text">
                  {session.name}
                </h3>
                <span className="inline-flex self-center sm:self-auto bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full select-none">
                  Level 4 • 프로 플래너 • 휴먼3팀
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-1 select-all">{session.email}</p>
            </div>
            
            <button
              onClick={onLogout}
              className="w-full sm:w-auto px-5 py-3 border border-error/30 hover:border-error hover:bg-error/5 bg-white text-error rounded-xl font-bold font-label-md text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOutIcon className="w-4 h-4" />
              로그아웃
            </button>
          </div>

          {/* AI Preference Insights */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary select-none">
              <SparklesIcon className="w-5 h-5 animate-bounce" />
              <h3 className="font-headline-md text-base leading-6 font-bold">나의 여행 취향 분석 (AI 리포트)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 select-none">
              {[
                { title: "선호 식도락", val: "맛집 • 카페 위주", desc: "먹킷리스트 중심 동선" },
                { title: "이동 성향", val: "여유형 뚜벅코스", desc: "반경 3km 내 집중 배치" },
                { title: "예산 지출", val: "합리적 가성비 지향", desc: "무료 명소 적극 활용" }
              ].map((p, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
                    {p.title}
                  </p>
                  <p className="font-label-md text-xs font-extrabold text-on-surface">
                    {p.val}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Notification toggles */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm space-y-5">
            <div className="flex items-center gap-2 select-none">
              <BellIcon className="text-primary w-5 h-5" />
              <h3 className="font-headline-md text-base leading-6 font-bold">인앱 및 푸시 설정</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-surface-variant/40">
                <div>
                  <p className="font-label-md text-sm font-semibold text-on-surface">이메일 마케팅 소식 받기</p>
                  <p className="text-xs text-outline font-medium mt-0.5">새로운 도시 플랜 샘플 및 시즌 할인 혜택</p>
                </div>
                <input
                  type="checkbox"
                  checked={receiveEmail}
                  onChange={(e) => setReceiveEmail(e.target.checked)}
                  className="w-11 h-6 bg-slate-200 checked:bg-primary rounded-full appearance-none relative cursor-pointer outline-none transition-colors before:content-[''] before:absolute before:left-0.5 before:top-0.5 before:w-5 before:h-5 before:bg-white before:rounded-full before:transition-transform checked:before:translate-x-5 shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-label-md text-sm font-semibold text-on-surface">알림톡 스마트 서비스</p>
                  <p className="text-xs text-outline font-medium mt-0.5">여행 전날 일정 리마인드 및 구글 경로 자동 전송</p>
                </div>
                <input
                  type="checkbox"
                  checked={receiveSms}
                  onChange={(e) => setReceiveSms(e.target.checked)}
                  className="w-11 h-6 bg-slate-200 checked:bg-primary rounded-full appearance-none relative cursor-pointer outline-none transition-colors before:content-[''] before:absolute before:left-0.5 before:top-0.5 before:w-5 before:h-5 before:bg-white before:rounded-full before:transition-transform checked:before:translate-x-5 shadow-inner"
                />
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
