import { describe, it, expect } from "vitest";
import { minimalNarration } from "../../server/itinerary/narrate";
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
