import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'node:fs'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import babel from 'vite-plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Прокси для PeerTube API в dev — обход CORS (запрос идёт через тот же origin).
// Пропускает любой метод: авторизация (POST users/token) и загрузка картинок/видео
// (POST images/upload, multipart) идут тем же путём, что и чтение. Раньше здесь был
// фильтр `method === 'GET'`, из-за которого POST проваливался в SPA-fallback и
// возвращал 404 — наружу это выглядело как `peertube_image_token_404`.
function peertubeProxyPlugin() {
  const PREFIX = '/api/peertube/'

  // Тело от undici приходит уже распакованным, поэтому заголовки исходного сжатия
  // и длины отдавать браузеру нельзя — он не сможет декодировать ответ.
  const SKIP_RESPONSE_HEADERS = new Set([
    'content-encoding',
    'content-length',
    'transfer-encoding',
    'connection',
  ])

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })

  return {
    name: 'peertube-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()

        const rest = req.url.slice(PREFIX.length)
        const i = rest.indexOf('/')

        if (i === -1) return next()

        const host = rest.slice(0, i)
        const targetPath = rest.slice(i)
        const targetUrl = `https://${host}${targetPath}`
        const method = req.method || 'GET'
        const hasBody = method !== 'GET' && method !== 'HEAD'

        // Пробрасываем только то, что нужно инстансу. Content-Type обязателен как есть:
        // у multipart в нём лежит boundary, без него загрузка развалится.
        const headers = { Accept: req.headers.accept || 'application/json' }
        if (req.headers.authorization) headers.Authorization = req.headers.authorization
        if (hasBody && req.headers['content-type'])
          headers['Content-Type'] = req.headers['content-type']

        const body = hasBody ? readBody(req) : Promise.resolve(undefined)

        body
          .then((payload) => fetch(targetUrl, { method, headers, body: payload }))
          .then((fetchRes) => {
            res.statusCode = fetchRes.status
            fetchRes.headers.forEach((v, k) => {
              if (!SKIP_RESPONSE_HEADERS.has(k.toLowerCase())) res.setHeader(k, v)
            })
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
                {
                  // HLS-сегменты PeerTube — повторное открытие видео переиспользует кэш, а не трафик.
                  // Скоупим строго на путь PeerTube (/streaming-playlists/hls/) + расширения сегментов,
                  // чтобы не трогать прочие mp4/ts приложения.
                  urlPattern: ({ url }) =>
                    /\/streaming-playlists\/hls\//.test(url.pathname) &&
                    /\.(m4s|ts|mp4)$/i.test(url.pathname),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'bastyon-hls-segments',
                    // LRU: не больше 300 сегментов и 7 дней; чистимся при нехватке квоты.
                    expiration: {
                      maxEntries: 300,
                      maxAgeSeconds: 7 * 24 * 60 * 60,
                      purgeOnQuotaError: true,
                    },
                    // Кэшируем ТОЛЬКО полноценные 200 (CORS-нода). opaque (status 0) НЕ кэшируем —
                    // их нельзя нарезать под Range-запросы hls.js, что сломало бы воспроизведение;
                    // на нодах без CORS просто работаем как раньше (без кэша).
                    cacheableResponse: { statuses: [200] },
                    // PeerTube HLS — fragmented mp4 с byte-range: отдаём 206 из целого кэш-ответа.
                    rangeRequests: true,
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
    // Визуализатор бандла: включается через BUNDLE_ANALYZE=1 pnpm build.
    // Открывает stats.html после билда (treemap), помогает находить раздутые чанки.
    ...(process.env.BUNDLE_ANALYZE === '1'
      ? [visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true, brotliSize: true })]
      : []),
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
    // ffmpeg.wasm спавнит свой worker через `new Worker(new URL('./worker.js', import.meta.url))`.
    // esbuild-пребандл ломает этот паттерн — исключаем, чтобы Vite сам корректно собрал worker.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
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
    // 500 KB — порог, выше которого rollup ругается. Понижено с 1000, чтобы регрессы ловились на CI.
    // Известные чанки выше порога: pocketnet-bitcoin (~900 KB) — это вендоренный btc17.js, выше не оптимизируется.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'pocketnet-bitcoin': ['src/blockchain/lib/pocketnet/btc17.js'],
          // Тяжёлые runtime-либы — отдельные чанки, не попадают в mainBundle.
          'matrix-sdk': ['matrix-js-sdk'],
          'video-hls': ['hls.js'],
          pixi: ['pixi.js'],
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
