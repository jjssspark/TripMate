# API

TripMate가 실제로 노출하는 엔드포인트의 요청/응답 계약입니다. 아키텍처 개요는 [ARCHITECTURE.md](ARCHITECTURE.md), 기능 소개는 [README](../README.md)를 참고하세요.

> **범위**: 아래 4개(`generate-plan`, `revise-plan`, `geocode`, `place-photo`)는 로컬 개발(Express)과 운영(Netlify Functions) 양쪽에 존재하는 실제 프로덕션 API입니다. `/api/plans*` 4종은 **로컬 개발 전용**이며 운영 배포에는 없습니다 — 운영에서는 브라우저가 Supabase 클라이언트로 직접 CRUD 합니다([ARCHITECTURE.md](ARCHITECTURE.md#이중-서버-계층) 참고). 두 환경의 API 표면이 다르다는 점을 명시적으로 남깁니다.

## 이 문서를 왜 표준 봉투 형식과 다르게 썼는가

`~/.claude/standards/api-contract.md`는 `{ success, data, error }` 봉투와 SCREAMING_SNAKE_CASE 에러 코드를 요구합니다. 이 프로젝트의 실제 API는 그 규약을 따르지 않습니다 — 엔드포인트마다 응답 모양이 다르고, AI 생성 실패도 HTTP 200으로 돌려줍니다. 이 문서는 **있어야 할 모습이 아니라 실제로 동작하는 모습**을 정확히 기록하는 것을 목적으로 하므로, 실제 응답을 그대로 적고 표준과의 차이는 "알려진 편차" 절에 모았습니다.

---

## `POST /api/generate-plan`

여행 조건을 받아 Gemini로 Day별 일정을 생성합니다. 인증 불필요(로그인 여부와 무관하게 호출 가능).

**Request Body**

```ts
{
  destination: string;        // 필수. 없으면 400
  startDate?: string;         // "YYYY-MM-DD"
  endDate?: string;
  companion?: string;         // 예: "혼자", "연인", "가족"
  budget?: string;            // "절약형" | "표준형" | "고급형"
  intensity?: string;         // "여유롭게" | "빡빡하게" — 하루 스팟 수(1~3 vs 4~8)를 결정
  transportMode?: string;     // "도보" | "대중교통" | "자차" — 동선 반경 제약에 반영
  styles?: string[];          // 예: ["맛집", "자연"]
  mustVisitPlaces?: string;   // 1일차 첫 활동에 강제 배치
  comments?: string;          // 자유 텍스트 추가 요청
}
```

**Response 200 (성공 — AI 생성)**

```ts
{
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: string;           // "2박 3일" 형태로 서버가 계산
  budget: string;
  companion: string;
  intensity: string;
  transportMode: string;
  styles: string[];
  mustVisitPlaces: string;
  planContent: Array<{
    day: number;
    theme: string;
    description: string;
    activities: Array<{
      time: string;           // "오전 09:30"
      title: string;          // 실제 상호명 (프롬프트가 일반명사 사용을 명시적으로 금지)
      description: string;
      location: string;
      category: string;       // "관광" | "맛집" | "카페" | "쇼핑" | "숙소" | "이동"
      isMeal: boolean;
      mealType?: string;      // "아침" | "점심" | "저녁"
      mustVisit?: boolean;
      latitude: number;
      longitude: number;
      tags?: string[];
      imageUrl: string;       // Places 실사진 프록시 URL 또는 카테고리별 목업 이미지
    }>;
  }>;
  // isFallback 필드가 없음 = AI가 실제로 생성한 정상 응답
}
```

**Response 200 (성공 — 폴백, AI 실패 시)**

요청이 실패해도 **HTTP 상태 코드는 200을 유지**합니다. 대신 위와 같은 모양에 `isFallback: true` 필드가 추가되고, 장소명은 `src/lib/recommendedSpots.ts`의 정적 데이터에서 채워집니다.

```ts
{
  // ...위와 동일한 필드
  isFallback: true;
}
```

폴백이 발동하는 경우: ① `GEMINI_API_KEY`/`VITE_GEMINI_API_KEY` 미설정 ② 27초 예산 안에 주 모델·보조 모델·주 모델 재시도가 모두 실패 ③ Gemini 응답 JSON 파싱 실패.

**Response 400**

```ts
{ error: "Destination is required" }   // destination 누락
{ error: "Invalid JSON body" }         // 요청 바디가 JSON이 아님
```

**Response 405**

```ts
{ error: "Method Not Allowed" }   // GET 등 POST 이외 메서드
```

**타임아웃 예산**: 서버 내부적으로 27초(`GENERATION_BUDGET_MS`) 안에서만 재시도하고 넘기면 폴백을 반환합니다. 클라이언트는 30초에 요청 자체를 끊습니다.

---

## `POST /api/revise-plan`

기존 일정(`planContent`)과 자연어 피드백을 받아 Gemini로 재생성합니다. 인증 불필요.

**Request Body**

```ts
{
  destination: string;    // 필수
  planContent: Array<...>; // 필수. generate-plan 응답의 planContent와 동일 구조
  feedback: string;        // 필수. 예: "맛집 위주로 바꿔줘"
  budget?: string;
  companion?: string;
}
```

**Response 200 (성공)**

```ts
{ success: true; planContent: Array<...> }  // generate-plan과 동일한 day 배열 구조
```

**Response 200 (실패 — 이 엔드포인트도 실패 시 상태 코드는 200)**

```ts
{ success: false; message: "AI가 피드백을 반영하는 데 실패했습니다. 잠시 후 다시 시도해 주세요." }
{ success: false; message: "AI 서버가 설정되지 않아 피드백을 반영할 수 없습니다." }  // API 키 미설정
```

**Response 400**

```ts
{ success: false; message: "destination, planContent, feedback가 모두 필요합니다." }
{ success: false; message: "Invalid JSON body" }
```

**Response 405**

```ts
{ success: false; message: "Method Not Allowed" }
```

> **주의**: `generate-plan`은 실패 응답에 `error` 필드를, `revise-plan`은 실패 응답에 `success`/`message` 필드를 씁니다. 같은 프로젝트 안에서도 엔드포인트마다 에러 모양이 다릅니다 — "알려진 편차" 절 참고.

---

## `GET /api/geocode`

장소명을 좌표로 변환합니다(지도 마커용). **Google이 아니라 OpenStreetMap Nominatim**을 호출합니다 — 이름과 실제 구현이 다른 지점이라 명시합니다.

**Query Parameters**

| 이름 | 필수 | 설명 |
|---|---|---|
| `query` | O | 검색할 장소명 |
| `city` | X | 목적지 도시명. `query`에 이미 포함돼 있지 않으면 앞에 붙여 검색 정확도를 높임 |

**Response 200**

```ts
{ lat: number; lon: number }
```

서버 메모리 캐시(`도시_쿼리` 키)에 적중하면 Nominatim 호출 없이 즉시 반환합니다. 캐시는 프로세스 재시작 시 초기화됩니다(영구 저장 아님).

**Response 400**

```ts
{ error: "query parameter is required" }
```

**Response 404**

```ts
{ error: "No location found" }   // Nominatim 검색 결과 0건
```

**Response 500**

```ts
{ error: string }   // Nominatim 요청 자체가 실패(네트워크 오류 등)
```

---

## `GET /api/place-photo`

Google Places Photo API를 대신 호출해 실제 이미지 바이너리를 프록시합니다. **API 키를 클라이언트에 노출하지 않기 위한 유일한 목적**의 엔드포인트입니다. 프론트는 이 URL을 `<img src>`에 그대로 씁니다.

**Query Parameters**

| 이름 | 필수 | 설명 |
|---|---|---|
| `ref` | O | Google Places `photo_reference` (generate-plan/revise-plan 응답의 `imageUrl`에 이미 이 형태로 내려옴) |
| `maxwidth` | X | 기본값 `400` |

**Response 200**

이미지 바이너리(`isBase64Encoded: true`, `Content-Type`은 Google 응답을 그대로 전달). JSON이 아닙니다 — 이 엔드포인트만 유일하게 이미지를 직접 반환합니다.

`Cache-Control: public, max-age=86400` — 24시간 캐시.

**Response 400 / 502 / 503** (본문이 JSON이 아니라 순수 텍스트)

```
400  "ref query parameter is required"
503  "Google Places API key is not configured"
502  "Failed to fetch photo"
```

---

## `/api/plans*` — 로컬 개발 전용 (운영에는 없음)

파일 기반 로컬 DB(`data/`)를 사용하는 CRUD로, `server/server.ts`에만 존재합니다. Supabase 없이 로컬에서 빠르게 개발/테스트하기 위한 경로이며, **배포된 앱에서는 이 라우트 자체가 없고** 브라우저가 Supabase를 직접 호출합니다.

| 메서드 | 경로 | Request | Response 200 | Response 오류 |
|---|---|---|---|---|
| `GET` | `/api/plans?userId=<id>` | — | `TravelPlan[]` (해당 userId 소유분만) | `400 { error: "userId query parameter is required" }` |
| `POST` | `/api/plans` | `TravelPlan` (userId/title/destination 필수) | `201 TravelPlan` (id·createdAt·updatedAt 서버가 채움) | `400 { error: "Missing required plan fields (userId, title, destination)" }` |
| `PUT` | `/api/plans/:id` | `Partial<TravelPlan>` | `TravelPlan` (updatedAt 갱신) | `404 { error: "Plan not found" }` |
| `DELETE` | `/api/plans/:id` | — | `{ success: true, message: "Travel plan deleted successfully" }` | `404 { error: "Plan not found" }` |

---

## 알려진 편차 (표준 대비)

프로젝트 표준(`.claude/standards/api-contract.md`)은 모든 응답이 `{ success, data, error }` 봉투를 쓰고 에러 코드가 `AUTH_TOKEN_EXPIRED` 같은 SCREAMING_SNAKE_CASE이길 요구합니다. 실제 코드는 다음과 같이 벗어나 있습니다.

| 편차 | 실제 동작 | 표준이 요구하는 것 |
|---|---|---|
| AI 생성 실패도 HTTP 200 | `isFallback`/`success` 필드로 성공 여부를 판단 | 5xx로 실패를 표현 |
| 에러 응답 모양이 엔드포인트마다 다름 | `{error}` / `{success,message}` / 순수 텍스트 세 가지 혼재 | 통일된 `error` 객체 |
| 에러 코드 없음 | 사람이 읽는 한글 메시지만 존재 | `USER_EMAIL_INVALID` 같은 코드 |
| `place-photo`는 JSON이 아님 | 이미지 바이너리 직접 반환 | — (이 경우는 의도된 예외로 봄) |

**AI 실패 시에도 200을 쓰는 이유**는 의도적입니다 — 사용자에게 빈 화면 대신 "지금은 임시 일정을 보여준다"는 걸 화면에서 알려주는 쪽을 택했고(`isFallback` 플래그), HTTP 상태 코드보다 그 판단을 프론트가 명시적으로 하게 만들고 싶었습니다. 나머지(에러 모양 불일치, 에러 코드 부재)는 의도된 설계가 아니라 **정리되지 않은 부분**이며, `tests/` 신설과 함께 다음에 손볼 후보로 남겨둡니다.
