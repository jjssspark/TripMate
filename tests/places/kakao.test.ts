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

type FetchCall = { url: string; init?: RequestInit };

const fakeFetch = (payload: unknown, calls: FetchCall[] = []): typeof fetch =>
  (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => payload };
  }) as unknown as typeof fetch;

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

  it("Authorization 헤더를 담고, 이름을 percent-encoding해서 쿼리스트링에 싣는다", async () => {
    const calls: FetchCall[] = [];
    const resolver = createKakaoResolver("test-key", fakeFetch(성산일출봉응답, calls));
    await resolver.resolve("성산일출봉", "제주도");
    expect(calls).toHaveLength(1);
    const headers = calls[0].init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe("KakaoAK test-key");
    expect(calls[0].url).toContain(encodeURIComponent("제주도 성산일출봉"));
  });

  it("res.ok가 false면 상태 코드만 담아 에러를 던지고, 키나 URL을 노출하지 않는다", async () => {
    const resolver = createKakaoResolver("secret-key", (async () => ({
      ok: false, status: 429, json: async () => ({}),
    })) as unknown as typeof fetch);
    await expect(resolver.resolve("성산일출봉", "제주도")).rejects.toThrow("카카오 로컬 API 실패: 429");
    try {
      await resolver.resolve("성산일출봉", "제주도");
      throw new Error("에러가 던져지지 않음");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).not.toContain("secret-key");
      expect(message).not.toContain("dapi.kakao.com");
    }
  });

  it("주차장(PK6)이 먼저 와도 걸러내고 실제 명소를 찾는다", async () => {
    const payload = {
      documents: [
        {
          id: "999", place_name: "성산일출봉 주차장", category_group_code: "PK6",
          category_name: "교통,수송 > 주차장",
          x: "126.94100", y: "33.45950",
          road_address_name: "", address_name: "제주특별자치도 서귀포시 성산읍 성산리 79",
          place_url: "http://place.map.kakao.com/999",
        },
        {
          id: "10332413", place_name: "성산일출봉", category_group_code: "",
          category_name: "여행 > 관광,명소 > 자연명소 > 산",
          x: "126.94054", y: "33.45913",
          road_address_name: "", address_name: "제주특별자치도 서귀포시 성산읍 성산리 78",
          place_url: "http://place.map.kakao.com/10332413",
        },
      ],
    };
    const resolver = createKakaoResolver("key", fakeFetch(payload));
    const result = await resolver.resolve("성산일출봉", "제주도");
    expect(result).toMatchObject({ id: "10332413", name: "성산일출봉" });
  });

  it("searchNearby는 카테고리 검색 응답을 ResolvedPlace[]로 매핑하고, 카테고리 코드를 요청 URL에 싣는다", async () => {
    const calls: FetchCall[] = [];
    const payload = {
      documents: [{
        id: "27459317", place_name: "꽃담수제버거", category_group_code: "FD6", category_name: "음식점 > 패스트푸드",
        x: "126.93607071345474", y: "33.462977212240034",
        road_address_name: "제주특별자치도 서귀포시 성산읍 일출로 284-7", address_name: "",
        place_url: "http://place.map.kakao.com/27459317",
      }],
    };
    const resolver = createKakaoResolver("key", fakeFetch(payload, calls));
    const result = await resolver.searchNearby(33.4591, 126.9405, "FD6", 1000);
    expect(result).toEqual([{
      id: "27459317", name: "꽃담수제버거", category: "맛집",
      lat: 33.462977212240034, lng: 126.93607071345474,
      address: "제주특별자치도 서귀포시 성산읍 일출로 284-7",
      placeUrl: "http://place.map.kakao.com/27459317", mustVisit: false,
    }]);
    expect(calls[0].url).toContain("category_group_code=FD6");
  });
});
