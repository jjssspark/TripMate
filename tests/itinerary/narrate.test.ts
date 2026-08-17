import { describe, it, expect, vi } from "vitest";
import { minimalNarration, narrateTrip } from "../../server/itinerary/narrate";
import type { ScheduledActivity, ScheduledDay } from "../../server/itinerary/types";

function act(name: string, address: string): ScheduledActivity {
  return {
    place: {
      id: "1", name, lat: 33.4591, lng: 126.9405, category: "자연",
      address, mustVisit: true,
    },
    startMinutes: 540, stayMinutes: 120, travelFromPrevMinutes: 0, isMeal: false,
  };
}

const day: ScheduledDay = {
  day: 1,
  activities: [act("성산일출봉", "제주특별자치도 서귀포시 성산읍 일출로 284-12")],
};

describe("minimalNarration", () => {
  it("실제 데이터만으로 설명을 만든다", () => {
    const result = minimalNarration(day, "제주도");
    expect(result.theme).toBe("제주도 1일차");
    expect(result.activities[0].title).toBe("성산일출봉");
    expect(result.activities[0].description).toContain("제주특별자치도 서귀포시 성산읍 일출로 284-12");
    expect(result.activities[0].description).toContain("자연");
  });

  it("주소에서 시·군·구를 뽑아 날짜 설명을 만든다", () => {
    expect(minimalNarration(day, "제주도").description).toContain("서귀포시");
  });

  it("여러 지역에 걸친 날은 지역명을 중복 없이 모은다", () => {
    // Arrange
    const 여러곳: ScheduledDay = {
      day: 2,
      activities: [
        act("성산일출봉", "제주특별자치도 서귀포시 성산읍 일출로 284-12"),
        act("광치기해변", "제주특별자치도 서귀포시 성산읍 고성리"),
        act("함덕해수욕장", "제주특별자치도 제주시 조천읍 조함해안로 525"),
      ],
    };

    // Act
    const result = minimalNarration(여러곳, "제주도");

    // Assert
    expect(result.description).toContain("서귀포시");
    expect(result.description).toContain("제주시");
    expect(result.description.match(/서귀포시/g)).toHaveLength(1);
    expect(result.activities).toHaveLength(3);
  });

  it("광역시 주소는 시가 아니라 구를 집는다", () => {
    // Arrange
    const 서울: ScheduledDay = { day: 1, activities: [act("경복궁", "서울특별시 종로구 사직로 161")] };

    // Act & Assert
    expect(minimalNarration(서울, "서울").description).toContain("종로구");
  });

  it("시·군·구가 없는 주소면 목적지 이름으로 대체한다", () => {
    // Arrange
    const 주소없음: ScheduledDay = { day: 1, activities: [act("어딘가", "울릉읍 도동리 1")] };

    // Act & Assert
    expect(minimalNarration(주소없음, "울릉도").description).toContain("울릉도");
  });
});

const 이틀: ScheduledDay[] = [
  { day: 1, activities: [act("성산일출봉", "제주 서귀포시 성산읍 일출로 284-12")] },
  { day: 2, activities: [act("함덕해수욕장", "제주 제주시 조천읍 조함해안로 525")] },
];

function narrated(day: number, title: string) {
  return { day, theme: `${day}일차`, description: `${day}일차 요약`, activities: [{ title, description: `${title} 설명`, tags: ["태그"] }] };
}

function fakeAi(reply: unknown | (() => never)) {
  const generateContent = vi.fn(async () => {
    if (typeof reply === "function") (reply as () => never)();
    return { text: typeof reply === "string" ? reply : JSON.stringify(reply) };
  });
  return { ai: { models: { generateContent } } as never, generateContent };
}

describe("narrateTrip", () => {
  it("여행 전체를 한 번의 호출로 처리한다", async () => {
    // Arrange — 무료 한도가 모델당 20회/일이라 일차마다 부르면 일정 몇 건 만에 바닥난다
    const { ai, generateContent } = fakeAi({ days: [narrated(1, "성산일출봉"), narrated(2, "함덕해수욕장")] });

    // Act
    await narrateTrip(ai, 이틀, "제주도");

    // Assert
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("정상 응답이면 일차 순서대로 설명을 돌려준다", async () => {
    // Arrange
    const { ai } = fakeAi({ days: [narrated(1, "성산일출봉"), narrated(2, "함덕해수욕장")] });

    // Act
    const result = await narrateTrip(ai, 이틀, "제주도");

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]?.activities[0].description).toBe("성산일출봉 설명");
    expect(result[1]?.activities[0].description).toBe("함덕해수욕장 설명");
  });

  it("장소 이름이 어긋난 일차만 null로 내리고 나머지는 살린다", async () => {
    // Arrange — 인덱스로 갖다 붙이므로 어긋나면 A 장소에 B 설명이 조용히 달린다
    const { ai } = fakeAi({ days: [narrated(1, "엉뚱한곳"), narrated(2, "함덕해수욕장")] });

    // Act
    const result = await narrateTrip(ai, 이틀, "제주도");

    // Assert
    expect(result[0]).toBeNull();
    expect(result[1]?.activities[0].description).toBe("함덕해수욕장 설명");
  });

  it("설명이 빈 일차는 null로 내린다", async () => {
    const 빈설명 = { day: 1, theme: "1일차", description: "요약", activities: [{ title: "성산일출봉", description: "   ", tags: [] }] };
    const { ai } = fakeAi({ days: [빈설명, narrated(2, "함덕해수욕장")] });

    const result = await narrateTrip(ai, 이틀, "제주도");

    expect(result[0]).toBeNull();
    expect(result[1]).not.toBeNull();
  });

  it("활동 개수가 안 맞는 일차는 null로 내린다", async () => {
    const 개수초과 = { day: 2, theme: "2일차", description: "요약", activities: [
      { title: "함덕해수욕장", description: "설명", tags: [] },
      { title: "덤", description: "설명", tags: [] },
    ] };
    const { ai } = fakeAi({ days: [narrated(1, "성산일출봉"), 개수초과] });

    const result = await narrateTrip(ai, 이틀, "제주도");

    expect(result[0]).not.toBeNull();
    expect(result[1]).toBeNull();
  });

  it("응답에 일차가 모자라면 빠진 일차는 null이다", async () => {
    const { ai } = fakeAi({ days: [narrated(1, "성산일출봉")] });

    const result = await narrateTrip(ai, 이틀, "제주도");

    expect(result).toHaveLength(2);
    expect(result[1]).toBeNull();
  });

  it("응답이 JSON이 아니면 던진다", async () => {
    const { ai } = fakeAi("설명을 준비했습니다");
    await expect(narrateTrip(ai, 이틀, "제주도")).rejects.toThrow();
  });

  it("응답이 비면 던진다", async () => {
    const ai = { models: { generateContent: vi.fn(async () => ({ text: "" })) } } as never;
    await expect(narrateTrip(ai, 이틀, "제주도")).rejects.toThrow();
  });

  it("API 오류는 삼키지 않고 그대로 올린다", async () => {
    // Arrange — 429 판별은 호출부(quota)가 한다. 여기서 삼키면 쿼터 소진이 안 보인다
    const quota = Object.assign(new Error("RESOURCE_EXHAUSTED"), { name: "ApiError", status: 429 });
    const { ai } = fakeAi(() => { throw quota; });

    // Act & Assert
    await expect(narrateTrip(ai, 이틀, "제주도")).rejects.toBe(quota);
  });
});
