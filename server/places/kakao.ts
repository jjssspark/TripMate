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

const MIN_CONTAINMENT_CHARS = 3;

export function matchesRequest(requested: string, returned: string): boolean {
  const a = normalize(requested);
  const b = normalize(returned);
  if (a === b) return true;
  // 짧은 이름은 무관한 긴 상호에 우연히 포함된다. "산"이 "한라산아래첫마을"에 걸리는 식.
  if (Math.min(a.length, b.length) < MIN_CONTAINMENT_CHARS) return false;
  return a.includes(b) || b.includes(a);
}

// 카카오는 명소를 검색하면 그 주차장도 함께 준다. 이름이 비슷해 matchesRequest를 통과하므로
// 코드로 먼저 걸러낸다. resolve는 필수 방문지 복구 경로도 겸하므로 숙박(AD5)은 제외하지
// 않는다 — 사용자가 이름으로 찍은 한옥스테이·고택을 걸러내면 그 복구 로직이 무의미해진다.
const EXCLUDED_CODES = ["PK6"];

const CODE_MAP: Record<string, PlaceCategory> = {
  FD6: "맛집", CE7: "카페", AT4: "관광", CT1: "문화", MT1: "쇼핑",
};
const NATURE_TOKENS = ["자연", "산", "해수욕장", "폭포", "오름", "공원"];

// 코드가 확정적이면 그대로 믿는다. 카카오는 성산일출봉처럼 코드를 비워 보내는 경우가
// 있고, AT4에는 해수욕장과 전망대가 함께 들어온다 — 그 둘만 이름으로 다시 가른다.
export function mapCategory(code: string, categoryName: string): PlaceCategory {
  const mapped = CODE_MAP[code];
  if (mapped && mapped !== "관광") return mapped;
  if (NATURE_TOKENS.some((t) => categoryName.includes(t))) return "자연";
  return mapped ?? "관광";
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
      const usable = docs.filter((d) => !EXCLUDED_CODES.includes(d.category_group_code));
      const hit = usable.find((d) => matchesRequest(name, d.place_name));
      return hit ? toPlace(hit) : null;
    },

    async searchNearby(lat, lng, categoryCode: KakaoCategoryCode, radiusMeters) {
      const docs = await call(
        `${BASE}/category.json?category_group_code=${categoryCode}&x=${lng}&y=${lat}&radius=${radiusMeters}&size=15`,
      );
      return docs.filter((d) => !EXCLUDED_CODES.includes(d.category_group_code)).map(toPlace);
    },
  };
}
