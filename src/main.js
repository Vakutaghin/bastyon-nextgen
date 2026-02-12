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
    nextTick: function(callback) {
      setTimeout(callback, 0)
    }
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
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from '@/src.vue'
import router from '@/router'
import { initDatabase } from '@/db'
import { queryClient } from './query-client'
import { useAuthStore } from '@/blockchain'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useNotificationsStore } from '@/stores'

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

// Регистрируем Router
app.use(router)

const authStore = useAuthStore(pinia)
const messengerStore = useMessengerStore(pinia)
const notificationsStore = useNotificationsStore(pinia)

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

// Инициализируем IndexedDB перед монтированием приложения
let mounted = false

initDatabase()
  .then(() => {
    if (!mounted) {
      mounted = true
      app.mount('#app')
    }
  })
  .catch((error) => {
    console.error('Failed to initialize application:', error)
    // Монтируем приложение даже при ошибке инициализации БД
    if (!mounted) {
      mounted = true
      app.mount('#app')
    }
  })
