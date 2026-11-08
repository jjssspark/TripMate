import { describe, it, expect } from "vitest";
import { parsePlanInput, MAX_DAYS, collectPlaceNames } from "../../server/itinerary/entry";

describe("parsePlanInput", () => {
  it("유효한 날짜 범위면 정확한 일수를 계산한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-09-04", endDate: "2026-09-06" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.days).toBe(3);
      expect(result.value.request.days).toBe(3);
    }
  });

  it("당일치기(시작일=종료일)면 1일로 계산한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-09-04", endDate: "2026-09-04" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.days).toBe(1);
  });

  it("파싱 불가능한 날짜면 TRIP_DATES_INVALID를 반환한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "어제", endDate: "2026-09-06" });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe("TRIP_DATES_INVALID");
      expect(result.field).toBe("startDate");
    }
  });

  it("종료일이 시작일보다 앞서면 TRIP_DATES_INVALID를 반환한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-09-06", endDate: "2026-09-04" });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.code).toBe("TRIP_DATES_INVALID");
  });

  it("날짜가 없으면 기본값 3일로 떨어진다", () => {
    const result = parsePlanInput({ destination: "제주도" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.days).toBe(3);
  });

  it("15일짜리 여행은 TRIP_TOO_LONG을 반환한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-01-01", endDate: "2026-01-15" });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe("TRIP_TOO_LONG");
      expect(result.field).toBe("endDate");
    }
  });

  it("정확히 14일은 허용한다", () => {
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-01-01", endDate: "2026-01-14" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.days).toBe(MAX_DAYS);
  });

  it("목적지가 비어 있으면 DESTINATION_REQUIRED를 반환한다", () => {
    const result = parsePlanInput({ destination: "" });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe("DESTINATION_REQUIRED");
      expect(result.field).toBe("destination");
    }
  });

  it("공백만 있는 목적지도 DESTINATION_REQUIRED를 반환한다", () => {
    const result = parsePlanInput({ destination: "   " });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.code).toBe("DESTINATION_REQUIRED");
  });

  it("2026-01-01 ~ 2027-01-01(367일)은 TRIP_TOO_LONG으로 막는다", () => {
    // FINDING 2의 재현 조건 — 상한이 없으면 이 범위가 그대로 통과해 버렸다.
    const result = parsePlanInput({ destination: "제주도", startDate: "2026-01-01", endDate: "2027-01-01" });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.code).toBe("TRIP_TOO_LONG");
  });

  it("강도·이동수단·스타일이 허용값이 아니면 기본값으로 정규화한다", () => {
    const result = parsePlanInput({
      destination: "제주도", intensity: "알수없음", transportMode: "비행기", styles: "문자열",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.request.intensity).toBe("여유롭게");
      expect(result.value.request.transportMode).toBe("대중교통");
      expect(result.value.request.styles).toEqual([]);
    }
  });

  it("예산·동행자를 요청에 담는다", () => {
    const result = parsePlanInput({ destination: "제주도", budget: "절약형", companion: "가족" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.request.budget).toBe("절약형");
      expect(result.value.request.companion).toBe("가족");
    }
  });

  it("예산·동행자가 없거나 문자열이 아니면 필드 자체를 넣지 않는다", () => {
    const result = parsePlanInput({ destination: "제주도", budget: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.request.budget).toBeUndefined();
      expect(result.value.request.companion).toBeUndefined();
    }
  });

  it("목적지 앞뒤 공백을 잘라낸다", () => {
    const result = parsePlanInput({ destination: "  제주도  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.request.destination).toBe("제주도");
  });
});

describe("collectPlaceNames", () => {
  it("일차별 활동에서 문자열 제목만 모은다", () => {
    const names = collectPlaceNames([
      { activities: [{ title: "해운대해수욕장" }, { title: 42 }, {}] },
      { activities: "잘못된 값" },
      null,
      { activities: [{ title: "광안대교" }] },
    ]);
    expect(names).toEqual(["해운대해수욕장", "광안대교"]);
  });
});
