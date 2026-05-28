import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'node:fs'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import babel from 'vite-plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Прокси для PeerTube API в dev — обход CORS (запрос идёт через тот же origin)
function peertubeProxyPlugin() {
  const PREFIX = '/api/peertube/'

  return {
    name: 'peertube-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith(PREFIX) && req.method === 'GET') {
          const rest = req.url.slice(PREFIX.length)
          const i = rest.indexOf('/')

          if (i === -1) return next()

          const host = rest.slice(0, i)
          const targetPath = rest.slice(i)
          const targetUrl = `https://${host}${targetPath}`

          fetch(targetUrl, {
            method: 'GET',
            headers: {
              Accept: req.headers.accept || 'application/json',
            },
          })
            .then((fetchRes) => {
              res.statusCode = fetchRes.status
              fetchRes.headers.forEach((v, k) => res.setHeader(k, v))
              return fetchRes.arrayBuffer()
            })
            .then((buf) => {
              res.end(Buffer.from(buf))
            })
            .catch((err) => {
              res.statusCode = 502
              res.setHeader('Content-Type', 'text/plain')
              res.end('Proxy error: ' + String(err.message))
            })

          return
        }

        next()
      })
    },
  }
}

// import { styledDataAttr } from './vite-plugin-styled-data-attr.js'

// В production Tauri загружает фронт через asset-протокол; относительный base гарантирует
// корректное разрешение путей к JS/CSS (иначе возможен пустой экран, нет запросов)
const base = process.env.VITE_TAURI === 'true' ? './' : '/'

export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    peertubeProxyPlugin(),
    babel({
      babelConfig: {
        presets: ['@babel/preset-typescript'],
        plugins: [
          [
            'babel-plugin-styled-components',
            {
              ssr: true, // Включаем для стабильной генерации хешей (componentId)
              displayName: true, // Включаем для отладки (data-styled-name)
              fileName: false,
              topLevelImportPaths: ['vue3-styled-components'], // Указываем путь импорта для vue3-styled-components
            },
          ],
        ],
      },
      filter: /\.(ts|tsx)$/,
    }),
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    wasm(), // Плагин для поддержки WebAssembly (нужен для tiny-secp256k1)
    // PWA: service worker для offline / установки. Отключаем в Tauri (там
    // фронт грузится через asset-протокол, SW не нужен).
    ...(process.env.VITE_TAURI === 'true'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            // Manifest уже в public/manifest.webmanifest — берём его как есть.
            manifest: false,
            // Игнорируем precache мини-приложений и WASM-чанков (большие).
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
              globIgnores: ['**/pocketnet-bitcoin-*.js', '**/*.wasm'],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              navigateFallback: '/index.html',
              // /app/* и /_matrix/* — не SPA, оставляем сети.
              navigateFallbackDenylist: [/^\/app\//, /^\/_matrix\//, /^\/api\//],
              runtimeCaching: [
                {
                  urlPattern: ({ request }) => request.destination === 'image',
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'bastyon-images',
                    expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                  },
                },
              ],
            },
            devOptions: { enabled: false },
          }),
        ]),
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
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(
        __dirname,
        'node_modules/vite-plugin-node-polyfills/shims/buffer'
      ),
      // Перенаправляем vue3-styled-components на наш wrapper для поддержки .withConfig
      'vue3-styled-components': path.resolve(__dirname, 'src/styled-wrapper.js'),
      // Полифиллы util/stream отключены: при включении ломалась авторизация по мнемонике.
      // Предупреждения "Module util/stream externalized for browser compatibility" в консоли можно игнорировать.
      // 'util': path.resolve(__dirname, 'node_modules/util'),
      // 'stream': path.resolve(__dirname, 'node_modules/stream-browserify'),
    },
    // Поддержка CommonJS модулей (для btc17.js)
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },

  define: {
    global: 'globalThis',
    'process.env': {},
    'process.browser': true,
    'process.version': '"v16.0.0"',
    __APP_VERSION__: JSON.stringify(pkg.version),
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
    port: process.env.VITE_PORT
      ? parseInt(process.env.VITE_PORT)
      : process.env.TAURI_DEV
        ? 1990
        : 1980,
    hmr: {
      port: process.env.VITE_PORT
        ? parseInt(process.env.VITE_PORT)
        : process.env.TAURI_DEV
          ? 1990
          : 1980,
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
      },
    },
  },
}))
