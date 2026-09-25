import { defineConfig } from 'vitest/config'
import path from 'path'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'

// Vite подставляет версию из package.json через define; в vitest нужен тот же
// глобал, иначе модули, читающие `__APP_VERSION__` (changelog), падают.
const appVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mobile': path.resolve(__dirname, './src-mobile'),
      'vue3-styled-components': path.resolve(__dirname, 'src/styled-wrapper.js'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,js}'],
    // encryption.test.ts гонит pbkdf2 с реальным числом итераций — на медленных
    // CI-агентах и в vitest 3 с включённым isolate'ом это легко перебирает дефолт 5s.
    // Подняли до 15s; реальные тесты укладываются в 2-3s, остальное — запас на флаки.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,js,vue}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.{test,spec}.{ts,js}', 'src/main.ts', 'src/polyfills.ts'],
    },
  },
})
