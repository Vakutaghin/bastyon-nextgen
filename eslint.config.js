import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

// Minimal set of browser globals used by <script setup> blocks in .vue files.
// (no-undef is enabled via js.configs.recommended and doesn't know about these
//  unless we declare them; .ts files get them from the TS lib instead.)
const BROWSER_GLOBALS = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  Image: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  SVGElement: 'readonly',
  SVGSVGElement: 'readonly',
  Navigator: 'readonly',
  ShareData: 'readonly',
  Node: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  TouchEvent: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  DOMException: 'readonly',
  WebSocket: 'readonly',
  Buffer: 'readonly',
  process: 'readonly',
  globalThis: 'readonly',
}

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'src/blockchain/lib/**', '*.config.js', '*.config.ts'],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended (type-checked rules disabled for speed)
  ...tseslint.configs.recommended,

  // Vue essential rules
  ...pluginVue.configs['flat/essential'],

  // Vue files: use vue-eslint-parser
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: BROWSER_GLOBALS,
    },
  },

  // Browser globals for TS / JS as well (matches what runs in the app).
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: BROWSER_GLOBALS,
    },
  },

  // Project-specific rules
  {
    files: ['**/*.{ts,tsx,vue,js}'],
    rules: {
      quotes: ['warn', 'single', { avoidEscape: true }],

      'arrow-parens': ['warn', 'always'],

      'no-restricted-exports': ['warn', { restrictDefaultExports: { direct: true } }],

      // TypeScript-specific
      '@typescript-eslint/no-explicit-any': 'off', // Too many existing usages
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Vue
      'vue/multi-word-component-names': 'off',

      // General quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  }
)
