import https from "https";
import type { PlanDay } from "../itinerary/pipeline";

// -------------------------------------------------------------
// Google Places 실사진 조회 (서버 전용 키 — 클라이언트에는 절대 노출하지 않음)
// -------------------------------------------------------------
const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY || "";

export function fetchJsonHttps(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

// 장소명 + 목적지로 Google Places를 검색해 실제 사진의 photo_reference를 찾는다.
// 키가 없거나 검색 결과가 없으면 null을 반환해 호출부가 목업 이미지로 폴백하도록 한다.
export async function fetchRealPlacePhotoRef(placeName: string, destination: string): Promise<string | null> {
  if (!googlePlacesApiKey) return null;

  try {
    const query = `${destination} ${placeName}`;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      query
    )}&inputtype=textquery&fields=photos&key=${googlePlacesApiKey}`;
    const data = await fetchJsonHttps(url);
    const photoRef = data?.candidates?.[0]?.photos?.[0]?.photo_reference;
    return photoRef || null;
  } catch (err) {
    console.error(`Google Places photo lookup failed for "${placeName}":`, err);
    return null;
  }
}

// -------------------------------------------------------------
// Image Mockup Helpers (from server.ts)
// -------------------------------------------------------------
export function getMockupImage(category: string, destination: string, index: number): string {
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
    const osakaImages = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuARu9gRc0w9ZoujuNEUK8ud98haK7tfz0cxaG8GwIkhtrMuUfv7Attw0jeV_RBbiLUHeGYvszUgaID_dD7uHZYZu1KvAG2O-qPhUGMKsb8HqcJl8EyTGdiEn-jYqtnXTv3vycc0MIePFJnhDZXaorQrZXwfnciqzZEhvVoFx9MtUiMUXXh_729a3K5vfjBwQO9F0IwbwQiicd4bYv3JVqj62bbwsSLu375X3Y-OaWrpsy1MhNCZIJq4nq62xDMqzq3RwIJEOjSD2kU"
    ];
    return osakaImages[0];
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

  // Fallbacks based on category
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

/** 사진은 부가 정보다. 실패해도 일정 자체는 내보낸다. */
export async function attachPhotos(days: PlanDay[], destination: string) {
  return Promise.all(
    days.map(async (day) => ({
      ...day,
      activities: await Promise.all(
        day.activities.map(async (act, idx) => {
          const ref = await fetchRealPlacePhotoRef(act.title, destination).catch(() => null);
          return {
            ...act,
            imageUrl: ref
              ? `/api/place-photo?ref=${encodeURIComponent(ref)}`
              : getMockupImage(act.category, destination, idx),
          };
        }),
      ),
    })),
  );
}
