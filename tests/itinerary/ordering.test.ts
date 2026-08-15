import { describe, it, expect } from "vitest";
import { orderWithinDay, orderDays, totalPathKm } from "../../server/itinerary/routing";
import type { ResolvedPlace } from "../../server/itinerary/types";

const place = (id: string, lat: number, lng: number): ResolvedPlace => ({
  id, name: `장소${id}`, lat, lng, category: "관광", address: "주소", mustVisit: false,
});

// 일부러 뒤섞은 일직선 배치
const 뒤섞인직선 = [
  place("c", 33.5, 126.5), place("a", 33.1, 126.1), place("d", 33.7, 126.7), place("b", 33.3, 126.3),
];

// 난수 대신 결정적 셔플. 테스트가 매번 같아야 한다.
function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("orderWithinDay", () => {
  it("일직선 배치를 순서대로 정렬한다", () => {
    expect(orderWithinDay(뒤섞인직선, null).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("총 이동거리가 무작위 순열 100회보다 항상 짧거나 같다", () => {
    const best = totalPathKm(orderWithinDay(뒤섞인직선, null), null);
    for (let seed = 1; seed <= 100; seed += 1) {
      expect(best).toBeLessThanOrEqual(totalPathKm(shuffleDeterministic(뒤섞인직선, seed), null) + 1e-9);
    }
  });

  it("시작점이 주어지면 그 지점에서 가까운 곳부터 돈다", () => {
    expect(orderWithinDay(뒤섞인직선, { lat: 33.75, lng: 126.75 })[0].id).toBe("d");
  });

  it("9개 이상이면 근사 정렬로 넘어가되 예외를 던지지 않는다", () => {
    const many = Array.from({ length: 12 }, (_, i) => place(`p${i}`, 33 + i * 0.1, 126 + i * 0.1));
    expect(() => orderWithinDay(many, null)).not.toThrow();
    expect(orderWithinDay(many, null)).toHaveLength(12);
  });
});

describe("orderDays", () => {
  it("권역 중심을 최단 순회 순서로 돌려준다", () => {
    const centers = [{ lat: 33.5, lng: 126.5 }, { lat: 33.1, lng: 126.1 }, { lat: 33.3, lng: 126.3 }];
    expect(orderDays(centers)).toEqual([0, 2, 1]);
  });
});
