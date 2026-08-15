import type { PlaceCategory, ResolvedPlace } from "../itinerary/types";
import type { KakaoCategoryCode, PlaceResolver } from "./resolver";

const BASE = "https://dapi.kakao.com/v2/local/search";

// 카카오는 없는 것을 없다고 하지 않는다. "제주도 소문난 맛집"을 검색하면
// 실제로 "소문난맛집"이라는 상호의 가게를 찾아준다. 조회 전에 막는다.
const GENERIC_TOKENS = [
  "맛집", "카페", "명소", "스팟", "추천", "로컬", "현지", "유명한", "인기",
  "전망 좋은", "분위기 좋은",
];

export function isGenericName(name: string): boolean {
  return GENERIC_TOKENS.some((token) => name.includes(token));
}

const normalize = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

export function matchesRequest(requested: string, returned: string): boolean {
  const a = normalize(requested);
  const b = normalize(returned);
  return a.includes(b) || b.includes(a);
}

const CODE_MAP: Record<string, PlaceCategory> = {
  FD6: "맛집", CE7: "카페", AT4: "관광", CT1: "문화", MT1: "쇼핑",
};
const NATURE_TOKENS = ["자연", "산", "해수욕장", "폭포", "오름", "공원"];

export function mapCategory(code: string, categoryName: string): PlaceCategory {
  if (NATURE_TOKENS.some((t) => categoryName.includes(t))) return "자연";
  return CODE_MAP[code] ?? "관광";
}

type KakaoDoc = {
  id: string; place_name: string; category_group_code: string; category_name: string;
  x: string; y: string; road_address_name: string; address_name: string; place_url: string;
};

function toPlace(doc: KakaoDoc): ResolvedPlace {
  return {
    id: doc.id,
    name: doc.place_name,
    lat: Number(doc.y),
    lng: Number(doc.x),
    category: mapCategory(doc.category_group_code, doc.category_name),
    address: doc.road_address_name || doc.address_name,
    placeUrl: doc.place_url,
    mustVisit: false,
  };
}

export function createKakaoResolver(apiKey: string, fetchImpl: typeof fetch = fetch): PlaceResolver {
  if (!apiKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  const headers = { Authorization: `KakaoAK ${apiKey}` };

  const call = async (url: string): Promise<KakaoDoc[]> => {
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`카카오 로컬 API 실패: ${res.status}`);
    const body = (await res.json()) as { documents?: KakaoDoc[] };
    return body.documents ?? [];
  };

  return {
    async resolve(name, destination) {
      if (isGenericName(name)) return null;
      const query = encodeURIComponent(`${destination} ${name}`);
      const docs = await call(`${BASE}/keyword.json?query=${query}&size=5`);
      const hit = docs.find((d) => matchesRequest(name, d.place_name));
      return hit ? toPlace(hit) : null;
    },

    async searchNearby(lat, lng, categoryCode: KakaoCategoryCode, radiusMeters) {
      const docs = await call(
        `${BASE}/category.json?category_group_code=${categoryCode}&x=${lng}&y=${lat}&radius=${radiusMeters}&size=15`,
      );
      return docs.map(toPlace);
    },
  };
}
