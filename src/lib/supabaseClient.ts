/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { TravelPlan, ItineraryDay } from "../types";

// Configuration keys in localStorage
const URL_KEY = "tripmate_supabase_url";
const KEY_KEY = "tripmate_supabase_key";
const MODE_KEY = "tripmate_db_mode"; // "local" | "supabase"

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  active: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  // .env 환경변수를 우선 로드하고 없으면 로컬 스토리지를 차선책으로 둡니다.
  const url = localStorage.getItem(URL_KEY) || (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const anonKey = localStorage.getItem(KEY_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  
  // 로컬로 명시되어 있지 않고 둘 다 정의되어 있으면 Supabase 모드를 기본 활성화합니다.
  const active = localStorage.getItem(MODE_KEY) !== "local" && !!url && !!anonKey;
  return { url, anonKey, active };
}

export function saveSupabaseConfig(url: string, anonKey: string, active: boolean) {
  if (url) localStorage.setItem(URL_KEY, url);
  else localStorage.removeItem(URL_KEY);

  if (anonKey) localStorage.setItem(KEY_KEY, anonKey);
  else localStorage.removeItem(KEY_KEY);

  localStorage.setItem(MODE_KEY, active ? "supabase" : "local");
}

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = "";
let lastKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  // Memoize client instance
  if (supabaseInstance && lastUrl === config.url && lastKey === config.anonKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(config.url, config.anonKey);
    lastUrl = config.url;
    lastKey = config.anonKey;
    return supabaseInstance;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

// Helper to choose corresponding high-quality mockup images for places (역사 이력 조회 시 활용)
function getMockupImage(category: string, destination: string, index: number): string {
  const normalizedDest = (destination || "").toLowerCase();

  if (normalizedDest.includes("도쿄") || normalizedDest.includes("tokyo")) {
    const tokyoImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAWwaT6yvcSZZqChzslpAIM-mXP8HAwO9RMpNMpU7_5xZGThTemplate_Tokyo1",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBllgP_UuFlsuNLoH173ZzuFyP9PZaJq5OUAmeY5Ooz6fWjhkQQBNXQ1DEOmqu9c3gCL38VPDPvIVC3w990VWNSZXB_LQPtJHm7fcSoLlE8HreOLiMXg530fU9EkkxE_fXyS4BEDSQiH4pCEL6YfkWlL-4Gx_fSWD3fc8goz7GSS9dgKBJ1SXUeJNt6rKisTmGzr49QFoDLUthI2WefckMbyYnwyD5sjQ_GkOsguLThMZP7Z90zFtWXj_rZyL1fzcTMqBe_Q7WHuhc"
    ];
    if (category === "맛집") return tokyoImages[2];
    return tokyoImages[index % tokyoImages.length];
  }

  if (normalizedDest.includes("오사카") || normalizedDest.includes("osaka")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU";
  }

  if (normalizedDest.includes("제주") || normalizedDest.includes("jeju")) {
    const jejuImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xrTQzdR_feEC4XMn2hnEnn-Z1h1bC1NroWiJLVusrs5l4SupKthe34TG8lYTSlSBbqSUBpUpneP1FxEWMkykSrI5EaQysA8hbtLwBPzgdBUso0H4ZL6P_faD0EXgrVtf9LBtkVGtFTJcEvEUzriUocvyYtbfC5NEEK_bTnfwB_suQmG3JSPZ1JSoBejNGdGlEqusxdJcPTO__UhttbtFFjZcivJCinb7H7oEblHHd7lKGFF4a5SjUBKgFv5axHClqFCiTIUus2I",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAUTR_9HCW54fzsiXaYN2YmCIRLEgxy4YIkOD1wBZzaO-Ts36HmEsL8eMKtMyK_-gwAfSLBKAP8nwUn4Vyi4JkHuGAFCe0A8ivZFxNLfxmPKNRwPVmYjDuKURN3AbU_iF6EQhrQaevbCbfZ08Sgz165GeGegwDJ_1EQVl1vRAexGFh8RoQCFTEfrc2x8MB6uOwUnZqkYl_lTkl8QU2C0KQf_ENYwYINIH3qV5U2P9D1mjgBeDWOgJ0aUXkDl5VRg8G4RkGIvtRyFVU",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAe1AnkbJXhO5lId58Y7sCZa65LR0MrW3CyEc967MhQiv_RshiB3M5HFxjCzvWi5-ln0cMi-xYhLzRj1ucGSYeHiu1stONtNrjn-KpVT6-KtnJhcM98N1SO9f73MbPEtk-OkeFcbpy6OxdgUovNE9wRAw7r-ItJd35h5jLX_78PnU0F3DXubr9S_2XsphFA7LmCYxyj8Nq_Tmw-bQ2F-NVkCjGvMKBUWsAIO1Tor4d8kHcWgA6TTjO3gMFU66LN4jPskSYysIfHaiI"
    ];
    if (category === "맛집") return "https://lh3.googleusercontent.com/aida-public/AB6AXuA3STExzheMVpQQhHTarK2ZOjX-mOyyV01pI1NEsJuwYCBoSt092OBTza3HTjWRB2NjsIc8ol5YPAdu2TzpDivFIksAyH85Akr8OslClMEezIAv3_arMKUDNeByCHTxhEqjqgm8C19B5KDQN0ZxdfkVHOYJdszYeZaMKh5PJrlbT6433tYxPGVNWbU2xk-VUvb9J2AxM_aWQboLDKDjwPHoUk7q-6b-LuejTV4Qxa_fJua29RBf4O1IYdb2sH11NK548qKMAzhmgho";
    return jejuImages[index % jejuImages.length];
  }

  if (normalizedDest.includes("파리") || normalizedDest.includes("paris")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuAq2FzS7k5PqYPGG9LxZA5osqN7WMk-CwGN7HxAjLjFxOW2gfBdL_HwK9Tk9R1QQJf_tJu_JI42bMPyZkHYWvgkKKYZzPOoAI205klU4BCMsRIPf5vHRqaQgc4GJ7VvoHP4JV3rOFQ81EeZRkSUC6YuCKsadwYwzDyqmmAZSB3GWTRHWTLCrg7JKNs_V5whppspWGnvg9mMZDGxc76Wg-EHCIIZIy11P1R_KVMWUYPW8CYyImDMjRBA7vWC-CrqN28LdFqdSvoPH4o";
  }

  if (normalizedDest.includes("시드니") || normalizedDest.includes("sydney")) {
    return "https://lh3.googleusercontent.com/aida-public/AB6AXuBNj026qW-ZpTYzKavkSWxoW6ztR42Cm0-_DYA0Vrty1MhmDNAhOYT4SgRZIMzAlQs6AQoVP-_nDtUBBhFI7OmwrKePBp2LfkPUYKIucszll7pjwndHWyTHfial5G3ulwYH5oJn0027Ih50_A2V-SJffgPzfZ4prZprIcilvkvMCR0LGwwOQ04M75R3WE4U-wB7DidTpsFLZ4RG0WdtlGIEHs24Q53QHF7wMoEzGmpGkNBd5C_NGN9UeTYR2mJ-1Aqy1BH_hGJfgtg";
  }

  if (category === "맛집" || category.includes("맛집")) {
    return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop";
  } else if (category === "카페" || category.includes("카페")) {
    return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop";
  } else if (category === "쇼핑" || category.includes("쇼핑")) {
    return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop";
  } else if (category === "숙소" || category.includes("숙소") || category.includes("호텔") || category.includes("펜션")) {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop";
  } else if (category === "관광" || category === "명소" || category.includes("관광") || category.includes("명소") || category.includes("랜드마크") || category.includes("유적")) {
    return "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&auto=format&fit=crop";
  } else if (category === "자연" || category.includes("자연") || category.includes("산") || category.includes("바다") || category.includes("공원") || category.includes("계곡")) {
    return "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500&auto=format&fit=crop";
  } else if (category === "액티비티" || category === "체험" || category.includes("액티비티") || category.includes("체험") || category.includes("테마파크") || category.includes("레저")) {
    return "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=500&auto=format&fit=crop";
  } else if (category === "힐링" || category === "문화" || category.includes("힐링") || category.includes("문화") || category.includes("미술관") || category.includes("박물관") || category.includes("전시")) {
    return "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&auto=format&fit=crop";
  }

  return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500&auto=format&fit=crop";
}

// Map database column names (snake_case) to client properties (camelCase)
export function mapFromSupabase(row: any): TravelPlan {
  // 조인되어 들어온 travel_items 데이터를 일차별(day) ItineraryDay 구조로 복원
  const rawItems = Array.isArray(row.travel_items) ? row.travel_items : [];
  
  // day_number 별로 그룹화
  const daysMap: { [key: number]: ItineraryDay } = {};
  
  rawItems.forEach((item: any) => {
    const dNum = item.day_number;
    if (!daysMap[dNum]) {
      daysMap[dNum] = {
        day: dNum,
        theme: `${row.destination} 여행 - ${dNum}일차`,
        description: `${row.destination}의 하이라이트 동선입니다.`,
        activities: []
      };
    }
    
    // time 포맷 변환 (예: "09:30:00" -> "오전 09:30")
    let displayTime = item.visit_time || "오전 09:00";
    if (displayTime.includes(":")) {
      const parts = displayTime.split(":");
      const hour = parseInt(parts[0], 10);
      const min = parts[1];
      if (hour < 12) {
        displayTime = `오전 ${hour.toString().padStart(2, "0")}:${min}`;
      } else {
        const pmHour = hour === 12 ? 12 : hour - 12;
        displayTime = `오후 ${pmHour.toString().padStart(2, "0")}:${min}`;
      }
    }

    const idx = daysMap[dNum].activities.length;
    const cat = item.category || "관광";

    daysMap[dNum].activities.push({
      id: item.id.toString(),
      time: displayTime,
      title: item.place_name,
      // description 칼럼이 text[] (배열) 타입이므로, 화면 표시용 설명은 기본 문구로 가독성 있게 구성
      description: `${item.place_name}에서 특별하고 행복한 시간을 만끽해 보세요!`,
      location: item.place_name,
      category: cat,
      imageUrl: getMockupImage(cat, row.destination, idx), // 역사 이력 로딩 시 장소 이미지 복원 매핑
      mustVisit: false,
      // DB의 description 칼럼에 저장되어 있던 text[] 태그 배열을 tags로 완벽 복원
      tags: Array.isArray(item.description) ? item.description : (item.category ? [item.category] : [])
    });
  });

  // sequence 기준 정렬 복원
  const planContent = Object.values(daysMap).map((dayObj) => {
    dayObj.activities.sort((a, b) => {
      return parseInt(a.id || "0", 10) - parseInt(b.id || "0", 10);
    });
    return dayObj;
  });

  planContent.sort((a, b) => a.day - b.day);

  const stylesArr = Array.isArray(row.styles) ? row.styles : [];
  const mustVisitStr = Array.isArray(row.must_visit_places) ? row.must_visit_places.join(", ") : (row.must_visit_places || "");

  // 날짜 계산을 통한 박/일 구성
  let durationText = "2박 3일";
  if (row.start_date && row.end_date) {
    const sDate = new Date(row.start_date);
    const eDate = new Date(row.end_date);
    const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    durationText = `${diffDays - 1}박 ${diffDays}일`;
  }

  return {
    id: row.id,
    userId: row.users?.user_id || row.user_id || "unknown",
    userSeq: row.user_seq,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    duration: durationText,
    budget: row.budget || "표준형",
    companion: row.companion || "혼자",
    styles: stylesArr,
    mustVisitPlaces: mustVisitStr,
    planContent: planContent,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export function mapToSupabase(plan: TravelPlan): any {
  const mustVisitArr = plan.mustVisitPlaces ? plan.mustVisitPlaces.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  return {
    id: plan.id,
    user_seq: plan.userSeq,
    title: plan.title,
    destination: plan.destination,
    start_date: plan.startDate,
    end_date: plan.endDate,
    budget: plan.budget,
    companion: plan.companion,
    styles: plan.styles,
    must_visit_places: mustVisitArr,
    is_shared: false,
    additional_requests: plan.planContent?.[0]?.description || "", // 대략적 개요 바인딩
  };
}

export function mapToSupabaseItem(act: any, planId: string, dayNumber: number, sequence: number): any {
  // "오전 09:30" -> "09:30:00" 변환
  let rawTime = "09:00:00";
  if (act.time) {
    const cleaned = act.time.replace("오전", "").replace("오후", "").trim();
    const parts = cleaned.split(":");
    if (parts.length >= 2) {
      let hr = parseInt(parts[0], 10);
      const min = parts[1];
      if (act.time.includes("오후") && hr < 12) {
        hr += 12;
      } else if (act.time.includes("오전") && hr === 12) {
        hr = 0;
      }
      rawTime = `${hr.toString().padStart(2, "0")}:${min}:00`;
    }
  }

  return {
    plan_id: planId,
    day_number: dayNumber,
    visit_time: rawTime,
    place_name: act.title,
    // description 칼럼(text[] 타입)에 AI가 도출한 태그(tags) 배열을 직접 주입합니다.
    description: Array.isArray(act.tags) ? act.tags : (act.category ? [act.category] : []),
    category: act.category,
    sequence: sequence,
  };
}

