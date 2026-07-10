import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import PublicTripView from './components/PublicTripView.tsx';
import './index.css';

// 오프라인 캐싱 + 홈 화면 추가(PWA)를 위한 서비스워커 등록. 새 버전 배포 시 자동으로 갱신된다.
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

// react-router 없이, /trip/:id 공유 링크만 URL 경로를 직접 파싱해 별도 화면으로 분기한다.
// (App.tsx는 세션 유무와 무관하게 항상 로그인 게이트를 거치므로, 비로그인 공개 열람에는 쓸 수 없음)
const tripMatch = window.location.pathname.match(/^\/trip\/([^/]+)\/?$/);

// 내 여행 목록(travel_plans) 조회 결과를 캐싱해, 탭을 옮겨다녀도 매번 Supabase를
// 재요청하지 않고 즉시 이전 데이터를 보여준 뒤 백그라운드에서 최신화한다 (staleTime 동안은 재요청 생략).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {tripMatch ? <PublicTripView planId={tripMatch[1]} /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
);
