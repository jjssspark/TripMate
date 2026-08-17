/**
 * 필수 API 키가 배포 환경에 없을 때. 일시적 장애가 아니라 설정 문제라 재시도로 풀리지 않는다.
 * message는 그대로 사용자에게 나가므로 어떤 키가 비었는지는 넣지 않고 missing에만 담는다.
 */
export class ConfigMissingError extends Error {
  constructor(readonly missing: string[]) {
    super("서비스가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.");
    this.name = "ConfigMissingError";
  }
}

type Env = Record<string, string | undefined>;

/**
 * VITE_GEMINI_API_KEY는 배포 플랫폼에 이미 그 이름으로 등록해 둔 경우를 위한 호환 경로다.
 * 서버에서만 참조하므로 클라이언트 번들에는 들어가지 않는다.
 */
export function requireApiKeys(env: Env = process.env): { geminiKey: string; kakaoKey: string } {
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
  const kakaoKey = env.KAKAO_REST_API_KEY;

  const missing: string[] = [];
  if (!geminiKey) missing.push("GEMINI_API_KEY");
  if (!kakaoKey) missing.push("KAKAO_REST_API_KEY");
  if (missing.length > 0) throw new ConfigMissingError(missing);

  return { geminiKey: geminiKey as string, kakaoKey: kakaoKey as string };
}
