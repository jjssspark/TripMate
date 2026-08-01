/**
 * 국내 여행지 목록과 검색 유틸.
 *
 * 초성 검색을 지원한다. "ㄱㄹ" → 강릉, 군산, 거제 …
 */

/** 여행지로 자주 찾는 국내 지명 100곳. 권역 순서로 정렬돼 있다. */
export const DOMESTIC_DESTINATIONS: readonly string[] = [
  // 서울
  "서울", "강남", "홍대", "명동", "인사동", "북촌한옥마을", "이태원", "성수동", "여의도", "잠실",
  // 경기·인천
  "인천", "송도", "강화도", "영종도", "수원", "용인", "가평", "양평", "포천", "파주",
  "남양주", "이천",
  // 강원
  "강릉", "속초", "양양", "평창", "정선", "춘천", "원주", "동해", "삼척", "홍천",
  "인제", "태백", "고성",
  // 충청
  "대전", "세종", "청주", "충주", "제천", "단양", "공주", "부여", "보령", "태안",
  "서산", "천안", "아산",
  // 전라
  "전주", "군산", "여수", "순천", "광주", "목포", "담양", "남원", "고창", "부안",
  "완도", "진도", "보성", "곡성",
  // 경상
  "부산", "해운대", "광안리", "감천문화마을", "대구", "경주", "포항", "안동", "울산", "창원",
  "통영", "거제", "남해", "진주", "하동", "청도", "문경", "영덕", "울진", "김해",
  "밀양",
  // 제주
  "제주도", "서귀포", "성산일출봉", "우도", "협재", "애월", "중문",
  // 섬
  "울릉도", "안면도", "홍도",
  // 산
  "설악산", "지리산", "한라산", "북한산", "오대산", "내장산", "속리산",
];

const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const HANGUL_BASE = 0xac00; // '가'
const HANGUL_LAST = 0xd7a3; // '힣'
const JONGSEONG_COUNT = 28;
const JUNGSEONG_COUNT = 21;

/** "강릉" → "ㄱㄹ". 한글 음절이 아닌 문자는 그대로 둔다. */
export function toChoseong(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const index = Math.floor((code - HANGUL_BASE) / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
      result += CHOSEONG[index];
    } else {
      result += char;
    }
  }
  return result;
}

/** 입력이 초성만으로 이뤄졌는가. "ㄱㄹ" → true, "강" → false */
function isChoseongOnly(query: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(query);
}

/**
 * 관련도 순위. 낮을수록 먼저 노출된다.
 * 완전 일치 → 앞에서부터 일치 → 포함 → 초성 일치 순.
 */
function rank(name: string, query: string): number | null {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;

  if (isChoseongOnly(query)) {
    const choseong = toChoseong(name);
    if (choseong.startsWith(query)) return 3;
    if (choseong.includes(query)) return 4;
  }

  return null;
}

/**
 * 목적지 검색. 관련도 순으로 정렬해 최대 `limit`개를 돌려준다.
 * 빈 입력이면 목록 앞쪽(주요 도시)을 그대로 보여준다.
 */
export function searchDestinations(query: string, limit = 8): string[] {
  const trimmed = query.trim();
  if (!trimmed) return DOMESTIC_DESTINATIONS.slice(0, limit);

  return DOMESTIC_DESTINATIONS
    .map((name) => ({ name, score: rank(name, trimmed) }))
    .filter((entry): entry is { name: string; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
    .slice(0, limit)
    .map((entry) => entry.name);
}
