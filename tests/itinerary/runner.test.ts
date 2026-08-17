import { describe, it, expect } from "vitest";
import { fetchWithRetry, runWithinBudget } from "../../server/itinerary/runner";
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
    narrateTrip: async (days) => {
      await sleep(narrationMs);
      return days.map((day) => ({
        theme: "테마",
        description: "설명",
        activities: day.activities.map((a) => ({ title: a.place.name, description: "d", tags: [] })),
      }));
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

  // 실측에서 4초를 받은 설명 호출이 4초를 다 태우고 실패했다. 어차피 강등될 일정에
  // 벽시계 4초와 무료 한도 1회를 버린 셈이라, 하한에 못 미치면 아예 부르지 않게 했다.
  it("남은 예산이 설명 하한에 못 미치면 아예 부르지 않는다", async () => {
    let calls = 0;
    let completed = 0;
    const deps: PipelineDeps = {
      resolver,
      fetchCandidates: async () =>
        Array.from({ length: 12 }, (_, i) => ({ name: `장소${i}`, category: "관광" as const })),
      narrateTrip: async () => {
        calls += 1;
        // 영원히 resolve되지 않는다. 타이머가 없어 이벤트 루프를 붙잡지도 않는다.
        const never = await new Promise<never>(() => {});
        completed += 1;
        return never;
      },
    };

    const result = await runWithinBudget(deps, request, 2_000);

    expect(calls).toBe(0); // 못 끝낼 걸 알면 한도를 쓰지 않는다
    expect(completed).toBe(0);
    expect(result.narrationDegraded).toBe(true);
    expect(result.planContent).toHaveLength(3);
  });

  it("예산이 넉넉하면 설명을 한 번 부르고 그대로 쓴다", async () => {
    let calls = 0;
    const deps = depsWithSlowNarration(1);
    const result = await runWithinBudget(
      { ...deps, narrateTrip: (d, dest) => { calls += 1; return deps.narrateTrip(d, dest); } },
      request,
      10_000,
    );

    expect(calls).toBe(1); // 일차마다가 아니라 여행 전체를 한 번에 부른다
    expect(result.narrationDegraded).toBe(false);
    expect(result.planContent[0].theme).toBe("테마");
  });
});

describe("fetchWithRetry", () => {
  it("일시적 오류는 한 번 더 시도한다", async () => {
    // Arrange
    let calls = 0;
    const call = async () => {
      calls += 1;
      if (calls === 1) throw new Error("일시적 오류");
      return "ok";
    };

    // Act
    const result = await fetchWithRetry(call);

    // Assert
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("쿼터 소진이면 재시도하지 않는다", async () => {
    // Arrange — 429는 다시 불러도 같은 429다. 재시도하면 남은 한도만 한 번 더 깎는다.
    let calls = 0;
    const quota = Object.assign(new Error("RESOURCE_EXHAUSTED"), { name: "ApiError", status: 429 });
    const call = async () => { calls += 1; throw quota; };

    // Act & Assert
    await expect(fetchWithRetry(call)).rejects.toBe(quota);
    expect(calls).toBe(1);
  });

  it("성공하면 한 번만 부른다", async () => {
    let calls = 0;
    const call = async () => { calls += 1; return "ok"; };

    await expect(fetchWithRetry(call)).resolves.toBe("ok");
    expect(calls).toBe(1);
  });
});
