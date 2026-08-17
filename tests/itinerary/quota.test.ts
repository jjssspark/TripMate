import { describe, it, expect } from "vitest";
import { QuotaExceededError, isQuotaError, nextResetLabel } from "../../server/itinerary/quota";

describe("isQuotaError", () => {
  it("status가 429면 쿼터 오류다", () => {
    // Arrange — @google/genai의 ApiError는 status만 숫자로 달고 나머지는 message 문자열에 담는다
    const err = Object.assign(new Error('{"error":{"code":429}}'), { name: "ApiError", status: 429 });

    // Act & Assert
    expect(isQuotaError(err)).toBe(true);
  });

  it("status가 없어도 message에 RESOURCE_EXHAUSTED가 있으면 쿼터 오류다", () => {
    const err = new Error('{"error":{"status":"RESOURCE_EXHAUSTED"}}');
    expect(isQuotaError(err)).toBe(true);
  });

  it("429가 아닌 API 오류는 쿼터 오류가 아니다", () => {
    const err = Object.assign(new Error("boom"), { name: "ApiError", status: 500 });
    expect(isQuotaError(err)).toBe(false);
  });

  it("일반 Error는 쿼터 오류가 아니다", () => {
    expect(isQuotaError(new Error("설명 응답이 비었습니다."))).toBe(false);
  });

  it("Error가 아닌 값에도 터지지 않는다", () => {
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
    expect(isQuotaError("429")).toBe(false);
  });
});

describe("nextResetLabel", () => {
  // 무료 티어 RPD는 태평양시 자정에 리셋된다. 서머타임 때문에 한국시간 환산값이 한 시간 움직인다.
  it("서머타임(PDT) 기간이면 한국시간 오후 4시다", () => {
    expect(nextResetLabel(new Date("2026-08-17T05:00:00Z"))).toBe("한국시간 오후 4시");
  });

  it("표준시(PST) 기간이면 한국시간 오후 5시다", () => {
    expect(nextResetLabel(new Date("2026-01-15T05:00:00Z"))).toBe("한국시간 오후 5시");
  });

  it("태평양시 자정 직후면 다음 날 자정을 가리킨다", () => {
    // 2026-08-17T07:30Z = 태평양 00:30 PDT. 이미 지난 자정이 아니라 다음 자정을 잡아야 한다.
    expect(nextResetLabel(new Date("2026-08-17T07:30:00Z"))).toBe("한국시간 오후 4시");
  });
});

describe("QuotaExceededError", () => {
  it("사용자에게 그대로 나갈 안내 문구를 담는다", () => {
    // Act
    const err = new QuotaExceededError("한국시간 오후 4시");

    // Assert
    expect(err.name).toBe("QuotaExceededError");
    expect(err.message).toContain("오늘 무료 AI 사용량을 다 썼습니다");
    expect(err.message).toContain("한국시간 오후 4시");
  });

  it("내부 정보나 모델명을 노출하지 않는다", () => {
    const err = new QuotaExceededError("한국시간 오후 4시");
    expect(err.message).not.toContain("gemini");
    expect(err.message).not.toContain("quota");
  });
});
