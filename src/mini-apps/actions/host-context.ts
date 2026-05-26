/**
 * HostContext — узкий интерфейс между action handler'ами и хост-приложением.
 *
 * Цель: не давать handler'ам импортировать конкретные сторы/роутер/UI-модалки
 * напрямую. Это:
 * - тестируется тривиально (моки HostContext);
 * - позволяет менять реализацию стора без перетряхивания всех action'ов;
 * - даёт явный аудит того, что вообще делает host.
 *
 * Дефолтная prod-реализация — в {@link createDefaultHostContext}.
 */

import type { Router } from 'vue-router'
import type { ApiSignature } from '@/blockchain/types/signatures'

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

  // ─── chat (5.7) ────────────────────────────────────────────────────────
  /** Открывает room в Matrix-чате. */
  chatOpenRoom(roomid: string): Promise<void>
  /**
   * Создаёт или возвращает существующую комнату с пользователями.
   * MVP: throws `not_implemented` пока nextgen не подключит Matrix API для миниапп.
   */
  chatGetOrCreateRoom(users: string[], parameters?: unknown): Promise<Record<string, unknown>>
  /** Шлёт сообщение в комнату. MVP: throws. */
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
  const { getByPRC } = await import('@/helpers/api/request')
  const { rpcEndpoints } = await import('@/helpers/api/rpc-endpoints')
  const { unwrapRpcResponse } = await import('@/helpers/common/response-parser')

  const device: HostDevice = opts.device ?? detectDevice(isTauri(), isCapacitor())

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

    openRegistration: async () => {
      const { useModalStore } = await import('@/stores/modal-store')
      useModalStore().openAuthModal('register')
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

    signApiMessage: (data, options = {}) => {
      const auth = useAuthStore()
      if (!auth.keyPair || !auth.address) return null
      return generateApiSignature(auth.keyPair, auth.address, {
        data,
        expiration: options.expiration,
        useOldFormat: options.useOldFormat,
      })
    },

    getCurrentAccountStatus: () => {
      // Legacy `account.getStatus()` отдавал балансы/permissions/etc. В nextgen
      // эту аггрегацию делает отдельный composable; для миниаппы достаточно
      // получить address + signature — статус они подтягивают через `balance`
      // action отдельно.
      return undefined
    },

    // TODO: end-to-end AbortSignal в RPC-слой. Сейчас `getByPRC` его не
    // принимает — bridge всё равно установит таймаут на свою сторону через
    // `DEFAULT_RPC_TIMEOUT_MS`, но прервать уже отправленный fetch к ноде
    // мы не можем.

    callRpc: async (method, parameters = [], options = {}) => {
      // Pocketnet RPC всегда отдаёт обёртку `{result, data, node, time}` —
      // снимаем её и пробрасываем только `data` миниаппе. Legacy ровно так
      // и делает (миниаппы пишут `.map` сразу на результате).
      const raw = await getByPRC({
        method,
        parameters,
        options: { auth: false, ...options },
      } as Parameters<typeof getByPRC>[0])
      if (
        raw &&
        typeof raw === 'object' &&
        'result' in raw &&
        (raw as { result: string }).result === 'error'
      ) {
        const err = (raw as { error?: string }).error ?? 'rpc_error'
        throw new Error(err)
      }
      return unwrapRpcResponse(raw) ?? raw
    },

    getUserBalance: async () => {
      const auth = useAuthStore()
      if (!auth.address) return {}
      const raw = await getByPRC({
        method: rpcEndpoints.getAddressInfo,
        parameters: [auth.address],
        options: { auth: false },
      })
      const data = unwrapRpcResponse<Record<string, unknown>>(raw)
      return data ?? {}
    },

    getCurrentBlockHeight: async () => {
      const raw = await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      })
      const data = unwrapRpcResponse<{ lastblock?: { height?: number } }>(raw)
      const height = data?.lastblock?.height
      if (typeof height !== 'number') {
        throw new Error('actions_currentBlock_not_defined')
      }
      return height
    },

    // ─── payments ──────────────────────────────────────────────────────────
    openPaymentDialog: async (_payment) => {
      // TODO(etap 7+): подключить wallet UI nextgen. Возвращаем «rejected» в legacy-формате,
      // чтобы миниаппа корректно отреагировала вместо повисания.
      return { rejected: true, reason: 'payment_ui_not_implemented' }
    },

    openExternalPayment: async (_extHash) => {
      throw new Error('ext_payment_not_implemented')
    },

    // ─── content ───────────────────────────────────────────────────────────
    openPost: async (txid) => {
      // Legacy открывает modal с постом. У нас в nextgen post-modal через ?p=<txid>.
      void opts.router.push({ path: '/', query: { p: txid } })
    },

    openDonation: async (receiver) => {
      // Открываем профиль получателя — оттуда уже доступна донат-кнопка.
      void opts.router.push(`/${receiver}`)
    },

    openExternalLink: async (url) => {
      // В Tauri/Capacitor желательно открывать в системном браузере, но `window.open`
      // в обоих окружениях обычно делегируется правильно.
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },

    share: async (data, sharePref = {}) => {
      const url =
        data.url ??
        (data.path
          ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${data.path.replace(/^\/+/, '')}`
          : typeof window !== 'undefined'
            ? window.location.href
            : '')

      if (sharePref.onBastyon) {
        // Внутренний шаринг: открываем форму создания поста с pre-fill.
        void opts.router.push({ path: '/', query: { share: url } })
        return
      }

      // Web Share API если есть, иначе fallback на копирование в clipboard.
      const nav = typeof navigator !== 'undefined' ? navigator : undefined
      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({ url })
          return
        } catch {
          // ignored — пользователь отменил или Web Share не поддерживается
        }
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url)
      }
    },

    openComplain: async (_data) => {
      // TODO(etap 7+): подключить complain modal. Сейчас игнорим silently —
      // миниаппа получает успех, пользовательский UI отсутствует.
    },

    getPendingActions: () => {
      // Legacy: pending actions = транзакции в mempool. Pending tx store
      // ещё не подключён к миниаппам в nextgen.
      return []
    },

    // ─── chat ──────────────────────────────────────────────────────────────
    chatOpenRoom: async (roomid) => {
      void opts.router.push({ path: '/messages', query: { room: roomid } })
    },

    chatGetOrCreateRoom: async (_users, _parameters) => {
      throw new Error('chat_get_or_create_not_implemented')
    },

    chatSendMessage: async (_roomid, _content) => {
      throw new Error('chat_send_not_implemented')
    },
  }
}

function detectDevice(tauri: boolean, capacitor: boolean): HostDevice {
  if (tauri) return 'tauri'
  if (capacitor) {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      if (/iphone|ipad|ipod/.test(ua)) return 'capacitor_ios'
      if (/android/.test(ua)) return 'capacitor_android'
    }
    return 'capacitor_android'
  }
  return 'browser'
}

function browserGeolocation(
  signal?: AbortSignal
): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('location:notavailable'))
      return
    }
    if (signal?.aborted) {
      reject(new Error('location:aborted'))
      return
    }
    const watchId = navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('location:notavailable')),
      { enableHighAccuracy: false, timeout: 15_000 }
    )
    signal?.addEventListener('abort', () => {
      // navigator.geolocation API не имеет явного cancel для getCurrentPosition,
      // но watchId здесь undefined — оставляем reject через ошибку.
      void watchId
      reject(new Error('location:aborted'))
    })
  })
}

// ─── ambient declarations ────────────────────────────────────────────────────
declare const __APP_VERSION__: string

// ─── constants ───────────────────────────────────────────────────────────────

/**
 * Archived peertube-серверы — раньше использовались для хостинга видео
 * пользователей Bastyon. Сейчас выведены из эксплуатации, видео перенесены
 * на `peertube.archive.pocketnet.app`. SDK миниапп ремапит URL'ы через этот
 * список (`sdk.manageBastyonImageSrc`).
 *
 * Синхронизирован с legacy `project_config.archivedPeertubeServers`.
 * При появлении новых архивных серверов — добавлять сюда.
 */
const ARCHIVED_PEERTUBE_SERVERS: readonly string[] = [
  'pocketnetpeertube1.nohost.me',
  'pocketnetpeertube2.nohost.me',
  'pocketnetpeertube5.nohost.me',
  'pocketnetpeertube7.nohost.me',
  'pocketnetpeertube4.nohost.me',
  'pocketnetpeertube6.nohost.me',
  'pocketnetpeertube8.nohost.me',
  'pocketnetpeertube9.nohost.me',
  'pocketnetpeertube10.nohost.me',
  'pocketnetpeertube11.nohost.me',
  'bastyonmma.pocketnet.app',
  'bastyonmma.nohost.me',
  '01rus.nohost.me',
  '02rus.pocketnet.app',
  'pocketnetpeertube12.nohost.me',
  'pocketnetpeertube13.nohost.me',
  'peertube14.pocketnet.app',
  'peertube15.pocketnet.app',
  'peertube18.pocketnet.app',
  'peertube17mirror.pocketnet.app',
  'peertube18mirror.pocketnet.app',
  'peertube19mirror.pocketnet.app',
  'peertube20.pocketnet.app',
  'peertube21.pocketnet.app',
  'peertube22.pocketnet.app',
  'peertube23.pocketnet.app',
  'peertube24.pocketnet.app',
  'peertube25.pocketnet.app',
  'peertube25mirror.pocketnet.app',
  'peertube26.pocketnet.app',
  'peertube26mirror.pocketnet.app',
  'peertube27.pocketnet.app',
  'peertube29.pocketnet.app',
  'peertube30.pocketnet.app',
  'peertube5new.pocketnet.app',
  'peertube4new.pocketnet.app',
  'peertube31.pocketnet.app',
  'peertube32.pocketnet.app',
  'peertube34.pocketnet.app',
  'peertube35.pocketnet.app',
] as const
