import { describe, it, expect, afterEach } from "vitest";
import { fetchRealPlacePhotoRef, getMockupImage } from "../../server/places/photos";

// 실제 키가 아니라 테스트 전용 문자열이다. 네트워크는 타지 않는다.
const 테스트키 = "TEST-ONLY-PLACES-KEY";

afterEach(() => {
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("fetchRealPlacePhotoRef", () => {
  it("모듈 로드 이후에 설정된 키도 반영한다", async () => {
    // 모듈은 이미 import 됐다. 이 시점에 키를 넣어도 조회가 돌아야 한다.
    process.env.GOOGLE_PLACES_API_KEY = 테스트키;

    const urls: string[] = [];
    const ref = await fetchRealPlacePhotoRef("성산일출봉", "제주도", async (url) => {
      urls.push(url);
      return { candidates: [{ photos: [{ photo_reference: "ref-123" }] }] };
    });

    expect(urls).toHaveLength(1);
    // 키 자체를 단언 메시지로 흘리지 않도록 boolean으로만 확인한다.
    expect(urls[0].includes(`key=${테스트키}`)).toBe(true);
    expect(ref).toBe("ref-123");
  });

  it("키가 없으면 조회를 시도하지 않고 null을 돌려준다", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;

    let called = 0;
    const ref = await fetchRealPlacePhotoRef("성산일출봉", "제주도", async () => {
      called += 1;
      return {};
    });

    expect(called).toBe(0);
    expect(ref).toBeNull();
  });

  it("키를 지우면 다시 null로 내려간다", async () => {
    process.env.GOOGLE_PLACES_API_KEY = 테스트키;
    const first = await fetchRealPlacePhotoRef("성산일출봉", "제주도", async () => ({
      candidates: [{ photos: [{ photo_reference: "ref-123" }] }],
    }));
    delete process.env.GOOGLE_PLACES_API_KEY;
    const second = await fetchRealPlacePhotoRef("성산일출봉", "제주도", async () => ({
      candidates: [{ photos: [{ photo_reference: "ref-123" }] }],
    }));

    expect(first).toBe("ref-123");
    expect(second).toBeNull();
  });
});

describe("getMockupImage", () => {
  it("목적지마다 다른 이미지를 쓴다", () => {
    expect(getMockupImage("관광", "제주도", 0)).not.toBe(getMockupImage("관광", "도쿄", 0));
    expect(getMockupImage("관광", "제주도", 0)).not.toBe(getMockupImage("관광", "알수없는곳", 0));
  });

  it("같은 목적지 안에서 맛집은 다른 이미지를 쓴다", () => {
    expect(getMockupImage("맛집", "제주도", 0)).not.toBe(getMockupImage("관광", "제주도", 0));
    expect(getMockupImage("맛집", "도쿄", 0)).not.toBe(getMockupImage("관광", "도쿄", 0));
  });

  it("제주 일반 활동은 이미지 3장을 인덱스로 돌려 쓴다", () => {
    const 제주 = (i: number) => getMockupImage("관광", "제주도", i);
    expect(제주(0)).not.toBe(제주(1));
    expect(제주(1)).not.toBe(제주(2));
    expect(제주(3)).toBe(제주(0)); // 3장 순환
    expect(제주(4)).toBe(제주(1));
  });

  it("맛집은 인덱스와 무관하게 같은 이미지를 준다", () => {
    expect(getMockupImage("맛집", "제주도", 0)).toBe(getMockupImage("맛집", "제주도", 7));
  });

  it("모르는 목적지는 카테고리 폴백으로 내려가고 카테고리끼리도 구분된다", () => {
    const 카페 = getMockupImage("카페", "알수없는곳", 0);
    const 자연 = getMockupImage("자연", "알수없는곳", 0);
    const 기타 = getMockupImage("분류불가", "알수없는곳", 0);
    expect(new Set([카페, 자연, 기타]).size).toBe(3);
    expect(getMockupImage("분류불가", "알수없는곳", 5)).toBe(기타); // 폴백은 인덱스와 무관
  });

  // getMockupImage는 목적지 7분기 + 카테고리 폴백 9분기로 갈라진다. 네 개만 찔러 보면
  // 나머지 분기 하나가 http://를 돌려줘도 통과한다. 분기마다 대표 입력을 하나씩 둔다.
  const 모든분기: readonly [string, string, string][] = [
    ["도쿄 맛집", "맛집", "도쿄"],
    ["도쿄 일반", "관광", "tokyo"],
    ["오사카", "관광", "오사카"],
    ["제주 맛집", "맛집", "제주도"],
    ["제주 일반", "관광", "jeju"],
    ["파리", "관광", "파리"],
    ["시드니", "관광", "sydney"],
    ["폴백 맛집", "맛집", "알수없는곳"],
    ["폴백 카페", "카페", "알수없는곳"],
    ["폴백 쇼핑", "쇼핑", "알수없는곳"],
    ["폴백 숙소", "호텔", "알수없는곳"],
    ["폴백 관광", "명소", "알수없는곳"],
    ["폴백 자연", "바다", "알수없는곳"],
    ["폴백 액티비티", "체험", "알수없는곳"],
    ["폴백 문화", "박물관", "알수없는곳"],
    ["폴백 기본", "분류불가", "알수없는곳"],
  ];

  it.each(모든분기)("모든 분기가 https URL을 돌려준다: %s", (_이름, 카테고리, 목적지) => {
    expect(getMockupImage(카테고리, 목적지, 0).startsWith("https://")).toBe(true);
  });

  it("나열한 입력이 서로 다른 분기로 간다", () => {
    // 분기마다 URL이 다르므로, 전부 다르면 위 목록이 실제로 16개 분기를 밟았다는 뜻이다.
    // 분기가 늘거나 줄면 여기가 먼저 깨져 목록을 갱신하게 만든다.
    const urls = 모든분기.map(([, 카테고리, 목적지]) => getMockupImage(카테고리, 목적지, 0));
    expect(new Set(urls).size).toBe(모든분기.length);
  });

  it("빈 카테고리·빈 목적지도 https URL로 폴백한다", () => {
    expect(getMockupImage("", "", 0).startsWith("https://")).toBe(true);
  });
});
