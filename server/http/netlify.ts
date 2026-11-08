// Netlify Functions가 핸들러에 넘기는 이벤트 가운데 이 프로젝트가 실제로 읽는 필드만 적었다.
// @netlify/functions 타입 패키지를 넣지 않은 이유: 함수 네 개가 쓰는 필드가 이 셋뿐이라
// 의존성 하나를 더 얹을 만큼의 이득이 없다.
export type NetlifyEvent = {
  httpMethod: string;
  body: string | null;
  queryStringParameters: Record<string, string | undefined> | null;
};
