/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSession } from "../types";
import { ExploreIcon, PersonIcon, BellIcon } from "./Icons";

interface NavbarProps {
  session: UserSession | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Navbar({ session, activeTab, setActiveTab }: NavbarProps) {
  return (
    <header className="bg-white/90 backdrop-blur-md flex justify-between items-center px-6 w-full h-16 fixed top-0 z-40 border-b border-surface-variant select-none">
      <div 
        onClick={() => setActiveTab("home")} 
        className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-all"
      >
        <ExploreIcon className="text-primary w-8 h-8 fill-primary/10" />
        <h1 className="text-xl font-extrabold text-black tracking-tight font-headline-lg">
          TripMate AI
        </h1>
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
