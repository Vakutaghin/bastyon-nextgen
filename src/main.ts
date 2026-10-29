// Buffer / process polyfills + ранние error-listeners. ДОЛЖНО быть первым импортом —
// инициализирует globalThis до того, как тела других модулей начнут исполняться.
import './polyfills'

// Подавление шума в консоли (`console.log` + matrix-js-sdk).
// Раскрыть обратно: localStorage.setItem('debug', '1') и перезагрузить.
import './silence-console'

// Инициализация темы — до монтирования, чтобы избежать FOUC.
import { initTheme } from '@/composables/use-theme'
initTheme()

// Ширина страницы — тоже до монтирования: иначе страница прыгает по ширине.
import { initPageWidth } from '@/composables/use-page-width'
initPageWidth()

// Инициализация локали — до монтирования, чтобы <html lang> и тексты
// сразу соответствовали выбранному языку.
import { i18n, initI18n } from '@/i18n'
await initI18n()

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import 'ant-design-vue/dist/reset.css'
// Шрифты интерфейса лежат в бандле, а не на Google Fonts: CSP, Tor и офлайн в
// десктопе. Браузер качает только нужные подмножества (unicode-range).
import '@fontsource-variable/geist'
import '@fontsource-variable/geist/wght-italic.css'
import '@fontsource-variable/geist-mono'

import App from '@/src.vue'
import router from '@/router'
import { initCapacitor } from '@mobile/bootstrap'
import { setupDeepLinks } from '@/composables/use-deep-links'
import { setupBackButton } from '@/composables/use-back-button'
import { setupAppPreferences } from '@/composables/use-app-preferences-effects'
import { setupQuitShortcut } from '@/helpers/desktop/quit-shortcut'
import { installDropGuard } from '@/helpers/common/drop-guard'
import { initDatabase } from '@/db/database'
import { useAuthStore } from '@/blockchain'
import {
  useNotificationsStore,
  useNotificationSettingsStore,
  useTorStore,
  useUIStore,
} from '@/stores'
import { useModalStore } from '@/stores/modal-store'
import { configureUnlockUi, ensureVaultUnlocked } from '@/blockchain/storage/vault/vault-unlock'
// Force-load request module so __torDebug is available in the console at boot.
import '@/helpers/api/request'
import { useMessengerStore } from '@/b-components/messenger/store'
import { showToastsForNewNotifications } from '@/b-components/header/header-notifications/notification-toasts'
import type { NotificationItem } from '@/stores/notifications-store'
import { bootMiniApps } from '@/mini-apps/ui/use-mini-app-bridge'
import { installGlobalErrorHandler } from '@/composables/use-error-boundary'
import { notifyNewNotifications } from '@/composables/use-browser-notifications'
import { queryClient } from './query-client'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// vue3-styled-components вызывает `inject('theme')` без дефолта в setup КАЖДОГО
// styled-компонента (vue-styled-components.es.js:2981). Тема у нас живёт целиком в
// CSS-переменных (COLORS → var(--…)), поэтому `provide('theme')` нигде нет — и Vue
// сыпет «injection "theme" not found» на каждый тег. Отдаём пустой стаб на корне
// приложения: styled-компоненты props.theme не читают, так что значение неважно —
// важно лишь, чтобы inject разрешился и предупреждение исчезло.
app.provide('theme', {})

// Глобальный обработчик ошибок (Vue + window + Promise rejections).
// Должен быть установлен до монтирования, иначе ошибки во время бутстрапа
// не попадают в обработчик.
installGlobalErrorHandler(app)

app.use(pinia)
app.use(VueQueryPlugin, { queryClient })
app.use(router)
// i18n: composition API mode.
app.use(i18n)

const authStore = useAuthStore(pinia)
// Стор мессенджера поднимаем на буте: его watch'и (профили → диалоги) должны
// жить до первого initMatrix из auth-store.
useMessengerStore(pinia)
const notificationsStore = useNotificationsStore(pinia)
const torStore = useTorStore(pinia)
torStore.hydrate().catch(() => {})

// P0-1: мост разблокировки сейфа (passphrase-режим) + ранний старт разлока.
// Для passwordless — молчаливый авто-разлок; модалка не показывается. В embed
// модалки нет (hostAvailable=false), поэтому passphrase-сейф там просто не
// разлочится (публичный embed и не нуждается в доступе к кошельку).
const isEmbedRoute = (): boolean => router.currentRoute.value?.meta?.embed === true
configureUnlockUi({
  open: (phase) => useModalStore(pinia).openVaultUnlock(phase),
  close: () => useModalStore(pinia).closeVaultUnlock(),
  hostAvailable: () => !isEmbedRoute(),
  // После подтверждённого сброса (ключ утерян / забыта passphrase) — сразу импорт по 12 словам.
  openImport: () => useModalStore(pinia).openAuthModal('login'),
})
// N7: до `router.isReady()` текущий маршрут — START_LOCATION с пустым meta,
// поэтому проверка «это embed?» здесь всегда возвращала false и разлок сейфа
// запускался в том числе на публичной embed-странице. Ждём готовности роутера.
// Системные ссылки `bastyon://…` (deep links) — Tauri, Android/iOS, PWA.
void router.isReady().then(() => setupDeepLinks(router))
// «Назад» на Android сначала закрывает открытое поверх — чат, картинку, окно поста.
void setupBackButton()
// Настройки устройства (анимации, масштаб) применяем до первой отрисовки ленты.
void setupAppPreferences()
// Ctrl+Q на Windows и Linux: крестик окно только прячет в трей.
setupQuitShortcut()
// Файл, брошенный мимо зон для файлов, не открывается вместо приложения.
installDropGuard()

void router.isReady().then(() => {
  if (isEmbedRoute()) return
  // Fire-and-forget: модалка (если нужна) появится сразу после mount; restoreSession
  // дедупится тем же мемоизированным промисом (ensureVaultUnlocked) [A5].
  ensureVaultUnlocked().catch(() => {})
})
// Подтягиваем сохранённый язык из IndexedDB и применяем к vue-i18n + <html lang>.
useUIStore(pinia)
  .loadLanguage()
  .catch((e) => console.warn('[main] loadLanguage failed:', e))
// Нажатие на всплывающее или системное уведомление ведёт туда же, куда оно в
// списке. Модуль перехода — по нажатию: стартовой загрузке он не нужен.
const openFromToast = (item: NotificationItem): void => {
  void import('@/b-components/header/header-notifications/open-notification').then((m) =>
    m.openNotification(item, { router })
  )
}
notificationsStore.setOnNewNotifications((items) => {
  void showToastsForNewNotifications(pinia, items, openFromToast)
  notifyNewNotifications(items, openFromToast)
})

const NOTIFICATIONS_POLL_INTERVAL_MS = 30 * 1000
let notificationsPollTimerId: ReturnType<typeof setInterval> | null = null

// Ключ — адрес, а не флаг авторизации: при смене аккаунта флаг не меняется,
// и уведомления раньше оставались от прежнего пользователя (X9/S14).
// Сброс сторов делает auth-store.resetForAccount; здесь — только подъём.
watch(
  () => (authStore.isUserAuthenticated ? authStore.getUserAddress : null),
  (address) => {
    if (notificationsPollTimerId != null) {
      clearInterval(notificationsPollTimerId)
      notificationsPollTimerId = null
    }
    if (address) {
      useNotificationSettingsStore(pinia).load()
      notificationsStore.init()
      notificationsPollTimerId = setInterval(() => {
        notificationsStore.init({ forceRefresh: true })
      }, NOTIFICATIONS_POLL_INTERVAL_MS)
    }
  },
  { immediate: true }
)
// Matrix-логин запускает только auth-store (signIn/switchAccount/restoreSession →
// resetMessenger) — второй watcher здесь давал два параллельных логина (S11).

// Поднимаем mini-apps bridge как можно раньше — нужно чтобы window.message listener
// был активен до того как iframe миниаппы успеет загрузить SDK и отправить первое
// сообщение. Async-фаза (lazy import сторов) обычно резолвится в один микротаск.
bootMiniApps(router).catch((e) => console.warn('[main] bootMiniApps failed:', e))

// Инициализируем IndexedDB перед монтированием приложения.
// В Tauri/WebView IndexedDB может зависнуть — таймаут гарантирует монтирование и возможность отладки.
const MOUNT_TIMEOUT_MS = 5000
let mounted = false

function doMount() {
  if (mounted) return
  mounted = true

  try {
    app.mount('#app')
    initCapacitor(router).catch((e) => console.warn('[main] initCapacitor failed:', e))
  } catch (e) {
    console.error('[main] Mount failed:', e)
  }
}

initDatabase()
  .then(() => doMount())
  .catch((error) => {
    console.error('[main] initDatabase failed:', error)
    doMount()
  })

// Если IndexedDB завис (например в Tauri production), монтируем по таймауту.
setTimeout(() => {
  if (!mounted) {
    console.warn('[main] initDatabase timeout, mounting anyway')
    doMount()
  }
}, MOUNT_TIMEOUT_MS)
