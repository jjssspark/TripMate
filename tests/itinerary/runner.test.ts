import { describe, it, expect } from "vitest";
import { runWithinBudget } from "../../server/itinerary/runner";
import type { PipelineDeps, PlanRequest } from "../../server/itinerary/pipeline";
import type { PlaceResolver } from "../../server/places/resolver";
import type { PlaceCategory, ResolvedPlace } from "../../server/itinerary/types";

const place = (name: string, lat: number, lng: number, category: PlaceCategory = "관광"): ResolvedPlace => ({
  id: name, name, lat, lng, category, address: `제주특별자치도 서귀포시 ${name}로 1`, mustVisit: false,
});

const resolver: PlaceResolver = {
  async resolve(name) {
    const i = Number(name.replace("장소", ""));
    if (Number.isNaN(i)) return null;
    return place(name, 33.3 + i * 0.05, 126.3 + i * 0.05);
  },
  async searchNearby(lat, lng, code) {
    return [place(`식당-${lat.toFixed(3)}-${code}`, lat, lng, code === "CE7" ? "카페" : "맛집")];
  },
};

const request: PlanRequest = {
  destination: "제주도", days: 3, intensity: "여유롭게",
  transportMode: "자차", styles: [], mustVisitPlaces: "", comments: "",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function depsWithSlowNarration(narrationMs: number): PipelineDeps {
  return {
    resolver,
    fetchCandidates: async () =>
      Array.from({ length: 12 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
    narrateDay: async (day) => {
      await sleep(narrationMs);
      return {
        theme: "테마",
        description: "설명",
        activities: day.activities.map((a) => ({ title: a.place.name, description: "d", tags: [] })),
      };
    },
  };
}

describe("runWithinBudget", () => {
  it("설명이 남은 예산보다 오래 걸려도 일정을 버리지 않고 강등해서 돌려준다", async () => {
    // 설명 500ms, 총 예산 300ms — 설명만으로 예산을 넘긴다.
    const result = await runWithinBudget(depsWithSlowNarration(500), request, 300);

    expect(result.narrationDegraded).toBe(true);
    expect(result.planContent).toHaveLength(3);
    expect(result.planContent[0].activities.length).toBeGreaterThan(0);
    expect(result.planContent[0].activities[0].description).not.toBe("");
  });

  it("남은 예산이 조금 있으면 그만큼만 기다리고 넘기지 않는다", async () => {
    // 예산 2000ms, 여유분 1000ms를 뺀 약 1000ms만 설명에 준다. 설명은 1500ms 걸린다.
    const started = Date.now();
    const result = await runWithinBudget(depsWithSlowNarration(1_500), request, 2_000);

    expect(result.narrationDegraded).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("예산이 넉넉하면 설명을 그대로 쓴다", async () => {
    const result = await runWithinBudget(depsWithSlowNarration(1), request, 5_000);

    expect(result.narrationDegraded).toBe(false);
    expect(result.planContent[0].theme).toBe("테마");
  });
});
