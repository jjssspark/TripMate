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

  it("항상 https URL을 돌려준다", () => {
    const 케이스 = [
      getMockupImage("맛집", "제주도", 0),
      getMockupImage("관광", "도쿄", 1),
      getMockupImage("자연", "파리", 2),
      getMockupImage("", "", 0),
    ];
    케이스.forEach((url) => expect(url.startsWith("https://")).toBe(true));
  });
});
