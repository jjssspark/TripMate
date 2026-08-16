import { describe, it, expect } from "vitest";
import { generateItinerary, type PipelineDeps, type PlanRequest } from "../../server/itinerary/pipeline";
import type { PlaceResolver } from "../../server/places/resolver";
import type { PlaceCategory, ResolvedPlace } from "../../server/itinerary/types";

const place = (name: string, lat: number, lng: number, category: PlaceCategory = "관광"): ResolvedPlace => ({
  id: name, name, lat, lng, category, address: `제주특별자치도 서귀포시 ${name}로 1`, mustVisit: false,
});

const fakeResolver: PlaceResolver = {
  async resolve(name) {
    const i = Number(name.replace("장소", ""));
    if (Number.isNaN(i)) return null;
    return place(name, 33.3 + i * 0.05, 126.3 + i * 0.05);
  },
  async searchNearby(lat, lng, code) {
    return [place(`식당-${lat.toFixed(3)}-${code}`, lat, lng, code === "CE7" ? "카페" : "맛집")];
  },
};

const deps: PipelineDeps = {
  resolver: fakeResolver,
  fetchCandidates: async () =>
    Array.from({ length: 12 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
  narrateDay: async () => { throw new Error("설명 생성 실패"); },
};

const request: PlanRequest = {
  destination: "제주도", days: 3, intensity: "여유롭게",
  transportMode: "자차", styles: [], mustVisitPlaces: "", comments: "",
};

function timeToMinutes(time: string): number {
  const matched = time.match(/^(오전|오후) (\d{2}):(\d{2})$/);
  if (!matched) throw new Error(`시간 형식이 올바르지 않습니다: ${time}`);
  const [, period, hh, mm] = matched;
  let hours = Number(hh) % 12;
  if (period === "오후") hours += 12;
  return hours * 60 + Number(mm);
}

// 여유롭게(min 1, max 3)로는 클러스터가 하한을 밑돌 일이 없어 AT4 구제가 발동하지 않는다.
// 빡빡하게(min 4)로 A군집 10곳 + B군집 3곳을 흩어 두면 B군집이 하한(4)에 못 미치고
// leftover도 없어 fillToMinimum이 채우지 못한다 — AT4 구제가 실제로 도는 유일한 조합.
function makeRescueDeps(): { deps: PipelineDeps; categoryCalls: string[] } {
  const categoryCalls: string[] = [];
  // Kakao가 전망대(AT4)와 식당(FD6)에 같은 id를 내려주는 복합 시설을 흉내낸다.
  const collidingPlace = place("구름전망대카페", 34.905, 128.905, "카페");

  const coords: Record<string, [number, number]> = {};
  for (let i = 0; i < 10; i += 1) coords[`A${i}`] = [33.3 + i * 0.001, 126.3 + i * 0.001];
  for (let i = 0; i < 3; i += 1) coords[`B${i}`] = [34.9 + i * 0.001, 128.9 + i * 0.001];

  const resolver: PlaceResolver = {
    async resolve(name) {
      const c = coords[name];
      return c ? place(name, c[0], c[1]) : null;
    },
    async searchNearby(lat, lng, code) {
      categoryCalls.push(code);
      if (code === "AT4") return [collidingPlace];
      if (code === "FD6") {
        return [collidingPlace, place(`식당-${lat.toFixed(3)}-${lng.toFixed(3)}`, lat, lng, "맛집")];
      }
      return [place(`카페-${lat.toFixed(3)}-${lng.toFixed(3)}`, lat, lng, "카페")];
    },
  };

  const deps: PipelineDeps = {
    resolver,
    fetchCandidates: async () => [
      ...Array.from({ length: 10 }, (_, i) => ({ name: `A${i}`, category: "관광" as const })),
      ...Array.from({ length: 3 }, (_, i) => ({ name: `B${i}`, category: "관광" as const })),
    ],
    narrateDay: async () => { throw new Error("설명 생성 실패"); },
  };

  return { deps, categoryCalls };
}

const rescueRequest: PlanRequest = {
  destination: "제주도", days: 3, intensity: "빡빡하게",
  transportMode: "자차", styles: [], mustVisitPlaces: "", comments: "",
};

describe("generateItinerary", () => {
  it("요청한 일수만큼 날짜를 만든다", async () => {
    expect((await generateItinerary(deps, request)).planContent).toHaveLength(3);
  });

  it("같은 장소가 두 날짜에 나오지 않는다", async () => {
    const result = await generateItinerary(deps, request);
    const titles = result.planContent.flatMap((d) => d.activities.map((a) => a.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("매일 식사가 배치되고 시간순으로 정렬된다", async () => {
    const result = await generateItinerary(deps, request);
    const mealTitles: string[] = [];
    result.planContent.forEach((day) => {
      expect(day.activities.some((a) => a.isMeal)).toBe(true);

      const minutes = day.activities.map((a) => timeToMinutes(a.time));
      for (let i = 1; i < minutes.length; i += 1) {
        expect(minutes[i]).toBeGreaterThanOrEqual(minutes[i - 1]);
      }

      day.activities.filter((a) => a.isMeal).forEach((a) => mealTitles.push(a.title));
    });
    expect(new Set(mealTitles).size).toBe(mealTitles.length);
  });

  it("AT4로 구제된 장소가 다른 날 식당으로 다시 뽑히지 않는다", async () => {
    const { deps: rescueDeps, categoryCalls } = makeRescueDeps();
    const result = await generateItinerary(rescueDeps, rescueRequest);

    // 계측: AT4 구제 경로가 실제로 실행됐는지 확인한다. 안 돌았다면 이 테스트는 아무것도 증명하지 못한다.
    expect(categoryCalls).toContain("AT4");

    const titles = result.planContent.flatMap((d) => d.activities.map((a) => a.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("설명 생성이 모두 실패하면 narrationDegraded를 세우고 최소 설명으로 채운다", async () => {
    const result = await generateItinerary(deps, request);
    expect(result.narrationDegraded).toBe(true);
    expect(result.planContent[0].activities[0].description).not.toBe("");
  });

  it("검증된 장소가 최소치에 못 미치면 오류를 던진다", async () => {
    const 빈리졸버: PlaceResolver = { async resolve() { return null; }, async searchNearby() { return []; } };
    await expect(generateItinerary({ ...deps, resolver: 빈리졸버 }, request)).rejects.toThrow(/장소/);
  });

  it("모델이 후보 목록에서 빠뜨린 필수 방문지를 직접 조회해 채운다", async () => {
    const resolver: PlaceResolver = {
      async resolve(name) {
        if (name === "성산일출봉") return place("성산일출봉", 33.459, 126.941, "자연");
        const i = Number(name.replace("장소", ""));
        if (Number.isNaN(i)) return null;
        return place(name, 33.3 + i * 0.05, 126.3 + i * 0.05);
      },
      async searchNearby(lat, lng, code) {
        return [place(`식당-${lat.toFixed(3)}-${code}`, lat, lng, code === "CE7" ? "카페" : "맛집")];
      },
    };
    const mustDeps: PipelineDeps = {
      resolver,
      // 후보 목록에 성산일출봉이 없다 — 모델이 프롬프트 지시를 무시한 상황을 흉내낸다.
      fetchCandidates: async () =>
        Array.from({ length: 12 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
      narrateDay: async () => { throw new Error("설명 생성 실패"); },
    };
    const mustRequest: PlanRequest = { ...request, mustVisitPlaces: "성산일출봉" };

    const result = await generateItinerary(mustDeps, mustRequest);
    const found = result.planContent.flatMap((d) => d.activities).find((a) => a.title === "성산일출봉");
    expect(found).toBeDefined();
    expect(found?.mustVisit).toBe(true);
  });

  it("필수 방문지 이름에 공백 차이가 있어도 mustVisit로 인식한다", async () => {
    const resolver: PlaceResolver = {
      async resolve(name) {
        if (name === "성산 일출봉") return place("성산 일출봉", 33.459, 126.941, "자연");
        const i = Number(name.replace("장소", ""));
        if (Number.isNaN(i)) return null;
        return place(name, 33.3 + i * 0.05, 126.3 + i * 0.05);
      },
      async searchNearby(lat, lng, code) {
        return [place(`식당-${lat.toFixed(3)}-${code}`, lat, lng, code === "CE7" ? "카페" : "맛집")];
      },
    };
    const spacedDeps: PipelineDeps = {
      resolver,
      // 모델이 "성산일출봉"을 "성산 일출봉"으로 띄어 냈다 — 사용자 입력과 정확히 일치하지 않는다.
      fetchCandidates: async () => [
        { name: "성산 일출봉", category: "자연" as const },
        ...Array.from({ length: 11 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
      ],
      narrateDay: async () => { throw new Error("설명 생성 실패"); },
    };
    const spacedRequest: PlanRequest = { ...request, mustVisitPlaces: "성산일출봉" };

    const result = await generateItinerary(spacedDeps, spacedRequest);
    const found = result.planContent.flatMap((d) => d.activities).find((a) => a.title === "성산 일출봉");
    expect(found).toBeDefined();
    expect(found?.mustVisit).toBe(true);
  });
});
