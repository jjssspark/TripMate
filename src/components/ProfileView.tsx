/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { UserSession, TravelPlan } from "../types";
import {
  BellIcon,
  LogOutIcon,
  SparklesIcon,
  PersonIcon,
  SettingsIcon,
  CheckIcon,
} from "./Icons";
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  getSupabaseClient,
  mapToSupabase,
} from "../lib/supabaseClient";

interface ProfileViewProps {
  session: UserSession;
  onLogout: () => void;
  onConfigChange?: () => void;
  localPlans?: TravelPlan[];
}

export default function ProfileView({
  session,
  onLogout,
  onConfigChange,
  localPlans = [],
}: ProfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "erd" | "supabase">("profile");

  // Profile preferences
  const [receiveEmail, setReceiveEmail] = useState(true);
  const [receiveSms, setReceiveSms] = useState(false);

  // Supabase connection keys local states
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [dbMode, setDbMode] = useState<"local" | "supabase">("local");
  const [dbStatus, setDbStatus] = useState<"disconnected" | "connected" | "error">("disconnected");
  const [statusMessage, setStatusMessage] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load existing credentials on component mount
  useEffect(() => {
    const config = getSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.anonKey);
    setDbMode(config.active ? "supabase" : "local");

    if (config.active) {
      testSupabaseConnection(config.url, config.anonKey);
    }
  }, []);

  const testSupabaseConnection = async (url: string, key: string) => {
    if (!url || !key) {
      setDbStatus("disconnected");
      setStatusMessage("URL과 API Key를 모두 올바르게 채워주세요.");
      return;
    }

    try {
      setDbStatus("disconnected");
      setStatusMessage("클라우드 연결을 시도하고 있습니다...");
      
      // We will perform a simple select trial to verify the client keys
      const client = getSupabaseClient();
      if (!client) {
        throw new Error("클라이언트 초기화 실패");
      }

      // Quick table check - if travel_plans table exists, schema is ready.
      // If table doesnt exist yet, the client initializes but returns error, which is useful to tell them.
      const { data, error } = await client.from("travel_plans").select("id").limit(1);
      
      if (error) {
        // If schema is missing but auth works
        if (error.code === "P0001" || error.message.includes("does not exist")) {
          setDbStatus("connected");
          setStatusMessage("연결 성공! 단, 'travel_plans' 테이블이 아직 생성되지 않았습니다. ERD 탭의 SQL 스크립트를 데이터베이스에 실행해 주세요.");
        } else {
          throw error;
        }
      } else {
        setDbStatus("connected");
        setStatusMessage(`서버 연결 성공! 활성 데이터 ${data?.length || 0}행 확인됨.`);
      }
    } catch (err: any) {
      console.error(err);
      setDbStatus("error");
      setStatusMessage(`오류 발생: ${err.message || "자격 증명을 확인해 주세요."}`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const isActive = dbMode === "supabase";
    saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim(), isActive);
    
    await testSupabaseConnection(supabaseUrl.trim(), supabaseKey.trim());
    
    if (onConfigChange) {
      onConfigChange();
    }
    alert("데이터베이스 스토리지 타겟 매핑과 연동 설정이 안전하게 업데이트되었습니다!");
  };

  const handleCopySql = () => {
    const sql = `-- ✈️ TripMate AI - 휴먼3팀 설계 데이터베이스 스키마 ERD DDL
-- 1. 여행 일정 관리 테이블 (travel_plans)
CREATE TABLE IF NOT EXISTS travel_plans (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration VARCHAR(50) NOT NULL,
  budget VARCHAR(50),
  companion VARCHAR(50),
  styles TEXT[] DEFAULT '{}',
  must_visit_places TEXT,
  plan_content JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 설정 및 인증 우회 보안 정책 설정
ALTER TABLE travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모든 인증된 익명 사용자의 읽기 허용" 
  ON travel_plans FOR SELECT 
  USING (true);

CREATE POLICY "모든 사용자의 생성 허용" 
  ON travel_plans FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "모든 사용자의 편집 정책" 
  ON travel_plans FOR UPDATE 
  USING (true);

CREATE POLICY "모든 사용자의 삭제 정책" 
  ON travel_plans FOR DELETE 
  USING (true);`;

    navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => {
      setSqlCopied(false);
    }, 2000);
  };

  // Automated migration: Push local JSON plans to Supabase Cloud live on click
  const handleMigrate = async () => {
    if (dbStatus !== "connected") {
      alert("클라우드 데이터베이스가 연결 상태여야 백업 마이그레이션이 가능합니다.");
      return;
    }
    if (localPlans.length === 0) {
      alert("로컬 보관함에 복사할 데이터가 존재하지 않습니다.");
      return;
    }

    const yes = window.confirm(
      `현재 로컬 세션의 여행 계획 ${localPlans.length}개를 연결된 Supabase 클라우드로 안전하게 일괄 이전하시겠습니까?`
    );
    if (!yes) return;

    setIsSyncing(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");

      let successCount = 0;
      for (const plan of localPlans) {
        const payload = mapToSupabase(plan);
        const { error } = await client.from("travel_plans").upsert(payload);
        if (!error) {
          successCount++;
        } else {
          console.error("Migration error row:", error);
        }
      }

      alert(`마이그레이션 성공! 총 ${successCount}개의 여행 일정이 Supabase 클라우드 데이터베이스 테이블에 업로드되었습니다.`);
      
      if (onConfigChange) {
        onConfigChange();
      }
    } catch (err: any) {
      alert(`이전 도중 오류 발생했습니다: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto select-none animate-in fade-in slide-in-from-bottom duration-500 pb-16">
      {/* Visual Tab Header navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface font-headline-lg select-text">
            마이페이지 설정
          </h2>
          <p className="text-xs text-outline font-semibold mt-1">
            휴먼3팀 설계 • 로컬 스토리지 및 클라우드 데이터베이스 제어 인터페이스
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-surface-container-low border border-outline-variant/30 rounded-xl p-1 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("profile")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === "profile"
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            👤 내 프로필
          </button>
          <button
            onClick={() => setActiveSubTab("erd")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === "erd"
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            📊 DB ERD 모델링
          </button>
          <button
            onClick={() => setActiveSubTab("supabase")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === "supabase"
                ? "bg-white text-primary shadow-sm animate-pulse-once"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            ⚡ Supabase 클라우드
          </button>
        </div>
      </div>

      {activeSubTab === "profile" && (
        <div className="space-y-6">
          {/* Account Profile card layout exactly consistent with MyPage Mock */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm flex flex-col sm:flex-row items-center gap-6 select-text">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/5 shadow-inner shrink-0 select-none">
              <img alt="User" src={session.avatarUrl} className="w-full h-full object-cover" />
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
              <p className="text-[11px] text-primary font-bold mt-2.5 flex items-center gap-1">
                🌐 데이터 보관 매체: {dbMode === "supabase" ? "☁️ Supabase Cloud DB 실시간 동기화 중" : "📂 로컬 JSON 샌드박스 데이터베이스"}
              </p>
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
      )}

      {activeSubTab === "erd" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm">
            <h3 className="text-base font-bold text-on-surface mb-2">휴먼3팀의 관계형 데이터베이스 ERD 모델링</h3>
            <p className="text-xs text-on-surface-variant mb-6">
              서버 보관을 위해 구축된 최적화된 PostgreSQL 스키마 간의 다이어그램 정보입니다.
            </p>

            {/* Visual ERD Diagram constructed beautifully */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-center mb-8">
              {/* Users Table */}
              <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-slate-50 shadow-sm">
                <div className="bg-slate-900 px-4 py-2.5 text-white flex justify-between items-center">
                  <span className="text-xs font-bold font-mono">1. users</span>
                  <span className="bg-slate-700 text-[9px] px-2 py-0.5 rounded-full font-bold">Primary User</span>
                </div>
                <div className="p-4 space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                    <span className="font-bold text-primary">🔑 id</span>
                    <span className="text-slate-500 font-semibold">VARCHAR [PK]</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                    <span className="text-slate-800">name</span>
                    <span className="text-slate-500">VARCHAR</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                    <span className="text-slate-800">email</span>
                    <span className="text-slate-500">VARCHAR [Unique]</span>
                  </div>
                  <div className="flex justify-between items-center pb-0.5">
                    <span className="text-slate-700">avatar_url</span>
                    <span className="text-slate-500">TEXT</span>
                  </div>
                </div>
              </div>

              {/* Relationship Arrow (SVG helper) */}
              <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="bg-primary/10 border border-primary text-primary px-3 py-1 rounded-full text-[10px] font-bold shadow-md">
                  1 : N 관계 (user_id)
                </div>
              </div>

              {/* TravelPlans Table */}
              <div className="border-2 border-primary-container/40 rounded-2xl overflow-hidden bg-slate-50 shadow-sm">
                <div className="bg-primary px-4 py-2.5 text-white flex justify-between items-center">
                  <span className="text-xs font-bold font-mono">2. travel_plans (내 여행 보관함)</span>
                  <span className="bg-white/20 text-[9px] px-2 py-0.5 rounded-full font-bold">Relational Core</span>
                </div>
                <div className="p-4 space-y-2 text-xs font-mono max-h-[300px] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="font-bold text-primary">🔑 id</span>
                    <span className="text-slate-500">VARCHAR [PK]</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="font-bold text-slate-800">🔗 user_id</span>
                    <span className="text-primary font-bold">[FK -&gt; users.id]</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-800">title</span>
                    <span className="text-slate-500">VARCHAR</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-800">destination</span>
                    <span className="text-slate-500">VARCHAR</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-800">start_date</span>
                    <span className="text-slate-500">DATE</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-800">end_date</span>
                    <span className="text-slate-500">DATE</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-700">duration</span>
                    <span className="text-slate-500">VARCHAR</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-700">styles</span>
                    <span className="text-amber-600 font-bold">TEXT[]</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                    <span className="text-slate-700">plan_content</span>
                    <span className="text-red-600 font-bold">JSONB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">created_at</span>
                    <span className="text-slate-400">TIMESTAMPTZ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PostgreSQL Schema script text */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-on-surface uppercase tracking-wide">
                  PostgreSQL Table DDL Script
                </span>
                <button
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1 border-none"
                >
                  {sqlCopied ? <CheckIcon className="w-3.5 h-3.5 text-success" /> : null}
                  {sqlCopied ? "복사 완료!" : "SQL 스크립트 복사"}
                </button>
              </div>

              <pre className="bg-slate-950 text-emerald-400 text-[10px] sm:text-xs font-mono p-4 rounded-xl overflow-x-auto select-all h-48 border border-slate-800">
                {`-- ✈️ TripMate AI - 휴먼3팀 설계 데이터베이스 스키마 ERD DDL
-- 1. 여행 일정 관리 테이블 (travel_plans)
CREATE TABLE IF NOT EXISTS travel_plans (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration VARCHAR(50) NOT NULL,
  budget VARCHAR(50),
  companion VARCHAR(50),
  styles TEXT[] DEFAULT '{}',
  must_visit_places TEXT,
  plan_content JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 설정 및 인증 우회 보안 정책 설정
ALTER TABLE travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모든 인증된 익명 사용자의 읽기 허용" ON travel_plans FOR SELECT USING (true);
CREATE POLICY "모든 사용자의 생성 허용" ON travel_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "모든 사용자의 편집 정책" ON travel_plans FOR UPDATE USING (true);
CREATE POLICY "모든 사용자의 삭제 정책" ON travel_plans FOR DELETE USING (true);`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "supabase" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-6 border border-outline-variant/35 shadow-sm space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">Supabase 클라우드 전송 및 설정</h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  실제 Supabase의 PostgreSQL 클라우드 데이터베이스 인스턴스와 직접 동기화하여 안전하게 여행 기록을 보관 및 보존합니다.
                </p>
              </div>

              {/* Server Connection Status Panel Box */}
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 p-3 rounded-2xl select-text">
                <span className={`w-3.5 h-3.5 rounded-full ${
                  dbStatus === "connected" ? "bg-emerald-500 animate-ping-once" : dbStatus === "error" ? "bg-red-500" : "bg-slate-400"
                }`}></span>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    {dbStatus === "connected" ? "클라우드 🟢 연동 완료" : dbStatus === "error" ? "연동 오류 🔴" : "미연결 ⚪ (로컬 모드)"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    {dbMode === "supabase" ? "Supabase Cloud API" : "Local File Storage (JSON)"}
                  </p>
                </div>
              </div>
            </header>

            {/* Feedback notification status bar */}
            {statusMessage && (
              <div className={`p-4 rounded-xl text-xs font-semibold ${
                dbStatus === "connected" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : dbStatus === "error" ? "bg-red-50 text-red-800 border border-red-100" : "bg-blue-50 text-blue-800 border border-blue-100"
              }`}>
                {statusMessage}
              </div>
            )}

            {/* Input Config Form */}
            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <label className="font-label-md text-sm font-bold text-on-surface">
                    스토리지 작동 모드 선택
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDbMode("local")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                        dbMode === "local"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      📂 로컬 JSON 미들웨어
                    </button>
                    <button
                      type="button"
                      onClick={() => setDbMode("supabase")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                        dbMode === "supabase"
                          ? "bg-primary text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      ☁️ Supabase 실시간 연동
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-on-surface-variant font-bold">Supabase API URL</label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://your-project-ref.supabase.co"
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-on-surface focus:bg-white outline-none focus:ring-1 focus:ring-primary"
                      required={dbMode === "supabase"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-on-surface-variant font-bold">Supabase Project Anon Public API Key</label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-on-surface focus:bg-white outline-none focus:ring-1 focus:ring-primary"
                      required={dbMode === "supabase"}
                    />
                  </div>
                </div>
              </div>

              {/* Action Operations */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-3.5 px-6 font-bold text-xs rounded-xl hover:opacity-95 cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2 border-none shadow-sm"
                >
                  <SettingsIcon className="w-4 h-4" />
                  연동 설정값 저장 및 활성화
                </button>

                {dbStatus === "connected" && (
                  <button
                    type="button"
                    onClick={handleMigrate}
                    disabled={isSyncing || localPlans.length === 0}
                    className="flex-1 bg-slate-900 border-none text-white py-3.5 px-6 font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{isSyncing ? "동기화 백업 진행 중..." : "📂 로컬 데이터를 Supabase로 복사"}</span>
                  </button>
                )}
              </div>
            </form>

            {/* Instruction block for end-user */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs text-on-surface-variant leading-relaxed space-y-2">
              <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-primary" />
                Supabase 연동 완료 가이드 (작업 팁)
              </p>
              <ol className="list-decimal pl-4.5 space-y-1.5 font-medium">
                <li>무료로 <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary font-bold underline">Supabase 서비스</a>에 로그인하여 프로젝트를 시작합니다.</li>
                <li>프로젝트 생성 후, 상단의 <strong className="text-slate-800">DB ERD 모델링</strong> 탭에 정의된 SQL 구문을 그대로 복사하여 Supabase SQL Editor 창에 실행합니다.</li>
                <li>Supabase Project Settings - API 메뉴를 열어 호스트 URL과 anon public Key를 여기 연동 센터에 등록해 주시면, 이후 모든 여행 계획의 저장과 조회가 귀하의 개인 클럽 DB에 즉시 기재되고 보조와 백업이 원격 지원됩니다!</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
