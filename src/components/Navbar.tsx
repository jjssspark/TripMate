/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSession } from "../types";
import { PersonIcon, BellIcon, ArrowLeftIcon } from "./Icons";
import BrandLogo from "./BrandLogo";

interface NavbarProps {
  session: UserSession | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  canGoBack?: boolean;
  onBack?: () => void;
}

export default function Navbar({ session, activeTab, setActiveTab, canGoBack, onBack }: NavbarProps) {
  return (
    <header className="bg-white/75 backdrop-blur-xl flex justify-between items-center px-6 w-full h-16 fixed top-0 z-40 border-b border-white/60 shadow-[0_1px_20px_-12px_rgba(0,60,90,0.5)] select-none">
      <div className="flex items-center gap-3">
        {/* 앱 전용 뒤로가기 버튼: planner/plan_result처럼 하위 플로우에 있을 때만 노출 */}
        {canGoBack && onBack && (
          <button
            onClick={onBack}
            aria-label="뒤로가기"
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary bg-transparent border-0 cursor-pointer active:scale-90 transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setActiveTab("home")}
          aria-label="TripMate AI 홈"
          className="group flex items-center bg-transparent border-none p-0 cursor-pointer select-none active:scale-95 transition-transform"
        >
          <BrandLogo size="md" className="[&>span:first-child]:transition-transform [&>span:first-child]:duration-500 group-hover:[&>span:first-child]:-rotate-12" />
        </button>
      </div>

      {session ? (
        <div className="flex items-center gap-4">
          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex gap-6 items-center mr-4">
            <button
              onClick={() => setActiveTab("home")}
              className={`font-label-md text-sm cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 font-bold ${
                activeTab === "home" ? "text-primary" : "text-on-surface-variant font-medium"
              }`}
            >
              홈
            </button>
            <button
              onClick={() => setActiveTab("my_trips")}
              className={`font-label-md text-sm cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 font-bold ${
                activeTab === "my_trips" ? "text-primary" : "text-on-surface-variant font-medium"
              }`}
            >
              내 여행
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`font-label-md text-sm cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 font-bold ${
                activeTab === "search" ? "text-primary" : "text-on-surface-variant font-medium"
              }`}
            >
              검색
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`font-label-md text-sm cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 font-bold ${
                activeTab === "profile" ? "text-primary" : "text-on-surface-variant font-medium"
              }`}
            >
              프로필
            </button>
          </nav>

          <button className="text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0 p-1 flex items-center justify-center cursor-pointer">
            <BellIcon className="w-6 h-6" />
          </button>
          
          <div 
            onClick={() => setActiveTab("profile")}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/20 cursor-pointer active:scale-95 transition-all"
          >
            {session.avatarUrl ? (
              <img alt="User" src={session.avatarUrl} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary-container flex items-center justify-center text-on-primary-container">
                <PersonIcon className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
