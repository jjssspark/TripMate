import { describe, it, expect } from "vitest";
import { searchDestinations, toChoseong, DOMESTIC_DESTINATIONS } from "../../src/lib/destinations";

describe("toChoseong", () => {
  it("converts a complete hangul syllable string to its choseong string", () => {
    // Arrange
    const input = "성산일출봉";

    // Act
    const result = toChoseong(input);

    // Assert
    expect(result).toBe("ㅅㅅㅇㅊㅂ");
  });

  it("leaves non-hangul characters unchanged", () => {
    // Arrange
    const input = "Jeju 2026";

    // Act
    const result = toChoseong(input);

    // Assert
    expect(result).toBe("Jeju 2026");
  });
});

describe("searchDestinations", () => {
  it("includes an exact-match destination in the results (TS-004 회귀 지점)", () => {
    // Arrange
    const query = "제주도";

    // Act
    const result = searchDestinations(query);

    // Assert — d !== query 같은 자기 배제 조건이 다시 들어가면 이 테스트가 실패한다
    expect(result).toContain("제주도");
  });

  it("ranks an exact match above prefix and substring matches", () => {
    // Arrange
    const query = "서울";

    // Act
    const result = searchDestinations(query);

    // Assert
    expect(result[0]).toBe("서울");
  });

  it("matches destinations by choseong-only query", () => {
    // Arrange
    const query = "ㅈㅈ";

    // Act
    const result = searchDestinations(query, 20);

    // Assert
    expect(result).toEqual(expect.arrayContaining(["전주", "진주", "제주도"]));
  });

  it("returns the default destination list when the query is empty", () => {
    // Arrange
    const query = "   ";

    // Act
    const result = searchDestinations(query, 5);

    // Assert
    expect(result).toEqual(DOMESTIC_DESTINATIONS.slice(0, 5));
  });

  it("returns no more than the requested limit", () => {
    // Arrange
    const query = "도";

    // Act
    const result = searchDestinations(query, 3);

    // Assert
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
