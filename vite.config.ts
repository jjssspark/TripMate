import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const projectRoot = path.resolve(__dirname, '.');

  return {
    root: projectRoot,
    publicDir: 'static',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // /trip/:id(공유 링크)와 /api/*(서버 호출)는 캐싱된 앱 셸로 가로채면 안 되므로 폴백에서 제외
        workbox: {
          navigateFallbackDenylist: [/^\/api\//, /^\/trip\//],
        },
        manifest: {
          name: 'TripMate AI - 여행 플래너',
          short_name: 'TripMate AI',
          description: 'AI가 취향에 맞는 여행 일정을 짜주는 플래너',
          // 실제 빌드 산출물은 index.html (rollupOptions.input의 "app" 항목) — landing.html은 별도 마케팅 페이지
          start_url: '/index.html',
          display: 'standalone',
          background_color: '#f8f9fa',
          theme_color: '#3b82f6',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'index.html'),
          index: path.resolve(__dirname, 'landing.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      fs: {
        allow: [projectRoot],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
