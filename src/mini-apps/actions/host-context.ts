/**
 * HostContext — узкий интерфейс между action handler'ами и хост-приложением.
 *
 * Цель: не давать handler'ам импортировать конкретные сторы/роутер/UI-модалки
 * напрямую. Это:
 * - тестируется тривиально (моки HostContext);
 * - позволяет менять реализацию стора без перетряхивания всех action'ов;
 * - даёт явный аудит того, что вообще делает host.
 *
 * Дефолтная prod-реализация — в {@link createDefaultHostContext}. Конкретные
 * группы методов вынесены в подпапку `host-context-methods/` по доменам
 * (auth/rpc/content/payments/media/chat), константы — в `host-constants.ts`,
 * device-детект/геолокация — в `host-device-utils.ts`.
 */

import type { Router } from 'vue-router'
import type { ApiSignature } from '@/blockchain/types/signatures'
import { ARCHIVED_PEERTUBE_SERVERS } from './host-constants'
import { detectDevice, browserGeolocation } from './host-device-utils'
import { createAuthMethods } from './host-context-methods/auth'
import { createRpcMethods } from './host-context-methods/rpc'
import { createContentMethods } from './host-context-methods/content'
import { createPaymentMethods } from './host-context-methods/payments'
import { createMediaMethods } from './host-context-methods/media'
import { createMediaUploadMethods } from './host-context-methods/media-upload'
import { createChatMethods } from './host-context-methods/chat'

export type HostDevice = 'browser' | 'capacitor_ios' | 'capacitor_android' | 'tauri' | 'electron'

/** Минимальное представление темы — legacy миниаппы читают `rootid`. */
export interface HostTheme {
  rootid: string
  name?: string
}

/** Минимальное представление project_config — то что нужно миниаппам. */
export interface HostProject {
  url: string
  turl?: string
  name: string
  protocol: string
  archivedPeertubeServers?: readonly string[]
}

export interface HostContext {
  // ─── статические метаданные ────────────────────────────────────────────
  readonly appVersion: string
  readonly isProduction: boolean
  readonly device: HostDevice
  readonly transactionsApiVersion: number

  // ─── reactive: читаются на каждый вызов (значение может меняться) ──────
  getLocale(): string
  getTheme(): HostTheme
  getMarginTop(): string
  isTorActive(): boolean
  isUserAuthenticated(): boolean
  /** Адрес текущего пользователя (для signature/account). null если не залогинен. */
  getUserAddress(): string | null
  /**
   * Список производных P2SH-адресов кошелька текущего пользователя
   * (legacy `sdk.addresses.storage.addresses`). Пустой массив, если не залогинен
   * или адреса ещё не выведены. Используется action'ом `zaddress`.
   */
  getUserWalletAddresses(): string[]
  getProject(): HostProject

  // ─── навигация ─────────────────────────────────────────────────────────
  navigate(path: string): void

  // ─── UI side-effects ───────────────────────────────────────────────────
  /** Показывает alert с переданным текстом. Резолвится после закрытия. */
  showAlert(message: string): Promise<void>
  openSettings(): Promise<void>
  openRegistration(): Promise<void>
  openProfile(address: string): Promise<void>

  // ─── data sources ──────────────────────────────────────────────────────
  /** Геолокация через native API (или mock в тестах). */
  getGeolocation(signal?: AbortSignal): Promise<{ latitude: number; longitude: number }>
  /** Курсы валют. Возвращает legacy-форму `{ prices: {...} }` или `{}`. */
  fetchCurrencyRates(signal?: AbortSignal): Promise<Record<string, unknown>>

  // ─── crypto ────────────────────────────────────────────────────────────
  /**
   * Подписывает произвольную строку текущим приватным ключом пользователя.
   * Возвращает `null` если пользователь не авторизован.
   *
   * По умолчанию использует новый формат с nonce+ttl (закрывает §1.14).
   * Для совместимости с backend-ами, которые ожидают legacy формат, можно
   * передать `useOldFormat: true`.
   */
  signApiMessage(
    data: string,
    options?: { expiration?: number; useOldFormat?: boolean }
  ): ApiSignature | null
  /**
   * Статус текущего аккаунта (баланс, верификация, и т.п.). Возвращает `null`
   * если пользователь не авторизован. Конкретный shape определяется
   * blockchain-стороной — миниаппы получают его как opaque object.
   */
  getCurrentAccountStatus(): unknown

  // ─── wallet / RPC ──────────────────────────────────────────────────────
  /**
   * Произвольный RPC-вызов к pocketnet-ноде. Тонкая обёртка над `getByPRC` из
   * `@/helpers/api/request`. Используется action'ами, которым нужны эндпоинты
   * без выделенного метода в HostContext.
   */
  callRpc(
    method: string,
    parameters?: unknown[],
    options?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown>
  /**
   * Баланс по адресу текущего пользователя. Возвращает `getaddressinfo`-форму или
   * `{}` если пользователь не залогинен.
   */
  getUserBalance(signal?: AbortSignal): Promise<Record<string, unknown>>
  /**
   * Текущая высота tip-блока — для фильтра confirmations в `fromToTransactions`.
   */
  getCurrentBlockHeight(signal?: AbortSignal): Promise<number>

  // ─── payments (5.5) ────────────────────────────────────────────────────
  /**
   * Открывает диалог платежа. Резолвится action-объектом с полями
   * `{transaction?, completed?, rejected?, ...}` (legacy actionHelper).
   *
   * MVP: возвращает `{rejected: true, reason: 'not_implemented'}` пока не
   * подключим реальный wallet/payment UI nextgen.
   */
  openPaymentDialog(payment: unknown): Promise<Record<string, unknown>>
  /**
   * Открывает закодированный платёж по `ext` хэшу. Эквивалент `sdk.ext(payment)`.
   * MVP: throws `not_implemented`.
   */
  openExternalPayment(extHash: string): Promise<string>

  // ─── content (5.6) ─────────────────────────────────────────────────────
  /** Открывает пост по txid. */
  openPost(txid: string): Promise<void>
  /** Открывает диалог доната пользователю. */
  openDonation(receiver: string): Promise<void>
  /** Открывает внешний URL в системном браузере (или новой вкладке в web). */
  openExternalLink(url: string): Promise<void>
  /**
   * Открывает share-sheet. `onBastyon: true` — поделиться внутри Bastyon-ленты,
   * иначе — нативный share (Web Share API / Capacitor Share / window.open).
   */
  share(
    data: { path?: string; url?: string; sharing?: unknown },
    opts?: { onBastyon?: boolean }
  ): Promise<void>
  /** Открывает форму жалобы. */
  openComplain(data: unknown): Promise<void>
  /** Возвращает pending actions пользователя (транзакции, ожидающие подтверждения). MVP: `[]`. */
  getPendingActions(): unknown[]

  // ─── media (5.8) ───────────────────────────────────────────────────────
  /**
   * Снимает фото камерой устройства (или выбирает из галереи на mobile).
   * Возвращает legacy-форму `{ images: [{ image: <base64> }] }`.
   *
   * - Web/desktop без Capacitor → throws `mobile:camera:notsupported`.
   * - Пользователь отменил → throws `mobile:camera:cancel`.
   */
  takePhoto(): Promise<{ images: Array<{ image: string }> }>

  /**
   * Загружает изображения (data-URL base64) через провайдера картинок,
   * сохраняя порядок. Возвращает публичные URL. Legacy `images.upload`.
   */
  uploadImages(images: string[]): Promise<string[]>

  /**
   * Удаляет видео на PeerTube-инстансе по указателю `peertube://host/id[/audio]`
   * (авторизуется токеном текущего пользователя). Legacy `videos.remove`.
   * Throws `not_authenticated`, если пользователь не залогинен.
   */
  removeVideo(pointer: string): Promise<void>

  // ─── chat (5.7) ────────────────────────────────────────────────────────
  /** Открывает room в Matrix-чате. */
  chatOpenRoom(roomid: string): Promise<void>
  /**
   * Создаёт или возвращает существующую DM-комнату с одним пользователем.
   * Возвращает `{roomid}` в legacy-форме. Группы (`users.length > 1`) пока
   * не поддерживаются — throws `chat_group_rooms_not_supported`.
   */
  chatGetOrCreateRoom(users: string[], parameters?: unknown): Promise<Record<string, unknown>>
  /**
   * Шлёт текстовое сообщение в комнату. `content` принимает string или объект
   * с полем `body`. Возвращает ответ matrix-js-sdk `{event_id}`.
   */
  chatSendMessage(roomid: string, content: unknown): Promise<Record<string, unknown>>
}

// ─── default factory ─────────────────────────────────────────────────────────

/**
 * Параметры дефолтного host context. Все опциональны — там где не задано,
 * берём из стора/окружения.
 */
export interface DefaultHostContextOptions {
  router: Router
  /** Если задан — используем; иначе детектируем по runtime признакам. */
  device?: HostDevice
  /** Опциональная функция для показа alert. По умолчанию — `window.alert`. */
  alertImpl?: (message: string) => Promise<void>
}

/**
 * Создаёт прод-контекст. Импортирует сторы лениво (внутри методов), чтобы:
 * (a) обойти Pinia-инициализацию при импорте модуля;
 * (b) каждый вызов получал актуальное состояние.
 */
export async function createDefaultHostContext(
  opts: DefaultHostContextOptions
): Promise<HostContext> {
  const { useUIStore } = await import('@/stores/ui-store')
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const { useTorStore } = await import('@/stores/tor-store')
  const { isTauri, isCapacitor } = await import('@/b-components/video-uploader/utils/environment')
  const { generateApiSignature } = await import('@/blockchain/core/signatures/api-signature')
  const { getWalletAddressesList } = await import('@/blockchain/storage')
  const { getByPRC } = await import('@/helpers/api/request')
  const { rpcEndpoints } = await import('@/helpers/api/rpc-endpoints')
  const { unwrapRpcResponse } = await import('@/helpers/common/response-parser')
  const { uploadImages } = await import('@/services/image-upload-service')
  const { removeVideoByPointer } = await import('@/services/peertube/peertube-videos')

  const device: HostDevice = opts.device ?? detectDevice(isTauri(), isCapacitor())

  const auth = createAuthMethods({ useAuthStore, generateApiSignature, getWalletAddressesList })
  const rpc = createRpcMethods({ useAuthStore, getByPRC, rpcEndpoints, unwrapRpcResponse })
  const content = createContentMethods({ router: opts.router })
  const payments = createPaymentMethods()
  const media = createMediaMethods({ isCapacitor })
  const mediaUpload = createMediaUploadMethods({ useAuthStore, uploadImages, removeVideoByPointer })
  const chat = createChatMethods({ router: opts.router })

  return {
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    isProduction: import.meta.env?.MODE === 'production',
    device,
    transactionsApiVersion: 8,

    getLocale: () => useUIStore().language,
    getTheme: () => ({ rootid: useUIStore().theme }),
    getMarginTop: () =>
      document.documentElement.style.getPropertyValue('--app-margin-top') || '0px',
    isTorActive: () => useTorStore().isReady,
    isUserAuthenticated: () => useAuthStore().isUserAuthenticated,
    getUserAddress: () => useAuthStore().address ?? null,
    getProject: () => ({
      url: 'bastyon.com',
      turl: 'test.pocketnet.app',
      name: 'Bastyon',
      protocol: 'bastyon',
      // Legacy миниаппы (включая Barteron) вызывают
      // `sdk.manageBastyonImageSrc(url)` который делает `.map` на этом массиве —
      // без проверки. Если undefined → TypeError. Список синхронизирован с
      // `project_config.archivedPeertubeServers` из legacy index_el.html.
      archivedPeertubeServers: ARCHIVED_PEERTUBE_SERVERS,
    }),

    navigate: (path) => {
      void opts.router.push(path)
    },

    showAlert:
      opts.alertImpl ??
      (async (message: string) => {
        // Заглушка — этап 7 заменит на нативный modal-компонент.
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(message)
        }
      }),

    openSettings: async () => {
      void opts.router.push('/settings')
    },

    openProfile: async (address: string) => {
      void opts.router.push(`/${address}`)
    },

    getGeolocation: (signal) => browserGeolocation(signal),

    fetchCurrencyRates: async () => {
      // TODO(etap 5.4): подключить к pocketnet exchanges API через blockchain RPC.
      // Legacy: `app.api.fetch('exchanges/history').then(r => r.prices)`. До появления
      // нужного эндпоинта в nextgen возвращаем пустой объект — миниаппы получат пустой
      // ответ вместо ошибки.
      return {}
    },

    // ─── domain methods (вынесены в host-context-methods/*) ────────────────
    ...auth,
    ...rpc,
    ...content,
    ...payments,
    ...media,
    ...mediaUpload,
    ...chat,
  }
}

// ─── ambient declarations ────────────────────────────────────────────────────
declare const __APP_VERSION__: string
