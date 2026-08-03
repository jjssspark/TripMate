import { describe, it, expect } from "vitest";
import { getRecommendedSpots } from "../../src/lib/recommendedSpots";

describe("getRecommendedSpots", () => {
  it("returns the exact list for a destination that matches a key exactly", () => {
    // Arrange
    const destination = "서울";

    // Act
    const result = getRecommendedSpots(destination);

    // Assert
    expect(result).toEqual(["경복궁", "남산서울타워", "광장시장"]);
  });

  it("falls back to a prefix match when the destination is more specific than a known key", () => {
    // Arrange
    const destination = "제주";

    // Act
    const result = getRecommendedSpots(destination);

    // Assert
    expect(result).toEqual(getRecommendedSpots("제주도"));
  });

  it("returns an empty array for a destination outside the known list, instead of a made-up placeholder", () => {
    // Arrange — ADR-3: 모르는 목적지는 빈 배열을 반환해 추천 줄 자체를 숨긴다
    const destination = "산타클로스마을";

    // Act
    const result = getRecommendedSpots(destination);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns an empty array for an empty destination string", () => {
    // Arrange
    const destination = "   ";

    // Act
    const result = getRecommendedSpots(destination);

    // Assert
    expect(result).toEqual([]);
  });
});
