# output — 포트폴리오 산출물

문서(README·노션·개인 사이트)에서 이 경로를 참조하므로 **파일명을 바꾸지 않는다.**

```
output/
├── screenshots/   정지 화면. 01부터 순번
└── video/         데모 영상·GIF
```

## 파일명 규칙

| 파일 | 담을 것 |
|---|---|
| `screenshots/01-home-hero.jpg` | 홈 히어로 |
| `screenshots/02-home-moodboard.jpg` | 국내 여행지 무드보드 |
| `screenshots/03-planner-step1.jpg` | 일정 만들기 1단계 |
| `screenshots/04-planner-step2.jpg` | 취향 선택 (스타일 5개 제한) |
| `screenshots/05-loading.jpg` | 생성 중 카운트다운 |
| `screenshots/06-plan-result.jpg` | 일정 결과 |
| `video/demo.gif` | README 인라인용 |
| `video/demo.mp4` | 원본 (노션·개인 사이트용) |

## 형식 기준

- **GIF**: GitHub README에서 상대경로로 바로 재생된다. 폭 1000px 내외, **10MB 이하**(가능하면 5MB)
- **MP4**: README에 상대경로로 넣으면 **재생되지 않는다.** 노션·개인 사이트용으로만 쓰고,
  GitHub에 넣으려면 이슈/릴리스에 드래그 업로드해 나온 CDN URL을 README에 붙인다
- **스크린샷**: 사진이 많으므로 JPG. 폭 1400px 내외

## 촬영 시 주의

- 브라우저 창에서 개인정보(북마크바, 다른 탭 제목, 이메일)가 보이지 않게 한다
- 생성 대기(약 18~20초)는 편집으로 압축하되 **로딩 UI 자체는 보여준다.** 그것도 설계의 일부다
- 결과 화면은 **새로 생성한 일정**으로 찍는다. 예전에 저장된 일정은 프롬프트 개선 전 결과라
  장소명이 밋밋하다
