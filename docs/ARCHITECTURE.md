# 아키텍처

TripMate의 구조와 설계 판단 근거를 정리한 문서입니다. 기능 소개는 [README](../README.md), 디자인 토큰은 [DESIGN.md](DESIGN.md)를 참고하세요.

## 전체 구성

```
브라우저 (React SPA)
   │
   │  fetch /api/*
   ▼
┌─────────────────────────┬─────────────────────────┐
│  로컬 개발               │  운영 (Netlify)          │
│  server/server.ts       │  netlify/functions/*     │
│  Express + Vite 미들웨어 │  서버리스 함수           │
└─────────────────────────┴─────────────────────────┘
   │                          │
   ├──────────┬───────────────┘
   ▼          ▼
Gemini API   Google Places API

Supabase (Auth + PostgreSQL) ◄── 브라우저에서 직접 호출
```

핵심은 **API 키가 브라우저에 절대 내려가지 않는다**는 점입니다. Gemini와 Places 호출은 전부 서버 계층을 거치고, 브라우저는 `/api/*`만 압니다.

## 이중 서버 계층

같은 API를 두 벌 유지하는 구조입니다.

| | 로컬 개발 | 운영 |
|---|---|---|
| 구현 | `server/server.ts` (Express) | `netlify/functions/*.ts` |
| 실행 | `npm run dev` | Netlify가 자동 배포 |
| 라우팅 | Express 라우터가 직접 처리 | `netlify.toml`의 `/api/* → /.netlify/functions/:splat` |
| 정적 파일 | Vite dev 미들웨어 (HMR) | `dist/` 프리빌드 |

**왜 이렇게 했는가**: Netlify Functions는 로컬에서 HMR과 함께 돌리기 번거롭습니다. 개발 중에는 Express 한 프로세스로 프론트와 API를 동시에 띄우는 편이 반복 속도가 빠릅니다.

**대가**: 프롬프트와 Gemini 응답 스키마 로직이 양쪽에 중복됩니다. 실제로 이 중복 때문에 "Gemini thinking 모드 비활성화" 수정을 두 번에 나눠 커밋해야 했습니다(`3ea5322` → `efe3255`). 공통 로직을 `shared/`로 추출하는 것이 다음 개선 과제입니다.

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| `POST` | `/api/generate-plan` | 여행 조건 → Gemini로 Day별 일정 생성 |
| `POST` | `/api/revise-plan` | 기존 일정 + 자연어 피드백 → 일정 재생성 |
| `GET` | `/api/geocode` | 장소명 → 좌표 (지도 마커용) |
| `GET` | `/api/place-photo` | Places photo reference → 이미지 프록시 |
| `GET`·`POST`·`PUT`·`DELETE` | `/api/plans[/:id]` | 로컬 개발 전용 파일 DB CRUD |

`/api/plans`는 `server/server.ts`에만 있습니다. 운영에서는 브라우저가 Supabase 클라이언트로 직접 CRUD 합니다.

## 데이터 저장

`src/lib/supabaseClient.ts`가 두 가지 모드를 지원합니다.

1. **Supabase 모드** — `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 있으면 자동 활성화
2. **로컬 모드** — 키가 없으면 브라우저 localStorage로 폴백

설정값은 localStorage(`tripmate_supabase_url` 등)가 환경변수보다 우선합니다. 배포된 데모에서 사용자가 자기 Supabase 프로젝트를 연결해 볼 수 있게 하려는 의도입니다.

`travel_plans` 테이블 스키마는 [README의 데이터베이스 스키마](../README.md) 절에 있습니다.

## 프론트엔드

- **라우팅 없음**: `react-router` 대신 `App.tsx`의 `navStack: string[]` 상태로 화면을 전환합니다. 화면이 6개뿐이고 대부분 모바일 스택 내비게이션(뒤로가기) 패턴이라 라이브러리를 넣을 근거가 약했습니다.
- **예외**: 공유 링크 `/trip/:id`는 실제 URL이 필요하므로 `netlify.toml`에서 `index.html`로 rewrite한 뒤 앱이 `pathname`을 읽어 처리합니다.
- **스타일**: Tailwind CSS 4 (`@tailwindcss/vite` 플러그인). 별도 PostCSS 설정 없음.
- **PWA**: `vite-plugin-pwa` `generateSW` 모드. `/api/*`와 `/trip/*`는 앱 셸 폴백에서 제외해야 해서 `navigateFallbackDenylist`로 막아뒀습니다.

## 진입점이 두 개인 이유

`vite.config.ts`의 `rollupOptions.input`이 두 개의 HTML을 빌드합니다.

- `landing.html` → 마케팅 랜딩 페이지. `/`로 서빙
- `index.html` → React 앱 본체. `/trip/*` 및 앱 진입

랜딩은 React를 로드하지 않는 순수 HTML/CSS라 초기 로딩이 빠릅니다.

## 알려진 개선 과제

1. **번들 크기** — `app` 청크가 gzip 164KB입니다. Leaflet과 motion을 동적 import로 분리할 여지가 있습니다.
2. **서버 로직 중복** — 위 "이중 서버 계층" 참고.
3. **테스트 커버리지 협소** — `tests/lib/`에 목적지 검색·초성 변환(`destinations.ts`)과 추천 스팟 조회(`recommendedSpots.ts`) 단위 테스트 11개가 있습니다(`npm test`). 일정 생성 응답 파싱, `planDisplay.ts`, API 라우트 핸들러는 아직 대상 밖입니다.
4. **파일 크기** — `server/server.ts` 845줄, `PlanResultView.tsx` 834줄로 코딩 규약의 800줄 상한을 넘습니다.
5. **`any` 타입 57곳** — Gemini 응답과 Supabase 반환값의 타입 경계에 몰려 있습니다. 응답 스키마 타입을 정의하면 대부분 제거됩니다.
   그때까지 `eslint.config.js`에서 `@typescript-eslint/no-explicit-any`를 `warn`으로 두고 lint 출력에 계속 노출시켜 추적합니다.
   숫자가 0이 되면 규칙을 `error`로 되돌립니다.
