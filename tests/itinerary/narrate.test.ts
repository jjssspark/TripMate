import { describe, it, expect } from "vitest";
import { minimalNarration } from "../../server/itinerary/narrate";
import type { ScheduledDay } from "../../server/itinerary/types";

const day: ScheduledDay = {
  day: 1,
  activities: [{
    place: {
      id: "1", name: "성산일출봉", lat: 33.4591, lng: 126.9405, category: "자연",
      address: "제주특별자치도 서귀포시 성산읍 일출로 284-12", mustVisit: true,
    },
    startMinutes: 540, stayMinutes: 120, travelFromPrevMinutes: 0, isMeal: false,
  }],
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
});
