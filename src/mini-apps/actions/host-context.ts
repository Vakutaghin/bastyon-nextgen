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
import { createCurrencyMethods } from './host-context-methods/currency'
import { createMediaUploadMethods } from './host-context-methods/media-upload'
import { createChatMethods } from './host-context-methods/chat'
import { createAppTxMethods } from './host-context-methods/app-tx'
import { createVideoMethods } from './host-context-methods/videos'
import type { LegacyVideoItem, UploadedAppVideo } from './host-context-methods/videos'
import type { ComposerSharePrefill } from '@/b-components/content/post-composer/composer-source'
import type { LegacyTxObject } from '../tx/legacy-objects'

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
   * Всегда новый формат с nonce+ttl (закрывает §1.14). Legacy-формат (подпись
   * голого nonce) здесь недоступен намеренно: он совпадает с форматом
   * авторизации прокси, и выданную миниаппе подпись можно было бы переиграть
   * в `auth:true`-эндпоинтах (S50).
   */
  signApiMessage(data: string, options?: { expiration?: number }): ApiSignature | null
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
  /**
   * `appName` показывается в модале — пользователь видит, кто просит денег (N22).
   * `appId` — чьим действием записать отправленный платёж.
   */
  openPaymentDialog(
    payment: unknown,
    appName?: string,
    appId?: string,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>>
  /**
   * Платёж по ссылке магазина (`sdk.ext(payment)`): разбирает ссылку, открывает
   * окно оплаты и сразу отвечает `application:ext:opened`, как прежний клиент;
   * об оплате магазину сообщает адрес из ссылки. `share` в ссылке открывает
   * окно поста. Плохая ссылка — `application:ext:notopened` (код — в `code`).
   */
  openExternalPayment(extHash: string, appName?: string, appId?: string): Promise<string>

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
    /**
     * `appId` — чьей страницей поделиться, если пришёл только `path`;
     * `appName` — тег поста при `onBastyon`.
     */
    opts?: { onBastyon?: boolean; appId?: string; appName?: string }
  ): Promise<void>
  /**
   * Окно жалобы на содержимое приложения (`{entityLink, entityTxid, entityType}`).
   * Ждёт, пока окно закроют; жалобу отправляет само окно.
   */
  openComplain(data: unknown, appName?: string, signal?: AbortSignal): Promise<void>
  /**
   * Действия приложения у текущего аккаунта — транзакции, отправленные по его
   * просьбе (`getactions` прежнего клиента), в форме `action.export()`.
   */
  getAppActions(appId: string): Promise<Record<string, unknown>[]>
  /** Одно действие приложения по id; null — нет такого. */
  getAppAction(appId: string, id: string): Promise<Record<string, unknown> | null>
  /**
   * Отправить транзакцию от имени пользователя по просьбе приложения и записать
   * её как действие приложения. Возвращает объект действия с `transaction`.
   */
  sendAppTransaction(
    appId: string,
    appName: string,
    obj: LegacyTxObject
  ): Promise<Record<string, unknown>>

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
   * Хост сверяется со списком инстансов от ноды, удаление подтверждает
   * пользователь (K2/Р7). Throws `not_authenticated`, `videos:remove:host_not_allowed`,
   * `videos:remove:denied`, `videos:remove:hosts_unavailable`.
   */
  removeVideo(pointer: string, opts: { appName: string }): Promise<void>

  /**
   * Сведения о роликах в форме прежнего клиента (`get.videos`): по каждой
   * ссылке `{link, meta, data}`, null — нода о ролике не знает.
   */
  getVideosInfo(urls: string[], update: boolean): Promise<Array<LegacyVideoItem | null>>
  /**
   * Окно загрузки своего ролика (`videos.opendialog`): `{link, name}` —
   * указатель `peertube://host/uuid` и имя; null — окно закрыли.
   */
  openVideoUploadDialog(appName: string, signal?: AbortSignal): Promise<UploadedAppVideo | null>

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
  const { useTheme } = await import('@/composables/use-theme')
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const { useTorStore } = await import('@/stores/tor-store')
  const { isTauri, isCapacitor } = await import('@/b-components/video-uploader/utils/environment')
  const { generateApiSignature } = await import('@/blockchain/core/signatures/api-signature')
  const { getWalletAddressesList } = await import('@/blockchain/storage')
  const { getByPRC } = await import('@/helpers/api/request')
  const { rpcEndpoints } = await import('@/helpers/api/rpc-endpoints')
  const { unwrapRpcResponse } = await import('@/helpers/common/response-parser')
  const { uploadImages } = await import('@/services/image-upload-service')
  const { removeVideoByPointer, getVideosInfo } =
    await import('@/services/peertube/peertube-videos')
  const { thumbnailOf } = await import('@/services/media/media-info')
  const { fetchPeertubeHostAllowlist } = await import('@/services/peertube/peertube-host')
  const { parsePeerTubeUrl } = await import('@/helpers/api/peertube-parser')
  const { confirmVideoRemoval } = await import('./host-context-methods/confirm-video-removal')
  const { sendLegacyTx } = await import('../tx/send-legacy-tx')
  const { usePendingTransactionsStore, isConfirmed } =
    await import('@/stores/pending-transactions-store')

  const device: HostDevice = opts.device ?? detectDevice(isTauri(), isCapacitor())

  const auth = createAuthMethods({ useAuthStore, generateApiSignature, getWalletAddressesList })
  const rpc = createRpcMethods({ useAuthStore, getByPRC, rpcEndpoints, unwrapRpcResponse })
  const openComposer = async (share: ComposerSharePrefill): Promise<void> => {
    const { useModalStore } = await import('@/stores/modal-store')
    const { isMobile } = await import('@mobile/utils/platform')
    const modalStore = useModalStore()
    // На телефоне окно поста — страница во весь экран, как у «Создать пост».
    if (isMobile()) {
      modalStore.postComposerModal.share = share
      void opts.router.push({ name: 'compose' })
      return
    }
    modalStore.openPostComposerModal({ share })
  }
  const content = createContentMethods({
    router: opts.router,
    openComposer,
    complain: async (req, signal) => {
      const { openComplainDialog } = await import('../ui/complain-dialog-controller')
      return openComplainDialog(req, signal)
    },
  })
  const payments = createPaymentMethods({
    getUserAddress: () => useAuthStore().address ?? null,
    openComposer,
    notifyMerchant: async (p, tx, contacts, account) => {
      const [{ notifyMerchant }, { appFetch }, { openExternal }] = await Promise.all([
        import('../tx/ext-callback'),
        import('@/helpers/api/fetch-strategies'),
        import('@/helpers/common/open-external'),
      ])
      return notifyMerchant(p, tx, contacts, account, {
        fetch: (url, init) => appFetch(url, init),
        openExternal: async (url) => {
          await openExternal(url)
        },
      })
    },
    warn: async (message) => {
      const { appToast } = await import('@/b-components/app-toast')
      appToast.warning({ message })
    },
  })
  const media = createMediaMethods({ isCapacitor })
  const currency = createCurrencyMethods({
    fetchProxy: async (path) => {
      const { fetchHttp } = await import('@/helpers/api/request')
      return fetchHttp({ path, data: {}, options: { auth: false } })
    },
  })
  const mediaUpload = createMediaUploadMethods({
    useAuthStore,
    uploadImages,
    removeVideoByPointer,
    parsePointer: parsePeerTubeUrl,
    fetchHostAllowlist: () => fetchPeertubeHostAllowlist(),
    confirmRemoval: confirmVideoRemoval,
  })
  const chat = createChatMethods({ router: opts.router })
  const videos = createVideoMethods({
    fetchInfo: async (urls, update) =>
      (await getVideosInfo({ urls, update })) as Map<string, Record<string, unknown>>,
    parsePointer: (url) => parsePeerTubeUrl(url),
    mediaUrl: (url, path) => (path ? thumbnailOf(url, { thumbnailPath: path }) : null),
    openDialog: async (appName, signal) => {
      const { openVideoDialog } = await import('../ui/video-dialog-controller')
      return openVideoDialog(appName, signal)
    },
  })
  const appTx = createAppTxMethods({
    getUserAddress: () => useAuthStore().address ?? null,
    send: (obj, pending) => sendLegacyTx(obj, pending),
    isStillPending: (txid) => usePendingTransactionsStore().items.some((i) => i.txid === txid),
    isConfirmedOnNode: async (txid) => {
      const raw = await getByPRC({
        method: rpcEndpoints.getRawTransaction,
        parameters: [txid, 1],
        options: { auth: false },
        cachehash: `${txid}-${Date.now()}`,
      })
      return isConfirmed(unwrapRpcResponse(raw), txid)
    },
  })

  return {
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    isProduction: import.meta.env?.MODE === 'production',
    device,
    transactionsApiVersion: 8,

    getLocale: () => useUIStore().language,
    // Тема — из use-theme (data-theme на <html>): поле ui-store.theme никто не писал (V42).
    getTheme: () => ({ rootid: useTheme().isDark.value ? 'dark' : 'light' }),
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

    // ─── domain methods (вынесены в host-context-methods/*) ────────────────
    ...auth,
    ...rpc,
    ...content,
    ...payments,
    ...media,
    ...currency,
    ...mediaUpload,
    ...chat,
    ...appTx,
    ...videos,
  }
}

// ─── ambient declarations ────────────────────────────────────────────────────
declare const __APP_VERSION__: string
