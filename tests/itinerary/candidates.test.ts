import { describe, it, expect } from "vitest";
import { candidateCount, buildCandidatePrompt } from "../../server/itinerary/candidates";

describe("candidateCount", () => {
  it("필요량의 2.5배를 요청하고 60개로 자른다", () => {
    expect(candidateCount(3, "빡빡하게")).toBe(60); // 3*8*2.5 = 60
    expect(candidateCount(3, "여유롭게")).toBe(23); // 3*3*2.5 = 22.5 → 23
    expect(candidateCount(10, "빡빡하게")).toBe(60); // 상한
  });
});

describe("buildCandidatePrompt", () => {
  it("필수 방문지와 요청 개수를 프롬프트에 포함시킨다", () => {
    const prompt = buildCandidatePrompt({
      destination: "제주도", days: 3, intensity: "빡빡하게",
      styles: ["맛집", "자연"], mustVisitPlaces: "성산일출봉, 한라산", comments: "",
    });
    expect(prompt).toContain("성산일출봉, 한라산");
    expect(prompt).toContain("60곳의 이름과 분류만");
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
