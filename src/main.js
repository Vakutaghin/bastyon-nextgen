// Подавление шума в консоли (console.log/info/debug + matrix-js-sdk).
// Раскрыть обратно: localStorage.setItem('debug', '1') и перезагрузить.
import './silence-console'

// Полифилл для Buffer в браузере (нужен для bip39 и других библиотек)
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}
if (typeof global !== 'undefined') {
  global.Buffer = Buffer
}

// Полифилл для process (нужен для btc17.js)
if (typeof process === 'undefined') {
  const processPolyfill = {
    env: {},
    browser: true,
    version: 'v16.0.0',
    nextTick: function (callback) {
      setTimeout(callback, 0)
    },
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.process = processPolyfill
  }
  if (typeof window !== 'undefined') {
    window.process = processPolyfill
  }
  if (typeof global !== 'undefined') {
    global.process = processPolyfill
  }
}

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import Antd, { ConfigProvider } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import App from '@/src.vue'
import router from '@/router'
import { initCapacitor } from '@mobile/bootstrap'
import { initDatabase } from '@/db/database'
import { useAuthStore } from '@/blockchain'
import { useNotificationsStore, useNotificationSettingsStore, useTorStore } from '@/stores'
// Force-load request module so __torDebug is available in the console at boot.
import '@/helpers/api/request'
import { useMessengerStore } from '@/b-components/messenger/store'
import { showToastsForNewNotifications } from '@/b-components/header/header-notifications/notification-toasts'
import { bootMiniApps } from '@/mini-apps/ui/use-mini-app-bridge'
import { queryClient } from './query-client'
import './style.css'

// Подавляем предупреждение о theme injection в dev-режиме
// Это известная проблема в ant-design-vue v4, которая не влияет на функциональность
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args) => {
    const message = args[0]?.toString() || ''
    // Подавляем только предупреждение о theme injection
    if (message.includes('injection "theme" not found')) {
      return
    }
    originalWarn.apply(console, args)
  }
}

const app = createApp(App)
const pinia = createPinia()

// Регистрируем Pinia
app.use(pinia)

// Регистрируем Vue Query
app.use(VueQueryPlugin, { queryClient })

// Регистрируем Ant Design Vue глобально
app.use(Antd)
// Инициализируем глобальный конфиг до монтирования (избегаем "reading 'prefixCls'" в API: modal, message, notification)
ConfigProvider.config({ prefixCls: 'ant' })

// Регистрируем Router
app.use(router)

const authStore = useAuthStore(pinia)
const messengerStore = useMessengerStore(pinia)
const notificationsStore = useNotificationsStore(pinia)
const torStore = useTorStore(pinia)
torStore.hydrate().catch(() => {})
notificationsStore.setOnNewNotifications((items) => showToastsForNewNotifications(pinia, items))

const NOTIFICATIONS_POLL_INTERVAL_MS = 30 * 1000
let notificationsPollTimerId = null

watch(
  () => authStore.isUserAuthenticated,
  (isAuthenticated) => {
    if (notificationsPollTimerId != null) {
      clearInterval(notificationsPollTimerId)
      notificationsPollTimerId = null
    }
    if (isAuthenticated) {
      useNotificationSettingsStore(pinia).load()
      notificationsStore.init()
      notificationsPollTimerId = setInterval(() => {
        notificationsStore.init({ forceRefresh: true })
      }, NOTIFICATIONS_POLL_INTERVAL_MS)
    }
  },
  { immediate: true }
)

watch(
  () => authStore.isUserAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      messengerStore.initMatrix()
    }
  },
  { immediate: true }
)

// Поднимаем mini-apps bridge как можно раньше — нужно чтобы window.message listener
// был активен до того как iframe миниаппы успеет загрузить SDK и отправить первое
// сообщение. Async-фаза (lazy import сторов) обычно резолвится в один микротаск.
bootMiniApps(router).catch((e) => console.warn('[main] bootMiniApps failed:', e))

// Инициализируем IndexedDB перед монтированием приложения.
// В Tauri/WebView IndexedDB может зависнуть — таймаут гарантирует монтирование и возможность отладки.
const MOUNT_TIMEOUT_MS = 5000
let mounted = false

function doMount() {
  if (!mounted) {
    mounted = true

    try {
      app.mount('#app')
      initCapacitor(router).catch((e) => console.warn('[main] initCapacitor failed:', e))
    } catch (e) {
      console.error('[main] Mount failed:', e)
    }
  }
}

initDatabase()
  .then(() => doMount())
  .catch((error) => {
    console.error('[main] initDatabase failed:', error)
    doMount()
  })

// Если IndexedDB завис (например в Tauri production), монтируем по таймауту
setTimeout(() => {
  if (!mounted) {
    console.warn('[main] initDatabase timeout, mounting anyway')
    doMount()
  }
}, MOUNT_TIMEOUT_MS)
