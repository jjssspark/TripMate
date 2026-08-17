import { describe, it, expect } from "vitest";
import { candidateCount, buildCandidatePrompt } from "../../server/itinerary/candidates";

describe("candidateCount", () => {
  it("필요량의 1.8배를 요청하고 44개로 자른다", () => {
    expect(candidateCount(3, "빡빡하게")).toBe(44); // 3*8*1.8 = 43.2 → 44, 상한 44
    expect(candidateCount(3, "여유롭게")).toBe(17); // 3*3*1.8 = 16.2 → 17
    expect(candidateCount(10, "빡빡하게")).toBe(44); // 상한
  });

  // 출력 토큰이 후보 추출 지연을 지배한다. 추출이 예산을 먹으면 설명이 통째로 강등되므로
  // 고를 여지를 남기는 선에서 가장 적게 요청한다.
  it("검증에서 절반이 떨어져도 강도 하한을 채울 만큼은 요청한다", () => {
    expect(candidateCount(2, "빡빡하게")).toBeGreaterThanOrEqual(2 * 4 * 2);
    expect(candidateCount(3, "여유롭게")).toBeGreaterThanOrEqual(3 * 1 * 2);
  });
});

describe("buildCandidatePrompt", () => {
  it("필수 방문지와 요청 개수를 프롬프트에 포함시킨다", () => {
    const prompt = buildCandidatePrompt({
      destination: "제주도", days: 3, intensity: "빡빡하게",
      styles: ["맛집", "자연"], mustVisitPlaces: "성산일출봉, 한라산", comments: "",
    });
    expect(prompt).toContain("성산일출봉, 한라산");
    expect(prompt).toContain("44곳의 이름과 분류만");
  });

  it("예산이 다르면 프롬프트가 달라진다", () => {
    const base = {
      destination: "제주도", days: 3, intensity: "여유롭게" as const,
      styles: [], mustVisitPlaces: "", comments: "",
    };
    const 절약 = buildCandidatePrompt({ ...base, budget: "절약형" });
    const 고급 = buildCandidatePrompt({ ...base, budget: "고급형" });
    expect(절약).not.toBe(고급);
    expect(절약).toContain("절약형");
    expect(고급).toContain("고급형");
  });

  it("동행자가 다르면 프롬프트가 달라진다", () => {
    const base = {
      destination: "제주도", days: 3, intensity: "여유롭게" as const,
      styles: [], mustVisitPlaces: "", comments: "",
    };
    const 가족 = buildCandidatePrompt({ ...base, companion: "가족" });
    const 혼자 = buildCandidatePrompt({ ...base, companion: "혼자" });
    expect(가족).not.toBe(혼자);
    expect(가족).toContain("가족");
    expect(혼자).toContain("혼자");
  });

  it("예산·동행자가 없으면 빈 줄이나 undefined를 남기지 않는다", () => {
    const prompt = buildCandidatePrompt({
      destination: "제주도", days: 3, intensity: "여유롭게",
      styles: [], mustVisitPlaces: "", comments: "",
    });
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toMatch(/^-\s*$/m);
    expect(prompt).not.toMatch(/\n\n\n/);
  });

  it("설명이 아니라 이름과 분류만 요구한다", () => {
    const input = {
      destination: "제주도", days: 2, intensity: "여유롭게" as const,
      styles: [], mustVisitPlaces: "", comments: "",
    };
    const prompt = buildCandidatePrompt(input);
    expect(prompt).toContain("이름과 분류만");
    expect(prompt).toContain("시간, 좌표, 부연을 붙이지 마세요");
  });
});
