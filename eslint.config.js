import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'data', '.netlify', 'node_modules']),

  // 브라우저에서 도는 React 코드
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node에서 도는 코드 — 로컬 dev 서버, Netlify Functions, 빌드 설정
  {
    files: ['server/**/*.ts', 'netlify/**/*.ts', 'vite.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
// ── 관리 중인 기술 부채 ─────────────────────────────────────────
  // no-explicit-any 를 error 가 아닌 warn 으로 둔다.
  // 이유: Gemini 응답과 Supabase 반환값의 타입 경계에 any 가 57곳 있다.
  // 제대로 없애려면 응답 스키마 타입을 새로 정의해야 하므로 별도 작업으로 분리했다.
  // 숨기려는 게 아니라 lint 출력에 계속 남겨 추적한다.
  // 되돌릴 시점: docs/ARCHITECTURE.md '알려진 개선 과제' 참고.
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
]);
