/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserSession, TravelPlan } from "./types";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import LoginSignup from "./components/LoginSignup";
import HomeDashboard from "./components/HomeDashboard";
import PlannerFlow from "./components/PlannerFlow";
import PlanResultView from "./components/PlanResultView";
import MyTripsView from "./components/MyTripsView";
import ProfileView from "./components/ProfileView";
import Toast from "./components/Toast";
import { SearchIcon, LocationIcon, BookmarkIcon } from "./components/Icons";
import {
  getSupabaseConfig,
  getSupabaseClient,
  buildUserSession,
  mapFromSupabase,
  mapToSupabase,
  mapToSupabaseItem,
} from "./lib/supabaseClient";

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  // 탭 히스토리 스택: 하단 메인 탭(home/my_trips/search/profile)은 형제 탭 전환이라 스택을 초기화하고,
  // planner/plan_result 같은 하위 플로우 화면은 스택에 쌓아서 뒤로가기로 이전 화면에 돌아갈 수 있게 함
  const [navStack, setNavStack] = useState<string[]>(["home"]);
  const activeTab = navStack[navStack.length - 1];
  const goToTab = (tab: string) => setNavStack([tab]);
  const pushScreen = (tab: string) => setNavStack((prev) => [...prev, tab]);
  const goBack = () => setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const [activePlan, setActivePlan] = useState<TravelPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // Retrieve user session and fetch plans on load (Mock 모드 폴백)
  useEffect(() => {
    const stored = localStorage.getItem("tripmate_session");
    if (stored) {
      try {
        const u: UserSession = JSON.parse(stored);
        setSession(u);
      } catch (err) {
        console.error("Error parsing stored session:", err);
      }
    }
  }, []);

  // Supabase Auth 세션 구독: 새로고침 시 세션 복구, 토큰 자동 갱신,
  // 그리고 소셜 로그인(OAuth) 리다이렉트 이후 세션을 실제로 반영하기 위한 리스너
  useEffect(() => {
    const config = getSupabaseConfig();
    if (!config.active) return;

    const client = getSupabaseClient();
    if (!client) return;

    // 콜백을 async로 두면 Supabase의 내부 인증 락(lock)이 걸려 signOut() 등
    // 이후의 auth 호출이 영원히 대기(deadlock)하는 문제가 있음 — 공식 가이드대로
    // 콜백은 동기로 두고, 실제 비동기 작업은 setTimeout으로 다음 틱에 미룸
    const { data: listener } = client.auth.onAuthStateChange((event, authSession) => {
      setTimeout(() => {
        if (authSession?.user) {
          buildUserSession(client, authSession.user).then((userSession) => {
            localStorage.setItem("tripmate_session", JSON.stringify(userSession));
            setSession(userSession);
          });
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem("tripmate_session");
          setSession(null);
        }
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const queryClient = useQueryClient();

  // 내 여행 목록 조회: Supabase Cloud 우선 조회, 실패 시 로컬 브라우저 저장소로 폴백.
  // React Query가 세션별로 결과를 캐싱하므로, 탭을 오가도 재요청 없이 이전 데이터를 즉시 보여준다
  // (staleTime 1분 동안은 재요청 생략 — main.tsx의 QueryClient 기본값).
  const fetchTravelPlans = async (): Promise<TravelPlan[]> => {
    if (!session) return [];

    const config = getSupabaseConfig();
    if (config.active) {
      try {
        const client = getSupabaseClient();
        if (client) {
          // travel_plans와 하위 travel_items를 조인 쿼리해 옵니다 (user_seq 기준)
          const { data, error } = await client
            .from("travel_plans")
            .select("*, travel_items(*)")
            .eq("user_seq", session.userSeq || 1)
            .order("created_at", { ascending: false });

          if (error) throw error;
          if (data) {
            console.log("Plans sync-loaded from Supabase Cloud with relational items.");
            return data.map(mapFromSupabase);
          }
        }
      } catch (err) {
        console.error("Failed to load plans from Supabase. Falling back to Local DB:", err);
      }
    }

    // Fallback to local browser localStorage storage
    try {
      const storedPlans = localStorage.getItem("tripmate_local_plans");
      const allPlans = storedPlans ? JSON.parse(storedPlans) : [];
      return allPlans.filter((p: any) => p.userId === session.id);
    } catch (err) {
      console.error("Error reading saved plans from localStorage:", err);
      return [];
    }
  };

  const { data: savedPlans = [] } = useQuery({
    queryKey: ["travel-plans", session?.id],
    queryFn: fetchTravelPlans,
    enabled: !!session,
  });

  const handleLoginSuccess = (user: UserSession) => {
    setSession(user);
    goToTab("home");
  };

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.error("Supabase signOut failed. Clearing local session anyway:", err);
      }
    }
    localStorage.removeItem("tripmate_session");
    setSession(null);
    goToTab("home");
    setActivePlan(null);
  };

  // 1. Create Travel Plan (생성 결과만 화면에 표시 — 저장은 사용자가 "이 일정 저장하기" 버튼을 눌러야 실행됨)
  const handlePlanGenerated = (plan: TravelPlan) => {
    if (session) {
      plan.userId = session.id;
      plan.userSeq = session.userSeq || 1;
    } else {
      plan.userId = "user-123";
    }

    setActivePlan(plan);
    pushScreen("plan_result");
  };

  // 2. Save Plan to Database ("이 일정 저장하기" 버튼 클릭 시에만 호출됨)
  const handleSaveToMyPage = async (plan: TravelPlan) => {
    if (!session) return;

    const completePlan = {
      ...plan,
      userId: session.id,
      userSeq: session.userSeq || 1,
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let supabaseSaveFailed = false;

    const config = getSupabaseConfig();
    if (config.active) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload = mapToSupabase(completePlan);

          // 1단계: travel_plans 마스터 삽입 및 자동 생성된 id 획득
          const { data: insertedPlan, error: planErr } = await client
            .from("travel_plans")
            .insert(payload)
            .select()
            .single();

          if (planErr) throw planErr;

          // 2단계: 일차별 활동 목록을 travel_items 컬럼 규격에 맞춰 다중 삽입(Bulk Insert)
          const itemsPayload: any[] = [];
          completePlan.planContent.forEach((dayObj) => {
            if (Array.isArray(dayObj.activities)) {
              dayObj.activities.forEach((act, idx) => {
                itemsPayload.push(mapToSupabaseItem(act, insertedPlan.id, dayObj.day, idx));
              });
            }
          });

          if (itemsPayload.length > 0) {
            const { error: itemsErr } = await client
              .from("travel_items")
              .insert(itemsPayload);

            if (itemsErr) {
              // 아이템 삽입 실패 시 데이터 정합성을 위해 마스터 레코드 롤백 삭제
              await client.from("travel_plans").delete().eq("id", insertedPlan.id);
              throw itemsErr;
            }
          }

          const finalPlanData = {
            ...completePlan,
            id: insertedPlan.id
          };

          queryClient.setQueryData<TravelPlan[]>(["travel-plans", session.id], (old = []) => [
            finalPlanData,
            ...old,
          ]);
          setActivePlan(finalPlanData);
          showToast("일정이 보관함에 저장되었습니다!", "success");
          goToTab("my_trips");
          return;
        }
      } catch (err: any) {
        console.error("Failed to save to Supabase. Attempting local fallback.", err);
        supabaseSaveFailed = true;
      }
    }

    try {
      const storedPlans = localStorage.getItem("tripmate_local_plans");
      const allPlans = storedPlans ? JSON.parse(storedPlans) : [];

      // Ensure unique ID if not generated
      if (!completePlan.id) {
        completePlan.id = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add to array
      allPlans.push(completePlan);
      localStorage.setItem("tripmate_local_plans", JSON.stringify(allPlans));

      queryClient.setQueryData<TravelPlan[]>(["travel-plans", session.id], (old = []) => [
        completePlan,
        ...old,
      ]);
      setActivePlan(completePlan);

      // Supabase 저장이 실패해 로컬로만 대체 저장된 경우, 클라우드 미동기화 사실을 사용자에게 고지
      if (supabaseSaveFailed) {
        showToast("클라우드 저장에 실패해 이 기기에만 임시 저장되었습니다.", "error");
      } else {
        showToast("일정이 보관함에 저장되었습니다!", "success");
      }
      goToTab("my_trips");
    } catch (err) {
      console.error("Error saving plan to localStorage:", err);
      showToast("일정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    }
  };

  // 3. Update existing Plan (수동 일정 편집)
  const handleUpdatePlan = async (plan: TravelPlan) => {
    const updatedPlan = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };

    const config = getSupabaseConfig();
    if (config.active) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload = mapToSupabase(updatedPlan);
          
          // 1단계: travel_plans 마스터 정보 갱신
          const { error: masterErr } = await client
            .from("travel_plans")
            .update(payload)
            .eq("id", plan.id);

          if (masterErr) throw masterErr;

          // 2단계: 기존 travel_items 삭제 후 갱신된 내역으로 다시 인서트 (Delete & Insert 전략)
          const { error: delErr } = await client
            .from("travel_items")
            .delete()
            .eq("plan_id", plan.id);
            
          if (delErr) throw delErr;

          const itemsPayload: any[] = [];
          updatedPlan.planContent.forEach((dayObj) => {
            if (Array.isArray(dayObj.activities)) {
              dayObj.activities.forEach((act, idx) => {
                itemsPayload.push(mapToSupabaseItem(act, plan.id, dayObj.day, idx));
              });
            }
          });

          if (itemsPayload.length > 0) {
            const { error: insErr } = await client
              .from("travel_items")
              .insert(itemsPayload);
              
            if (insErr) throw insErr;
          }

          queryClient.setQueryData<TravelPlan[]>(["travel-plans", session?.id], (old = []) =>
            old.map((p) => (p.id === plan.id ? updatedPlan : p))
          );
          console.log("Updated plan in Supabase relational tables successfully.");
          return;
        }
      } catch (err) {
        console.error("Failed to update in Supabase. Falling back to local.", err);
      }
    }

    try {
      const storedPlans = localStorage.getItem("tripmate_local_plans");
      const allPlans = storedPlans ? JSON.parse(storedPlans) : [];
      
      const index = allPlans.findIndex((p: any) => p.id === updatedPlan.id);
      if (index !== -1) {
        allPlans[index] = updatedPlan;
      } else {
        allPlans.push(updatedPlan);
      }
      
      localStorage.setItem("tripmate_local_plans", JSON.stringify(allPlans));
      queryClient.setQueryData<TravelPlan[]>(["travel-plans", session?.id], (old = []) =>
        old.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
      );
    } catch (err) {
      console.error("Error updating plan in localStorage:", err);
      throw err;
    }
  };

  // 4. Delete Travel Plan from Database (Gwak Jin-ah's direct deletion requirement)
  const handleDeletePlan = async (id: string) => {
    const config = getSupabaseConfig();
    if (config.active) {
      try {
        const client = getSupabaseClient();
        if (client) {
          // 외래키 무결성을 보장하기 위해 하위 travel_items 코스를 선행 삭제합니다.
          const { error: itemsDelErr } = await client
            .from("travel_items")
            .delete()
            .eq("plan_id", id);

          if (itemsDelErr) throw itemsDelErr;

          // 마스터 travel_plans 삭제 실행
          const { error: planDelErr } = await client
            .from("travel_plans")
            .delete()
            .eq("id", id);

          if (planDelErr) throw planDelErr;

          queryClient.setQueryData<TravelPlan[]>(["travel-plans", session?.id], (old = []) =>
            old.filter((p) => p.id !== id)
          );
          if (activePlan?.id === id) {
            setActivePlan(null);
            goToTab("my_trips");
          }
          console.log("Deleted plan in Supabase relational tables successfully.");
          return;
        }
      } catch (err: any) {
        console.error("Failed to delete in Supabase. Falling back to local.", err);
        alert(`Supabase 삭제 문제 (${err.message || err}). 로컬 백업에서 직접 지우기를 진행합니다.`);
      }
    }

    try {
      const storedPlans = localStorage.getItem("tripmate_local_plans");
      const allPlans = storedPlans ? JSON.parse(storedPlans) : [];
      
      const filtered = allPlans.filter((p: any) => p.id !== id);
      localStorage.setItem("tripmate_local_plans", JSON.stringify(filtered));

      queryClient.setQueryData<TravelPlan[]>(["travel-plans", session?.id], (old = []) =>
        old.filter((p) => p.id !== id)
      );
      if (activePlan?.id === id) {
        setActivePlan(null);
        goToTab("my_trips");
      }
    } catch (err) {
      console.error("Error deleting plan from localStorage:", err);
      alert("일정을 삭제하는 중 문제가 발생했습니다.");
    }
  };

  const handleViewPlanDetails = (plan: TravelPlan) => {
    setActivePlan(plan);
    pushScreen("plan_result");
  };

  // Helper template locations for direct search inputs
  const exploreDestinations = [
    { name: "파리, 프랑스", style: "로맨틱 도시 투어" },
    { name: "도쿄, 일본", style: "서브컬처와 맛집 투어" },
    { name: "제주도, 대한민국", style: "감성 힐링 오션 뷰" },
    { name: "시드니, 호주", style: "체험형 휴양 스포츠" }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Visual Navigation Header bar */}
      <Navbar
        session={session}
        activeTab={activeTab}
        setActiveTab={goToTab}
        onLogout={handleLogout}
        canGoBack={navStack.length > 1}
        onBack={goBack}
      />

      {/* Main Body Containers, accounting for fixed Glass App Header */}
      <main className="flex-grow pt-20 px-6 pb-24 md:pb-12">
        {session ? (
          <div className="w-full">
            {/* 1. HOME TAB */}
            {activeTab === "home" && (
              <HomeDashboard
                session={session}
                savedPlans={savedPlans}
                onStartNewTrip={() => pushScreen("planner")}
                onViewPlan={handleViewPlanDetails}
                onDeletePlan={handleDeletePlan}
              />
            )}

            {/* 2. PLANNER FLOW TAB */}
            {activeTab === "planner" && (
              <PlannerFlow onPlanGenerated={handlePlanGenerated} />
            )}

            {/* 3. GENERATION PLAN RESULT DETAILS TAB */}
            {activeTab === "plan_result" && activePlan && (
              <PlanResultView
                plan={activePlan}
                isSavedMode={savedPlans.some((p) => p.id === activePlan.id)}
                onSaveToMyPage={handleSaveToMyPage}
                onUpdatePlan={handleUpdatePlan}
                onBack={goBack}
                onShowToast={showToast}
              />
            )}

            {/* 4. MY PAGE (MY TRIPS COLLECTION - Gwak Jin-ah's direct UI responsibility) */}
            {activeTab === "my_trips" && (
              <MyTripsView
                session={session}
                plans={savedPlans}
                onViewPlan={handleViewPlanDetails}
                onDeletePlan={handleDeletePlan}
              />
            )}

            {/* 5. SEARCH ENGINE TAB */}
            {activeTab === "search" && (
              <div className="w-full max-w-[800px] mx-auto select-none animate-in fade-in slide-in-from-bottom duration-500">
                <h2 className="text-2xl font-extrabold text-on-surface mb-6 font-headline-lg select-text">
                  취향 맞춤 여행 검색
                </h2>

                <div className="relative mb-8 flex items-center bg-white rounded-2xl border border-outline-variant/50 shadow-sm focus-within:ring-2 focus-within:ring-primary/25 transition-all">
                  <span className="absolute left-4 text-outline flex items-center justify-center font-bold">
                    <SearchIcon className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-4.5 pl-12 pr-4 bg-transparent border-none rounded-2xl focus:ring-0 text-on-surface outline-none text-sm font-semibold"
                    placeholder="저장된 보관함 도시나 원하는 키워드를 입력해 보세요... (예: 오사카)"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 text-outline hover:text-on-surface text-xs font-semibold bg-transparent border-none cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Filter and matching list cards rendering */}
                {searchQuery ? (
                  <div className="space-y-4">
                    <p className="text-xs text-on-surface-variant font-bold px-1 select-text">
                      '{searchQuery}'에 매칭되는 나만의 일정 결과
                    </p>
                    {savedPlans.filter(
                      (p) =>
                        p.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.title.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedPlans
                          .filter(
                            (p) =>
                              p.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              p.title.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleViewPlanDetails(p)}
                              className="bg-white p-4 rounded-xl border border-outline-variant/40 hover:border-primary cursor-pointer shadow-sm transition-all flex justify-between items-center"
                            >
                              <div>
                                <h4 className="font-bold text-sm text-on-surface tracking-tight">
                                  {p.title}
                                </h4>
                                <p className="text-[11px] text-outline mt-1 font-semibold flex items-center gap-1">
                                  <LocationIcon className="w-3.5 h-3.5" />
                                  {p.destination} • {p.duration}
                                </p>
                              </div>
                              <span className="material-symbols-outlined text-primary font-bold">
                                arrow_forward
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="bg-white text-center rounded-2xl border border-outline-variant/35 py-12 px-6">
                        <span className="material-symbols-outlined text-4xl text-outline mb-2">
                          search_off
                        </span>
                        <p className="text-xs text-outline font-semibold">매칭되는 저장 일정이 없습니다. 다른 검색어를 조합해 보세요.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                      추천 테마 카탈로그
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 select-none">
                      {exploreDestinations.map((ex, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchQuery(ex.name.split(",")[0]);
                          }}
                          className="bg-white p-5 rounded-2xl border border-outline-variant/35 shadow-sm hover:border-primary transition-all cursor-pointer flex gap-4 items-center group"
                        >
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all font-bold">
                            <span className="material-symbols-outlined font-extrabold text-lg flex items-center justify-center">
                              location_on
                            </span>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-on-surface">
                              {ex.name}
                            </h4>
                            <p className="text-[11px] text-outline mt-0.5 font-bold">
                              {ex.style}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. PROFILE TABS AND ALARM RULES */}
            {activeTab === "profile" && (
              <ProfileView
                session={session}
                onLogout={handleLogout}
                onConfigChange={() =>
                  queryClient.invalidateQueries({ queryKey: ["travel-plans", session?.id] })
                }
                localPlans={savedPlans}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-8">
            <LoginSignup onLoginSuccess={handleLoginSuccess} />
          </div>
        )}
      </main>

      {/* Floating Bottom tab nav wrapper for mobile layout sizes */}
      {session && <BottomNav activeTab={activeTab} setActiveTab={goToTab} />}

      {/* Global Toast (저장 성공/실패 알림) */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
