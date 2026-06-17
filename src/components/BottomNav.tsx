/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExploreIcon, PersonIcon, SearchIcon, RocketIcon } from "./Icons";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 flex justify-around items-center px-2 py-3 bg-white/95 backdrop-blur-lg border-t border-surface-variant shadow-[0_-8px_30px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)] md:hidden select-none">
      {/* Home */}
      <button
        onClick={() => setActiveTab("home")}
        className={`flex flex-col items-center justify-center px-4 py-1 bg-transparent border-0 cursor-pointer active:scale-95 transition-all ${
          activeTab === "home" || activeTab === "planner"
            ? "text-primary scale-100 font-bold"
            : "text-on-surface-variant hover:text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-2xl font-bold flex items-center justify-center">
          home
        </span>
        <span className="text-[10px] tracking-tight font-semibold mt-0.5">홈</span>
      </button>

      {/* My Trips */}
      <button
        onClick={() => setActiveTab("my_trips")}
        className={`flex flex-col items-center justify-center px-4 py-1 bg-transparent border-0 cursor-pointer active:scale-95 transition-all ${
          activeTab === "my_trips"
            ? "text-primary scale-100 font-bold"
            : "text-on-surface-variant hover:text-primary"
        }`}
      >
        <TrendingIcon />
        <span className="text-[10px] tracking-tight font-semibold mt-0.5">내 여행</span>
      </button>

      {/* Search */}
      <button
        onClick={() => setActiveTab("search")}
        className={`flex flex-col items-center justify-center px-4 py-1 bg-transparent border-0 cursor-pointer active:scale-95 transition-all ${
          activeTab === "search"
            ? "text-primary scale-100 font-bold"
            : "text-on-surface-variant hover:text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-2xl flex items-center justify-center">
          search
        </span>
        <span className="text-[10px] tracking-tight font-semibold mt-0.5">검색</span>
      </button>

      {/* Profile */}
      <button
        onClick={() => setActiveTab("profile")}
        className={`flex flex-col items-center justify-center px-4 py-1 bg-transparent border-0 cursor-pointer active:scale-95 transition-all ${
          activeTab === "profile"
            ? "text-primary scale-100 font-bold"
            : "text-on-surface-variant hover:text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-2xl flex items-center justify-center">
          person
        </span>
        <span className="text-[10px] tracking-tight font-semibold mt-0.5">프로필</span>
      </button>
    </nav>
  );
}

// Inline temporary small icon representing custom design for My Trips tab in bottomnav
function TrendingIcon() {
  return (
    <span className="material-symbols-outlined text-2xl flex items-center justify-center">
      travel_explore
    </span>
  );
}
