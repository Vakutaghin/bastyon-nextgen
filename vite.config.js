import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import babel from 'vite-plugin-babel'

// import { styledDataAttr } from './vite-plugin-styled-data-attr.js'


export default defineConfig(({ mode }) => ({
  plugins: [
    babel({
      babelConfig: {
        presets: ['@babel/preset-typescript'],
        plugins: [
          ['babel-plugin-styled-components', {
            ssr: true, // Включаем для стабильной генерации хешей (componentId)
            displayName: true, // Включаем для отладки (data-styled-name)
            fileName: false,
            topLevelImportPaths: ['vue3-styled-components'] // Указываем путь импорта для vue3-styled-components
          }]
        ]
      },
      filter: /\.(ts|tsx)$/
    }),
    vue({
      script: {
        defineModel: true,
        propsDestructure: true
      }
    }),
    wasm(), // Плагин для поддержки WebAssembly (нужен для tiny-secp256k1)
    // Плагин для полифиллов Node.js модулей (нужен для btc17.js)
    nodePolyfills({
      // Включаем только необходимые полифиллы
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      // Полифиллы для конкретных модулей
      protocolImports: true,
      // Включаем require для загрузки CommonJS модулей (btc17.js)
      include: ['module', 'buffer', 'process'],
    }),
    // Плагин для добавления data-styled-name только в dev-режиме
    // ...(mode === 'development' ? [ styledDataAttr() ] : []),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mobile': path.resolve(__dirname, './src-mobile'),
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/buffer'),
      // Перенаправляем vue3-styled-components на наш wrapper для поддержки .withConfig
      'vue3-styled-components': path.resolve(__dirname, 'src/styled-wrapper.js'),
    },
    // Поддержка CommonJS модулей (для btc17.js)
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },

  define: {
    'global': 'globalThis',
    'process.env': {},
    'process.browser': true,
    'process.version': '"v16.0.0"',
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
        'process.env': '{}',
      },
    },
    // Исключаем btc17.js из оптимизации, так как это большой CommonJS модуль
    // Vite обработает его напрямую
    // exclude: ['src/blockchain/lib/pocketnet/btc17.js'],
  },

  build: {
    target: 'esnext', // Поддержка top-level await для WebAssembly
    minify: 'esbuild',
    // Настройки для больших файлов (btc17.js ~900KB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Оптимизация для больших модулей
        manualChunks: {
          'pocketnet-bitcoin': ['src/blockchain/lib/pocketnet/btc17.js'],
        },
      },
    },
  },

  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : (process.env.TAURI_DEV ? 1990 : 1980),
    hmr: {
      port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : (process.env.TAURI_DEV ? 1990 : 1980),
    },
    headers: {
      // Используем credentialless вместо require-corp для разрешения загрузки внешних изображений
      // require-corp блокирует все ресурсы без Cross-Origin-Resource-Policy заголовка
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/_matrix': {
        target: 'https://matrix.pocketnet.app',
        changeOrigin: true,
        secure: false,
      }
    },
  },
}))
