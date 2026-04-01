import { defineConfig } from 'vitest/config'
import path from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
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
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,js,vue}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,js}',
        'src/main.js',
        'src/polyfills.ts',
      ],
    },
  },
})
