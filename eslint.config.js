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
    files: ['server/**/*.ts', 'netlify/**/*.ts', 'tests/**/*.ts', 'vite.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // 2026-11-08: any 37곳을 전부 실제 타입으로 바꾼 뒤 warn에서 error로 올렸다.
  // Gemini·Supabase 응답 경계는 server/http/netlify.ts, src/lib/supabaseClient.ts의 Row 타입이 맡는다.
  // 플러그인을 여기서도 등록해야 한다. 위 두 블록에 안 걸리는 .ts 파일이 하나라도 있으면
  // "could not find plugin" 으로 lint 전체가 죽는다.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // 테스트의 목(mock) 인자처럼 시그니처를 맞추려고 받기만 하는 값은 _ 접두사로 표시한다.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
