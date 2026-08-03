# 데이터베이스 스키마

Supabase(PostgreSQL) 스키마입니다. Supabase 대시보드에서 만들어져 있고 저장소에 마이그레이션 파일(`.sql`)이 없어서, 이 문서는 실제 쿼리 코드(`src/lib/supabaseClient.ts`, `src/App.tsx`, `src/components/LoginSignup.tsx`)에서 사용하는 컬럼을 역으로 추적해 작성했습니다. 원본 DDL이 아니라 코드가 실제로 읽고 쓰는 값 기준의 재구성이라는 점을 감안해 주세요.

README에 있던 기존 "데이터베이스 스키마" 절은 `travel_plans` 하나에 `plan_content jsonb` 컬럼으로 일정 전체를 넣는 구조로 설명돼 있는데, 실제 코드는 그렇지 않습니다. 일정 본문은 `travel_items`라는 별도 테이블에 행 단위로 정규화돼 있습니다. 아래 내용이 실제 동작하는 스키마입니다.

## 테이블 관계

```
auth.users (Supabase Auth 내장)
   │ id
   ├──< profiles.id           (1:1, 회원가입 시 upsert)
   └──< users.user_id         (1:1, 회원가입 시 upsert)
            │ user_seq
            └──< travel_plans.user_seq   (1:N)
                     │ id
                     └──< travel_items.plan_id   (1:N)
```

## `users`

앱이 실제로 쓰는 사용자 프로필 테이블입니다. `auth.users`(Supabase Auth 내장 테이블)와 별개이며, 로그인 후 앱 내부에서 쓰는 `user_seq`(정수)를 여기서 발급합니다.

| 컬럼 | 타입(추정) | 설명 | 근거 |
|---|---|---|---|
| `user_seq` | `int` (또는 `serial`) | 앱 내부 사용자 식별자. `travel_plans.user_seq`가 이 값을 참조 | `buildUserSession`, `newUserRow.user_seq` |
| `user_id` | `uuid` | `auth.users.id`와 매칭되는 외부 키 역할. `onConflict: "user_id"`로 upsert | `LoginSignup.tsx:147`, `supabaseClient.ts:100` |
| `login_email` | `text` | 로그인 이메일 | `LoginSignup.tsx:148` |
| `name` | `text` | 표시 이름. 없으면 이메일 앞부분으로 대체(`authUser.email?.split("@")[0]`) | `supabaseClient.ts:86` |
| `last_login_time` | `timestamptz` | 마지막 로그인 시각 | `LoginSignup.tsx:150` |

회원가입 도중 이 행 생성이 실패한 계정을 위해, 로그인 시점에도 이 테이블에 행이 없으면 즉시 생성하는 폴백 로직이 있습니다(`buildUserSession`, `supabaseClient.ts:91-119`). `travel_plans`의 RLS INSERT 정책이 "user_seq가 이 auth.uid()의 users 행에 속하는지"를 검사하므로, 이 행이 없으면 이후 모든 저장이 막힙니다.

## `profiles`

회원가입 시 `users`와 별도로 upsert되는 또 다른 프로필 테이블입니다. `LoginSignup.tsx` 외 다른 곳에서 조회하는 코드는 확인되지 않았습니다 — 왜 `users`와 이중으로 존재하는지 코드만으로는 알 수 없고, 초기 스캐폴딩에서 남은 테이블일 가능성이 있습니다.

| 컬럼 | 타입(추정) | 설명 | 근거 |
|---|---|---|---|
| `id` | `uuid` | `auth.users.id`와 동일 값 | `LoginSignup.tsx:133` |
| `full_name` | `text` | 표시 이름 | `LoginSignup.tsx:134` |
| `eamil` | `text` | 이메일 — 컬럼명 자체가 오타(`email`이 아니라 `eamil`) | `LoginSignup.tsx:135` 주석: "eamil 칼럼 오타 준수" |
| `avatar_url` | `text` | 기본 아바타 이미지 URL(고정값) | `LoginSignup.tsx:136` |

`eamil` 오타는 코드 주석에도 "오타 준수"라고 명시돼 있습니다 — 실제 Supabase 테이블의 컬럼명이 이미 오타로 만들어져 있어서, 코드가 그 오타에 맞춰 작성된 상태입니다. 정정하려면 코드가 아니라 DB 컬럼명부터 바꿔야 합니다.

## `travel_plans`

일정의 메타데이터만 담습니다. Day별 활동은 여기 없고 `travel_items`에 있습니다.

| 컬럼 | 타입(추정) | 설명 | 근거 |
|---|---|---|---|
| `id` | `uuid` | PK. insert 시 서버가 자동 생성 | `App.tsx:190-194` (`.insert(payload).select().single()`) |
| `user_seq` | `int` | `users.user_seq` 참조. 조회 필터(`eq("user_seq", ...)`)와 RLS 소유권 검사에 사용 | `App.tsx:104`, `supabaseClient.ts:279` |
| `title` | `text` | 일정 제목 | `mapToSupabase` |
| `destination` | `text` | 목적지 | `mapToSupabase` |
| `start_date` | `date` | 시작일 | `mapToSupabase` |
| `end_date` | `date` | 종료일 | `mapToSupabase` |
| `budget` | `text` | 예산 수준("절약형"/"표준형"/"고급형") | `mapToSupabase` |
| `companion` | `text` | 동행 유형 | `mapToSupabase` |
| `styles` | `text[]` | 선호 스타일 키워드 배열 | `mapToSupabase` |
| `must_visit_places` | `text[]` | 필수 방문 장소. 콤마로 구분된 문자열을 배열로 쪼개 저장 | `mapToSupabase`: `mustVisitPlaces.split(",").map(...)` |
| `is_shared` | `boolean` | 공유 링크(`/trip/:id`) 공개 여부. 기본 `false` | `mapToSupabase`, `setPlanShared` |
| `additional_requests` | `text` | 1일차 첫 활동의 description을 그대로 저장(대략적 개요용) | `mapToSupabase` 주석: "대략적 개요 바인딩" |
| `created_at` | `timestamptz` | 생성 시각. 목록 정렬에 사용(`order("created_at")`) | `App.tsx:105` |

README에 있던 `plan_content jsonb`, `duration text` 컬럼은 실제 insert/select 코드 어디에도 나타나지 않습니다 — README 쪽 문서가 낡은 것으로 보입니다.

## `travel_items`

Day별 활동(장소) 하나당 한 행입니다. `travel_plans`와 부모-자식 관계이며, 수정 시 delete-and-reinsert 전략을 씁니다(`App.tsx:294-317`).

| 컬럼 | 타입(추정) | 설명 | 근거 |
|---|---|---|---|
| `id` | `int` 또는 `uuid` | PK. `mapFromSupabase`가 `item.id.toString()`으로 문자열 변환해 사용 | `supabaseClient.ts:216` |
| `plan_id` | `uuid` | `travel_plans.id` 참조. 삭제 시 이 값으로 필터링 | `mapToSupabaseItem`, `App.tsx:298` |
| `day_number` | `int` | 몇 일차인지 | `mapToSupabaseItem` |
| `visit_time` | `time` | "09:30:00" 형태. 화면 표시용 "오전 09:30"과 상호 변환됨 | `mapFromSupabase`/`mapToSupabaseItem`의 시간 변환 로직 |
| `place_name` | `text` | 장소명(실제 상호명) | `mapToSupabaseItem` |
| `description` | `text[]` | 컬럼명과 달리 설명 문장이 아니라 해시태그 배열(tags)을 저장. 화면 설명 문구는 프론트에서 별도로 생성 | `mapToSupabaseItem` 주석: "AI가 도출한 태그(tags) 배열을 직접 주입" |
| `category` | `text` | "관광"/"맛집"/"카페"/"쇼핑"/"숙소"/"이동" | `mapToSupabaseItem` |
| `sequence` | `int` | 같은 day 안에서의 순서. 정렬 기준 | `mapToSupabaseItem`, `mapFromSupabase`의 정렬 로직 |
| `is_must_visit` | `boolean` | 필수 방문 여부 | `mapToSupabaseItem` |
| `image_url` | `text` | 생성 당시 저장해둔 실제 장소 사진 URL. 없으면 재조회 시 목업 이미지로 대체 | `mapFromSupabase` 주석 |

`description` 컬럼이 이름과 다른 값(태그 배열)을 담는 것은 의도적 재사용으로 보이며, 컬럼명만 보고 오해하기 쉬운 지점이라 명시해 둡니다.

## 접근 제어(RLS)

Supabase 대시보드에만 정책 원문이 있고 저장소에는 마이그레이션이 없어서, 코드 주석과 동작으로 유추한 내용입니다. 실제 정책 SQL과 다를 수 있습니다.

- `travel_plans`/`travel_items`의 INSERT/UPDATE/DELETE는 `auth.uid()`가 소유한 `users` 행의 `user_seq`와 일치하는 행에만 허용되는 것으로 보입니다(`supabaseClient.ts:91-94` 주석).
- `travel_plans`의 SELECT는 로그인 사용자 본인 소유 행 전체, 그리고 `is_shared = true`인 행은 비로그인(anon) 사용자도 조회 가능한 것으로 보입니다(`fetchPublicPlan`, `/trip/:id` 공유 링크 경로).
- `travel_items`는 `travel_plans`와의 조인(`select("*, travel_items(*)")`)으로만 접근되며, 단독 SELECT 정책이 있는지는 코드로 확인되지 않습니다.

이 정책들을 정확히 검증하려면 Supabase 대시보드의 Authentication > Policies에서 원문을 확인해 이 문서에 반영해야 합니다. 지금은 애플리케이션 동작으로 역추정한 상태임을 밝혀둡니다.

## 알려진 이상 지점

- `users`와 `profiles`가 같은 정보(이름, 이메일)를 이중으로 저장합니다. 회원가입 시 두 테이블에 각각 upsert하는데, 실제로 `profiles`를 읽는 코드는 발견되지 않았습니다 — 죽은 테이블일 가능성이 있고, 확인 후 정리 후보입니다.
- `profiles.eamil` 컬럼명 오타는 DB에 이미 그렇게 만들어져 있어 코드가 맞춰 쓰고 있습니다. 고치려면 컬럼 rename 마이그레이션이 필요합니다.
- `travel_items.description`이 실제로는 태그 배열이라는 점은 컬럼명만으로는 알 수 없습니다.
