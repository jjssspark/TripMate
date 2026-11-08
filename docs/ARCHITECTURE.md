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

**대가와 그 이후**: 초기에는 프롬프트와 Gemini 응답 스키마 로직이 양쪽에 중복돼 있었습니다. 그 대가로 "Gemini thinking 모드 비활성화" 수정을 두 번에 나눠 커밋해야 했고(`3ea5322` → `efe3255`), 로컬에만 `transportMode`가 반영되지 않아 이동수단 선택이 조용히 무시되던 것도 그때 발견했습니다.

파이프라인을 교체하면서(`eabb669`) 공통 로직을 `server/itinerary/`로 추출했습니다. 지금은 양쪽 모두 `parsePlanInput` → `runPipeline`만 호출하는 얇은 어댑터입니다. `netlify/functions/generate-plan.ts`는 69줄이고, `transportMode` 같은 입력 정규화는 `server/itinerary/entry.ts` 한 곳에서만 일어납니다.

남은 차이는 HTTP 계층뿐입니다. Express는 `req`/`res`를, Netlify는 `Request`/`Response`를 씁니다.

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

`travel_plans` 테이블 스키마는 [DATABASE.md](DATABASE.md)에 있습니다.

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

> 수치 기준일: 2026-11-08

1. **번들 크기** — `app` 청크가 gzip 224.7KB입니다(2026-08-17 209KB, 2026-08-01 164KB). 기능 추가 없이 의존성 업데이트만으로도 15KB가 늘었습니다. Leaflet과 motion을 동적 import로 분리하는 작업이 아직 안 됐습니다. 예산(300KB) 안이긴 합니다.
2. **CI 부재** — lint·typecheck·test를 돌리는 GitHub Actions가 없습니다. lint 설정이 깨진 채 두 달 넘게 방치된 것(TS-035)도 이 때문입니다.
3. **장소 사진이 목업** — 배포 서버에 Google Places 키가 없어 카테고리별 스톡 사진이 반복됩니다. Maps Platform 결제 계정을 열지 않는 한 그대로입니다(ADR-3).
4. **테스트 범위** — `npm test` 기준 18개 파일 252개 테스트가 통과합니다. 파이프라인 전 단계(후보 추출·존재 검증·날짜 배정·순서 결정·시각 배치·설명·쿼터·의도 분류)와 목적지 검색이 대상입니다. 아직 대상 밖인 것은 React 컴포넌트와 E2E 플로우입니다.
5. **후보 추출 지연 변동** — 실측 2.7~11.4초로 흔들립니다. 튀는 날은 25초 예산을 먹어 설명이 강등됩니다. 요청 후보 수를 줄여(60 → 44) 꼬리를 줄였지만 변동 자체는 남습니다. 근본 해결은 예산 재분배가 아니라 비동기 구조입니다.

## 제약 — 영업 상태를 알 수 없다

휴업·폐업 중인 장소가 추천에 섞일 수 있습니다. 고칠 수 있는데 안 한 것이 아니라, 현재 데이터 원천으로는 불가능합니다.

장소 실재 검증에 쓰는 카카오 Local API의 응답 필드는 이것이 전부입니다([공식 문서](https://developers.kakao.com/docs/ko/local/dev-guide)).

```
place_name, distance, place_url, category_name, address_name,
road_address_name, id, phone, category_group_code,
category_group_name, x, y
```

영업 상태 필드가 없습니다. 폐업은 카카오가 시간이 지나면 색인에서 지우지만 휴업은 표시 자체가 없습니다.

검토한 대안과 기각 사유:

| 방법 | 기각 사유 |
|---|---|
| Google Places `business_status` | 정확히 이 문제를 푸는 필드지만 Maps Platform 결제 계정 등록이 필요합니다. 무료 범위 안에서 운영한다는 방침과 충돌합니다 |
| 후보 추출 프롬프트에 "휴업한 곳 제외" 추가 | 검증할 수 없습니다. 프롬프트로 부탁하고 확인하지 않는 방식을 못 믿어서 카카오 대조를 도입했는데, 같은 자리에 같은 방식을 다시 넣는 셈입니다 |
| `place_url` 페이지를 조회해 상태 확인 | 장소당 1회씩 40여 회 추가 요청이 붙습니다. 25초 예산에 들어가지 않습니다 |

지금 제공하는 우회는 사용자가 직접 빼는 경로입니다. "○○ 빼줘"라고 하면 그 장소를 제외하고 다시 짭니다(`server/itinerary/intent.ts`의 `excludePlaces`). 자동 판별이 아니라 사람이 알아채고 빼는 방식입니다.

결제 계정을 열 수 있게 되면 Google Places `business_status`로 후보 검증 단계에서 한 번 더 거르는 것이 정공법입니다.

### 해소된 항목

- **서버 로직 중복** — `server/itinerary/`로 추출 완료. 위 "이중 서버 계층" 참고.
- **`server/server.ts` 800줄 초과** — 433줄로 축소.
- **`PlanResultView.tsx` 920줄, `PlannerFlow.tsx` 812줄** (2026-11-08) — 지도·수정 패널을 `components/plan-result/`로, 3단계 폼을 `components/planner/`로 떼어 각각 564줄·377줄.
- **`any` 타입 37곳** (2026-11-08) — Netlify 이벤트(`server/http/netlify.ts`)와 Supabase 행(`TravelPlanRow`/`TravelItemRow`) 타입을 정의해 0곳. `no-explicit-any`를 `error`로 올렸다.
- **지도 타일** (2026-11-08) — CARTO가 키를 요구해 OpenStreetMap 공식 타일로 교체(ADR-10, TS-034).
