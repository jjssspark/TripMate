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
  it("키가 없을 때 폴백으로 쓰이는 목업 이미지는 카테고리별로 정해져 있다", () => {
    expect(getMockupImage("맛집", "제주도", 0)).toContain("http");
    expect(getMockupImage("관광", "알수없는곳", 0)).toContain("http");
  });
});
