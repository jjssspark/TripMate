import { describe, it, expect } from "vitest";
import { dedupe, assignToDays, fillToMinimum } from "../../server/itinerary/routing";
import type { ResolvedPlace } from "../../server/itinerary/types";

const place = (id: string, name: string, lat: number, lng: number, mustVisit = false): ResolvedPlace => ({
  id, name, lat, lng, category: "관광", address: `${name} 주소`, mustVisit,
});

// 제주 동부 3곳 / 서부 3곳 — 권역이 뚜렷하게 갈린다
const 동부 = [
  place("1", "성산일출봉", 33.4591, 126.9405),
  place("2", "섭지코지", 33.4239, 126.9308),
  place("3", "광치기해변", 33.4479, 126.9268),
];
const 서부 = [
  place("4", "협재해수욕장", 33.3939, 126.2396),
  place("5", "한림공원", 33.3878, 126.24),
  place("6", "금능해변", 33.3892, 126.2333),
];
const many = Array.from({ length: 20 }, (_, i) =>
  place(`p${i}`, `장소${i}`, 33.4 + i * 0.01, 126.5 + i * 0.01));

describe("dedupe", () => {
  it("이름이 같은 장소를 하나만 남긴다", () => {
    const result = dedupe([place("1", "성산일출봉", 33.4591, 126.9405), place("9", "성산 일출봉", 33.99, 126.99)]);
    expect(result).toHaveLength(1);
  });

  it("50m 이내면 이름이 달라도 같은 장소로 본다", () => {
    const result = dedupe([place("1", "성산일출봉", 33.4591, 126.9405), place("2", "성산일출봉 매표소", 33.45914, 126.94055)]);
    expect(result).toHaveLength(1);
  });

  it("떨어진 서로 다른 장소는 모두 남긴다", () => {
    expect(dedupe([...동부, ...서부])).toHaveLength(6);
  });
});

describe("assignToDays", () => {
  it("같은 장소가 서로 다른 두 날짜에 배정되지 않는다", () => {
    const ids = assignToDays([...동부, ...서부], 2, "빡빡하게").buckets.flat().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("지리적으로 가까운 장소끼리 같은 날에 묶인다", () => {
    const { buckets } = assignToDays([...동부, ...서부], 2, "빡빡하게");
    const 동부날 = buckets.find((b) => b.some((p) => p.id === "1"));
    expect(동부날!.map((p) => p.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("클러스터당 활동 수가 강도 상한을 넘지 않는다", () => {
    assignToDays(many, 2, "여유롭게").buckets.forEach((b) => expect(b.length).toBeLessThanOrEqual(3));
  });

  it("정원을 넘는 후보는 leftover로 빠지고 사라지지 않는다", () => {
    const { buckets, leftover } = assignToDays(many, 2, "여유롭게");
    expect(buckets.flat().length + leftover.length).toBe(20);
  });

  it("필수 방문지는 반드시 배정된다", () => {
    const must = place("must", "성산일출봉", 33.4591, 126.9405, true);
    const { buckets } = assignToDays([...many, must], 2, "여유롭게");
    expect(buckets.flat().some((p) => p.id === "must")).toBe(true);
  });

  it("같은 입력에 같은 출력을 낸다", () => {
    expect(assignToDays([...동부, ...서부], 2, "빡빡하게").buckets)
      .toEqual(assignToDays([...동부, ...서부], 2, "빡빡하게").buckets);
  });

  it("후보가 필요량보다 적어도 중복으로 채우지 않는다", () => {
    // 회귀 테스트 — 기존 createFallbackPlan은 3개 목록에서 6개를 뽑아 같은 장소를 두 번 넣었다
    const names = assignToDays(동부, 3, "빡빡하게").buckets.flat().map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(3);
  });
});

describe("fillToMinimum", () => {
  it("하한 미달 클러스터를 leftover에서 가장 가까운 것으로 채운다", () => {
    // Arrange — 동부·서부 중심에 한 곳씩만 배정된 상태. 나머지는 미배정.
    const assignment = {
      buckets: [[동부[0]], [서부[0]]],
      centers: [
        { lat: 33.4591, lng: 126.9405 },
        { lat: 33.3939, lng: 126.2396 },
      ],
      leftover: [동부[1], 서부[1], 동부[2], 서부[2]],
    };

    // Act
    const after = fillToMinimum(assignment, 2);

    // Assert — 각 클러스터가 자기 중심에 가장 가까운 것을 하나씩 가져간다
    expect(after.buckets[0].map((p) => p.id)).toEqual(["1", "3"]);
    expect(after.buckets[1].map((p) => p.id)).toEqual(["4", "5"]);
    expect(after.leftover.map((p) => p.id)).toEqual(["2", "6"]);
  });

  it("leftover가 비면 하한에 못 미쳐도 그대로 둔다", () => {
    // Arrange
    const assignment = {
      buckets: [[동부[0]], [서부[0]]],
      centers: [
        { lat: 33.4591, lng: 126.9405 },
        { lat: 33.3939, lng: 126.2396 },
      ],
      leftover: [],
    };

    // Act
    const after = fillToMinimum(assignment, 4);

    // Assert
    expect(after.buckets[0]).toHaveLength(1);
    expect(after.buckets[1]).toHaveLength(1);
  });

  it("입력 assignment를 변형하지 않는다", () => {
    // Arrange
    const leftover = [동부[1], 동부[2]];
    const assignment = {
      buckets: [[동부[0]]],
      centers: [{ lat: 33.4591, lng: 126.9405 }],
      leftover,
    };

    // Act
    fillToMinimum(assignment, 3);

    // Assert — 원본 배열이 그대로여야 한다 (불변성)
    expect(assignment.buckets[0]).toHaveLength(1);
    expect(leftover).toHaveLength(2);
  });
});
