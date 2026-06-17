# ✈️ TripMate AI - AI 여행 플래너

AI 기술을 활용하여 사용자의 취향과 일정에 맞는 최적의 여행 계획을 설계해주는 **AI 여행 플래너, TripMate AI** 프로젝트입니다.

---

## 🌟 프로젝트 개요

> **"당신의 여행 취향과 조건만 입력하세요. AI가 최적의 동선과 일정을 설계해 드립니다."**
>
> TripMate AI는 로그인 후 간단한 여행지, 일정, 예산, 동행 유형, 그리고 선호하는 스타일(맛집, 쇼핑, 자연 등)을 입력하면 AI가 동선과 식사 시간대를 고려한 완성도 높은 여행 일정을 생성하고, 이를 저장 및 관리할 수 있도록 돕는 서비스입니다.

---

## 🚀 핵심 기능 (MVP 및 선택 기능)

### 1. 회원 관리 및 보안
*   **로그인 / 회원가입 (MVP):** Supabase Auth를 활용한 이메일/비밀번호 기반의 회원 가입 및 로그인.
*   **비인가 접근 제어 (비기능):** 로그인하지 않은 비인증 사용자는 개인 여행 일정 페이지 및 저장 기능 접근 불가.

### 2. AI 여행 일정 생성
*   **여행 조건 입력 (MVP):** 여행지, 일정(날짜), 예산, 동행 유형 지정.
*   **선호 스타일 선택 (MVP):** 맛집, 카페, 쇼핑, 자연, 역사/문화, 사진 스팟, 여유로운 일정 등 개인 취향 반영.
*   **AI 일정 추천 (MVP):**
    *   입력 조건을 바탕으로 Day별/시간대별 최적 일정 수립.
    *   선택한 스타일(맛집/카페)을 고려하여 점심/저녁 시간대에 식사 관련 장소 스마트 배치.
    *   반드시 방문해야 할 필수 장소(Must-Visit) 반영.
    *   장소별 시간, 장소명, 카테고리, 그리고 간단한 설명(팁) 제공.

### 3. 일정 탐색 및 연동
*   **Google Maps 연동 (MVP):** 생성된 일정 카드 내 장소를 클릭하면 구글 맵스(Google Maps) 검색 페이지로 바로 이동하여 위치 및 상세 정보 확인 가능.
*   **자연어 피드백 기반 일정 수정 (선택):** "맛집 위주로 변경해줘" 등 AI에게 추가적인 요구사항을 전달하여 일정 변경 가능.
*   **일정 수동 편집 (선택):** 사용자가 직접 방문 시간, 장소명, 메모 등을 커스텀 수정.

### 4. 일정 보관 및 관리
*   **일정 저장 및 목록 조회 (MVP):** 마음에 드는 AI 추천 일정을 보관함에 저장하고 마이페이지에서 언제든지 확인.
*   **공유 기능 (선택):** 고유 URL 또는 텍스트 복사 형태로 동행자나 타인에게 일정 전달.
*   **일정 삭제 (선택):** 저장된 여행 일정을 보관함에서 삭제 관리.

---

## 🛠 기술 스택

### Frontend
*   **React** & **Vite**: 빠르고 모던한 프런트엔드 애플리케이션 구축
*   **TypeScript**: 타입 안정성 확보
*   **CSS / Styling**: 반응형 웹 및 모던한 프리미엄 UI 디자인 설계
*   **Build & Deployment**: **Netlify**

### Backend & Database
*   **Supabase**:
    *   **Authentication**: 사용자 로그인/회원가입 및 세션 관리
    *   **Database (PostgreSQL)**: 사용자별 여행 계획 데이터 보관
*   **AI Engine**: Gemini API / Open AI (프롬프트 엔지니어링 기반 여행 일정 생성)

---

## 📊 데이터베이스 스키마

### `travel_plans` 테이블 구성

| 컬럼명 | 타입 | 설명 | 제약 조건 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | 여행 일정 고유 식별자 | Primary Key, `default_generate_v4()` |
| `user_id` | `uuid` | 작성한 사용자의 고유 ID | Foreign Key (Supabase `auth.users.id`) |
| `title` | `text` | 여행 계획 제목 | `NOT NULL` |
| `destination` | `text` | 여행 도시/국가 | `NOT NULL` |
| `start_date` | `date` | 여행 시작일 | `NOT NULL` |
| `end_date` | `date` | 여행 종료일 | `NOT NULL` |
| `duration` | `text` | 여행 기간 (예: 2박 3일) | `NOT NULL` |
| `budget` | `text` | 여행 예산 설정 | - |
| `companion` | `text` | 동행 유형 (나홀로, 친구, 가족, 연인 등) | - |
| `styles` | `text[]` | 선호 여행 스타일 키워드 배열 | - |
| `must_visit_places`| `text` | 꼭 방문해야 할 장소 | - |
| `plan_content` | `jsonb` | AI가 생성한 Day별 상세 일정 데이터 | `NOT NULL` |
| `created_at` | `timestamptz` | 생성 일시 | `default now()` |
| `updated_at` | `timestamptz` | 수정 일시 | `default now()` |

---

## 🖥️ 주요 화면 구조

1.  **로그인 / 회원가입 화면**
    *   이메일, 비밀번호 입력을 통한 인증 처리 및 화면 전환
2.  **홈 화면 (대시보드)**
    *   사용자 맞춤 환영 메시지 제공
    *   [새 여행 만들기] 및 [내 여행 보러가기] 핵심 CTA 버튼 배치
3.  **여행 조건 입력 화면 (설문형)**
    *   여행지 입력, 날짜 선택, 예산 설정, 동행자 선택
    *   원클릭 선호 스타일 키워드 태그 선택 및 필수 방문 장소 텍스트 입력
4.  **AI 일정 생성 결과 화면**
    *   시간순 Day별 일정 리스트 뷰 및 지도 연결 링크 제공
    *   저장하기 및 피드백 수정 요청 입력 창 제공
5.  **마이페이지 (내 여행 보관함)**
    *   저장된 여행 목록을 카드 형태로 시각화하여 제공
    *   상세 보기 클릭 시 상세 일정 뷰어로 이동

---

## ⚙️ 로컬 실행 및 설정 방법

### 1. 프로젝트 복사
```bash
git clone https://github.com/rhantj/TripMate.git
cd TripMate
```

### 2. 패키지 설치
```bash
npm install
```

### 3. 환경 변수 설정
루트 디렉토리에 `.env` 파일을 생성하고 아래의 정보를 추가합니다.
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 4. 로컬 서버 실행
```bash
npm run dev
```

---

## 🌐 배포 (Netlify)

본 프로젝트는 **Netlify**를 통해 배포 및 지속적 통합(CI/CD)이 관리됩니다.
*   빌드 명령어: `npm run build`
*   빌드 디렉토리: `dist`
*   환경변수 주입: Netlify Dashboard -> Site settings -> Environment variables에 Supabase 및 API 키 세팅 완료.
