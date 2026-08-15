import { describe, it, expect } from "vitest";
import { createKakaoResolver, isGenericName, matchesRequest, mapCategory } from "../../server/places/kakao";

const 성산일출봉응답 = {
  documents: [{
    id: "10332413", place_name: "성산일출봉", category_group_code: "",
    category_name: "여행 > 관광,명소 > 자연명소 > 산",
    x: "126.94054", y: "33.45913",
    road_address_name: "", address_name: "제주특별자치도 서귀포시 성산읍 성산리 78",
    place_url: "http://place.map.kakao.com/10332413",
  }],
};

const fakeFetch = (payload: unknown): typeof fetch =>
  (async () => ({ ok: true, status: 200, json: async () => payload })) as unknown as typeof fetch;

describe("isGenericName", () => {
  it("일반명사가 섞인 후보를 걸러낸다", () => {
    expect(isGenericName("제주도 소문난 맛집")).toBe(true);
    expect(isGenericName("현지 카페")).toBe(true);
    expect(isGenericName("전망 좋은 곳")).toBe(true);
  });

  it("실제 상호명은 통과시킨다", () => {
    expect(isGenericName("성산일출봉")).toBe(false);
    expect(isGenericName("우진해장국")).toBe(false);
  });
});

describe("matchesRequest", () => {
  it("요청명과 결과명이 포함 관계면 통과한다", () => {
    expect(matchesRequest("성산일출봉", "성산일출봉")).toBe(true);
    expect(matchesRequest("성산 일출봉", "성산일출봉")).toBe(true);
  });

  it("엉뚱한 매칭은 막는다", () => {
    expect(matchesRequest("제주 유명 오름", "새별오름")).toBe(false);
  });
});

describe("mapCategory", () => {
  it("카테고리 코드가 비어도 category_name으로 분류한다", () => {
    expect(mapCategory("", "여행 > 관광,명소 > 자연명소 > 산")).toBe("자연");
  });

  it("FD6은 맛집으로 매핑한다", () => {
    expect(mapCategory("FD6", "음식점 > 한식")).toBe("맛집");
  });

  it("자연 키워드가 코드보다 우선한다", () => {
    expect(mapCategory("AT4", "여행 > 관광,명소 > 해수욕장")).toBe("자연");
  });
});

describe("createKakaoResolver", () => {
  it("응답을 ResolvedPlace로 매핑한다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch(성산일출봉응답));
    const result = await resolver.resolve("성산일출봉", "제주도");
    expect(result).toMatchObject({ id: "10332413", name: "성산일출봉", category: "자연", lat: 33.45913, lng: 126.94054 });
  });

  it("도로명주소가 비면 지번주소를 쓴다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch(성산일출봉응답));
    expect((await resolver.resolve("성산일출봉", "제주도"))!.address)
      .toBe("제주특별자치도 서귀포시 성산읍 성산리 78");
  });

  it("검색 결과가 비면 null을 반환한다", async () => {
    const resolver = createKakaoResolver("key", fakeFetch({ documents: [] }));
    expect(await resolver.resolve("없는장소", "제주도")).toBeNull();
  });

  it("일반명사는 호출조차 하지 않고 null을 반환한다", async () => {
    let called = false;
    const resolver = createKakaoResolver("key", (async () => {
      called = true;
      return { ok: true, status: 200, json: async () => 성산일출봉응답 };
    }) as unknown as typeof fetch);
    expect(await resolver.resolve("제주도 소문난 맛집", "제주도")).toBeNull();
    expect(called).toBe(false);
  });
});
