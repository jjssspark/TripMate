import { describe, it, expect } from "vitest";
import { haversineKm, travelMinutes, stayMinutes } from "../../server/itinerary/geo";

const 서울시청 = { lat: 37.5666, lng: 126.9784 };
const 부산시청 = { lat: 35.1798, lng: 129.075 };
const 성산일출봉 = { lat: 33.45913, lng: 126.94054 };
const 성산주차장 = { lat: 33.46136, lng: 126.93494 };

describe("haversineKm", () => {
  it("서울시청-부산시청 직선거리를 오차 1% 안에서 계산한다", () => {
    const result = haversineKm(서울시청, 부산시청);
    expect(result).toBeGreaterThan(322);
    expect(result).toBeLessThan(329);
  });

  it("같은 좌표는 0을 반환한다", () => {
    expect(haversineKm(서울시청, 서울시청)).toBe(0);
  });
});

describe("travelMinutes", () => {
  it("가까운 거리라도 최소 10분을 보장한다", () => {
    expect(travelMinutes(성산일출봉, 성산주차장, "자차")).toBe(10);
  });

  it("도보가 자차보다 오래 걸린다", () => {
    expect(travelMinutes(서울시청, 부산시청, "도보")).toBeGreaterThan(
      travelMinutes(서울시청, 부산시청, "자차"),
    );
  });
});

describe("stayMinutes", () => {
  it("자연은 관광보다 오래 머문다", () => {
    expect(stayMinutes("자연")).toBe(120);
    expect(stayMinutes("관광")).toBe(90);
  });
});
