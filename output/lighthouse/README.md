# Lighthouse 측정 기록

배포 URL(https://tripgather.netlify.app)을 대상으로 로컬 맥북에서 `lighthouse@12` CLI로 쟀다. 원본 JSON은 파일당 400KB가 넘어 커밋하지 않고 요약만 남긴다.

재측정 명령:

```bash
npx -y lighthouse@12 https://tripgather.netlify.app/ --preset=desktop \
  --output=json --output-path=output/lighthouse/YYYY-MM-DD-landing-desktop.json \
  --chrome-flags="--headless=new"
```

## 2026-11-08

| 페이지 | 기기 | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| 랜딩 `/` | 데스크톱 | 80 | 100 | 100 | 90 | 1.7s | 1.7s | 0ms | 0 |
| 랜딩 `/` | 모바일 | 85 | 100 | 100 | 90 | 3.4s | 3.4s | 0ms | 0 |
| 앱 `/index.html` (로그인 화면) | 데스크톱 | 94 | 100 | 100 | 90 | 1.2s | 1.2s | 0ms | 0 |
| 앱 `/index.html` (로그인 화면) | 모바일 | 77 | 100 | 100 | 90 | 3.6s | 3.6s | 0ms | 0 |

- SEO 90의 감점 항목은 `meta-description` 하나다.
- 앱 쪽은 비로그인 상태라 로그인 화면이 측정 대상이다. 일정 결과 화면(지도·사진 포함)은 로그인이 필요해 CLI로 재지 못했다.
