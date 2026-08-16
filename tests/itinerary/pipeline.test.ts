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
    result.planContent.forEach((day) => {
      expect(day.activities.some((a) => a.isMeal)).toBe(true);
    });
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
});
