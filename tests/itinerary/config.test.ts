import { describe, expect, it } from "vitest";
import { ConfigMissingError, requireApiKeys } from "../../server/itinerary/config";

const FULL = {
  GEMINI_API_KEY: "gemini-test-key",
  KAKAO_REST_API_KEY: "kakao-test-key",
};

describe("requireApiKeys", () => {
  it("두 키가 모두 있으면 그대로 돌려준다", () => {
    expect(requireApiKeys(FULL)).toEqual({
      geminiKey: "gemini-test-key",
      kakaoKey: "kakao-test-key",
    });
  });

  it("GEMINI_API_KEY가 없으면 VITE_ 접두사 값을 쓴다", () => {
    const keys = requireApiKeys({
      VITE_GEMINI_API_KEY: "vite-gemini-key",
      KAKAO_REST_API_KEY: "kakao-test-key",
    });

    expect(keys.geminiKey).toBe("vite-gemini-key");
  });

  it("KAKAO_REST_API_KEY가 없으면 ConfigMissingError를 던진다", () => {
    expect(() => requireApiKeys({ GEMINI_API_KEY: "gemini-test-key" })).toThrow(ConfigMissingError);
  });

  it("Gemini 키가 없으면 ConfigMissingError를 던진다", () => {
    expect(() => requireApiKeys({ KAKAO_REST_API_KEY: "kakao-test-key" })).toThrow(ConfigMissingError);
  });

  it("빈 문자열은 설정되지 않은 것으로 본다", () => {
    expect(() => requireApiKeys({ ...FULL, KAKAO_REST_API_KEY: "" })).toThrow(ConfigMissingError);
  });

  it("누락된 키 이름을 전부 모아서 담는다", () => {
    try {
      requireApiKeys({});
      expect.unreachable("던졌어야 한다");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigMissingError);
      expect((err as ConfigMissingError).missing).toEqual([
        "GEMINI_API_KEY",
        "KAKAO_REST_API_KEY",
      ]);
    }
  });

  // 이 메시지는 그대로 사용자에게 나간다. 어떤 키가 없는지 알려주면 구성 정보를 흘리는 셈이다.
  it("사용자 메시지에 키 이름을 노출하지 않는다", () => {
    try {
      requireApiKeys({});
      expect.unreachable("던졌어야 한다");
    } catch (err) {
      expect((err as Error).message).not.toMatch(/GEMINI|KAKAO|API_KEY/);
    }
  });

  // TS-031: 설정 누락이 "잠시 후 다시 시도"로 안내되어 4분간 재시도했다.
  // 재시도로 풀리지 않는 상황임을 메시지가 드러내야 한다.
  it("재시도를 권하지 않는 메시지를 쓴다", () => {
    try {
      requireApiKeys({});
      expect.unreachable("던졌어야 한다");
    } catch (err) {
      expect((err as Error).message).not.toMatch(/잠시 후|다시 시도/);
    }
  });
});
