import { defineStore } from 'pinia'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import { IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'
import { pickGatewaySource, type IpfsConsent } from '@/helpers/ipfs/ipfs-tier'
import { useTorStore } from '@/stores/tor-store'

// Оркестрация докачиваемого модуля Kubo (Tier 1) + fallback на публичный шлюз
// (Tier 0). Клон паттерна tor-store: грубый `status` + тонкий `install`-прогресс,
// подписка на события бэкенда, идемпотентный `ensureRunning`.

export type IpfsStatus = 'off' | 'installing' | 'starting' | 'running' | 'failed'

/** Снапшот из бэкенда (ipfs_status / ipfs_ensure / событие ipfs:state). */
export type IpfsStateSnapshot = {
  status: IpfsStatus
  message?: string | null
  gateway_port: number
  installed: boolean
  update_available: boolean
}

export type IpfsInstallProgress = {
  phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready'
  fraction: number
  message: string
}

/** Откуда тянуть контент: локальная нода или публичный шлюз (URL собирает Rust). */
export type IpfsGatewaySource = 'local' | 'public'

/** Публикация из «Моих файлов» (реестр аккаунта ведёт Rust, src-tauri/src/ipfs/shares.rs). */
export type IpfsShare = {
  /** Корень ссылки: каталог-обёртка у публичного файла, шифртекст у приватного. */
  cid: string
  name: string
  size: number
  addedAt: number
  /** Ключ приватного файла; у публичного нет. */
  key?: string
}

/** Копия на удалённом pinning-сервисе. */
export type RemotePinStatus = 'queued' | 'pinning' | 'pinned' | 'failed'

export type IpfsModalPhase = 'consent' | 'progress' | 'desktop-only' | 'tor-blocked' | 'pin-config'

/** Выбор пользователя в consent-модалке: установить / явный отказ / закрыл. */
type ConsentChoice = 'install' | 'decline' | 'dismiss'

const LS_CONSENT = 'ipfs:consent'
/** Щедрый потолок ожидания: скачивание ~80 МБ + init + старт демона. */
const ENSURE_TIMEOUT_MS = 10 * 60 * 1000
/** После неудачного ensure не долбим бэкенд на каждый клик — окно тишины. */
const FAIL_COOLDOWN_MS = 30 * 1000

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI__' in window) return true
  if ('__TAURI_INTERNALS__' in window) return true
  if ('__TAURI_METADATA__' in window) return true
  try {
    return Object.keys(window).some((k) => k.startsWith('__TAURI'))
  } catch {
    return false
  }
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function tauriListen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<T>(event, (e) => cb(e.payload))
}

function loadConsent(): IpfsConsent {
  try {
    const raw = localStorage.getItem(LS_CONSENT)
    if (raw === 'accepted' || raw === 'declined') return raw
  } catch {
    // localStorage недоступен — считаем согласие неизвестным
  }
  return 'unknown'
}

function persistConsent(v: IpfsConsent): void {
  try {
    localStorage.setItem(LS_CONSENT, v)
  } catch {
    // не критично: не сохранили выбор — переспросим на следующем клике
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ipfs ensure timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

export const useIpfsStore = defineStore('ipfs', {
  state: () => ({
    available: isTauriEnv(),
    status: 'off' as IpfsStatus,
    gatewayPort: 0,
    message: null as string | null,
    installed: false,
    updateAvailable: false,
    pinServiceConfigured: false,
    /** «Мои файлы» аккаунта `sharesAccount`. */
    shares: [] as IpfsShare[],
    sharesAccount: '',
    /** CID → где копия на удалённом сервисе (только если он настроен). */
    remoteStatus: {} as Record<string, RemotePinStatus>,
    install: null as IpfsInstallProgress | null,
    consent: loadConsent() as IpfsConsent,
    modalOpen: false,
    modalPhase: 'consent' as IpfsModalPhase,
    _subscribed: false,
    _stateUnlisten: null as (() => void) | null,
    _installUnlisten: null as (() => void) | null,
    _ensurePromise: null as Promise<number | null> | null,
    // Одна consent-сессия на все конкурентные клики (иначе второй затрёт resolver
    // первого и его промис зависнет навсегда).
    _consentPromise: null as Promise<ConsentChoice> | null,
    _decisionResolver: null as ((choice: ConsentChoice) => void) | null,
    // Кнопка Cancel в прогресс-модалке: перестать ЖДАТЬ (докачка идёт в фоне).
    _cancelResolver: null as (() => void) | null,
    _cancelPromise: null as Promise<null> | null,
    _ensureWaiters: 0,
    _lastFailedAt: 0,
  }),

  getters: {
    localBase(state): string {
      return `http://127.0.0.1:${state.gatewayPort}`
    },
    busy(state): boolean {
      return state.status === 'installing' || state.status === 'starting'
    },
    /** Tor сейчас реально торифицирует трафик (для privacy-guard публичного шлюза). */
    torActive(): boolean {
      try {
        return useTorStore().shouldTorify
      } catch {
        return false
      }
    },
  },

  actions: {
    async hydrate(): Promise<void> {
      if (!this.available) return
      await this.subscribe()
      try {
        const snap = await tauriInvoke<IpfsStateSnapshot>('ipfs_status')
        this.applySnapshot(snap)
        if (this.status === 'running') void this.refreshPinService()
      } catch {
        // бэкенд ещё не готов — подтянем при первом действии
      }
    },

    async subscribe(): Promise<void> {
      if (this._subscribed) return
      this._subscribed = true
      try {
        this._stateUnlisten = await tauriListen<IpfsStateSnapshot>('ipfs:state', (snap) => {
          this.applySnapshot(snap)
        })
        this._installUnlisten = await tauriListen<IpfsInstallProgress>(
          'ipfs:install-progress',
          (progress) => {
            this.install = progress.phase === 'ready' ? null : progress
          }
        )
      } catch (e) {
        // Подписка не удалась (возможно, частично: первый listen прошёл, второй
        // нет) — снимаем то, что успело повеситься, иначе следующий hydrate
        // повесил бы `ipfs:state` второй раз.
        this._stateUnlisten?.()
        this._stateUnlisten = null
        this._installUnlisten?.()
        this._installUnlisten = null
        this._subscribed = false
        throw e
      }
    },

    applySnapshot(snap: IpfsStateSnapshot): void {
      this.status = snap.status
      this.gatewayPort = snap.gateway_port
      this.message = snap.message ?? null
      this.installed = snap.installed
      this.updateAvailable = snap.update_available
      // Прогресс скачивания — только пока идёт установка: после отмены или
      // ошибки полоска не должна застывать на последнем проценте.
      if (snap.status !== 'installing') this.install = null
    },

    setConsent(v: IpfsConsent): void {
      this.consent = v
      persistConsent(v)
    },

    openModal(phase: IpfsModalPhase): void {
      this.modalPhase = phase
      this.modalOpen = true
    },

    closeModal(): void {
      // Закрытие во время consent (крестик/маска/Esc) = «в этот раз через
      // публичный шлюз», НО без запоминания отказа — на следующем клике снова
      // предложим (dismiss ≠ явный decline).
      if (this.modalOpen && this.modalPhase === 'consent') {
        this._resolveDecision('dismiss')
      }
      this.modalOpen = false
    },

    showDesktopOnly(): void {
      this.openModal('desktop-only')
    },

    openPinConfig(): void {
      this.openModal('pin-config')
      void this.refreshPinService()
    },

    /** При включённом Tor не открываем публичный шлюз (деанон) — просим локальную ноду. */
    showTorBlocked(): void {
      this.openModal('tor-blocked')
    },

    // --- явное управление из хедера ---
    /** Установить (согласие явное) + запустить. Прогресс показывает хедер инлайном. */
    async enable(): Promise<void> {
      if (!this.available) {
        this.showDesktopOnly()
        return
      }
      this.setConsent('accepted')
      await this.ensureRunning()
    },

    async stop(): Promise<void> {
      if (!this.available) return
      try {
        const snap = await tauriInvoke<IpfsStateSnapshot>('ipfs_stop')
        this.applySnapshot(snap)
      } catch (e) {
        this.message = String(e)
      }
    },

    async uninstall(): Promise<void> {
      if (!this.available) return
      try {
        const snap = await tauriInvoke<IpfsStateSnapshot>('ipfs_uninstall')
        this.applySnapshot(snap)
        // Сброс согласия: после удаления снова спросим на следующем клике.
        this.setConsent('unknown')
      } catch (e) {
        this.message = String(e)
      }
    },

    /**
     * Опубликовать файл в IPFS (write-сторона). Поднимает ноду (если надо),
     * добавляет файл, возвращает CID (или null при ошибке/отмене). Контент
     * ПУБЛИЧНЫЙ и жив, пока эта нода онлайн (или CID запинен где-то ещё).
     */
    /**
     * Публикация файла. Файл выбирается в НАТИВНОМ диалоге на стороне Rust —
     * путь из webview не передаётся (иначе XSS публиковал бы любой файл).
     * Публикация попадает в «Мои файлы» аккаунта. null — отмена диалога или
     * ошибка (см. message).
     */
    async addFile(account: string): Promise<IpfsShare | null> {
      return this._publish('ipfs_add', account)
    },

    /**
     * Приватная публикация: файл из нативного диалога (Rust), шифруем и кладём
     * шифртекст в IPFS. Ключ едет во фрагменте ссылки и хранится в «Моих файлах».
     */
    async addFileEncrypted(account: string): Promise<IpfsShare | null> {
      return this._publish('ipfs_add_encrypted', account)
    },

    async _publish(
      command: 'ipfs_add' | 'ipfs_add_encrypted',
      account: string
    ): Promise<IpfsShare | null> {
      if (!this.available) {
        this.showDesktopOnly()
        return null
      }
      // Явная публикация = согласие на локальную ноду.
      this.setConsent('accepted')
      const port = await this.ensureRunning()
      if (!port) return null
      try {
        const share = await tauriInvoke<IpfsShare | null>(command, { account })
        if (!share) return null
        if (this.sharesAccount === account) {
          this.shares = [share, ...this.shares.filter((s) => s.cid !== share.cid)]
        }
        if (this.pinServiceConfigured) void this.pinRemote(share.cid)
        return share
      } catch (e) {
        this.message = String(e)
        return null
      }
    },

    /** «Мои файлы» аккаунта — из реестра в Rust. */
    async loadShares(account: string): Promise<void> {
      if (!this.available || !account) return
      this.shares = await tauriInvoke<IpfsShare[]>('ipfs_shares', { account })
      this.sharesAccount = account
    },

    /** Перестать раздавать: pin снимается у себя и на сервисе (если файл не раздаёт другой аккаунт). */
    async unshare(account: string, cid: string): Promise<void> {
      await tauriInvoke('ipfs_unshare', { account, cid })
      if (this.sharesAccount === account) this.shares = this.shares.filter((s) => s.cid !== cid)
      const rest = { ...this.remoteStatus }
      delete rest[cid]
      this.remoteStatus = rest
    },

    /** Где копии на удалённом сервисе. Без сервиса — пусто. */
    async refreshShareStatus(account: string): Promise<void> {
      if (!this.available || !account) return
      try {
        this.remoteStatus = await tauriInvoke<Record<string, RemotePinStatus>>(
          'ipfs_share_status',
          { account }
        )
      } catch {
        // сервис недоступен — статусы просто не обновились
      }
    },

    /** Аккаунт удалён с устройства: его файлы больше не раздаются. */
    async forgetAccount(account: string): Promise<void> {
      if (!this.available || !account) return
      try {
        await tauriInvoke('ipfs_forget_account', { account })
      } catch {
        // модуль не установлен — раздавать и нечего
      }
      if (this.sharesAccount === account) {
        this.shares = []
        this.sharesAccount = ''
      }
    },

    /**
     * Тянет шифртекст (источник — не URL, а 'local' | 'public': URL собирает Rust
     * по белому списку), расшифровывает и пишет туда, куда пользователь укажет в
     * нативном save-диалоге (Rust). 'saved' | 'cancelled' | 'failed'.
     */
    async saveEncrypted(
      source: IpfsGatewaySource,
      cid: string,
      key: string,
      suggestedName: string
    ): Promise<'saved' | 'cancelled' | 'failed'> {
      try {
        const saved = await tauriInvoke<boolean>('ipfs_save_encrypted', {
          source,
          cid,
          key,
          suggestedName,
        })
        return saved ? 'saved' : 'cancelled'
      } catch (e) {
        this.message = String(e)
        return 'failed'
      }
    },

    /**
     * Сохранить файл по ссылке. Диалог и сборка URL — в Rust (путь из webview
     * не принимается); с публичного шлюза файл проверяется по CID, с локальной
     * ноды — идёт потоком (её блоки проверяет сама нода). В message — код
     * ошибки Rust (`verify-mismatch`, `verify-unsupported`, …).
     */
    async saveFile(
      source: IpfsGatewaySource,
      target: IpfsTarget,
      suggestedName: string
    ): Promise<'saved' | 'cancelled' | 'failed'> {
      try {
        const saved = await tauriInvoke<boolean>('ipfs_save', {
          source,
          namespace: target.namespace,
          root: target.root,
          path: target.path,
          suggestedName,
        })
        return saved ? 'saved' : 'cancelled'
      } catch (e) {
        this.message = String(e)
        return 'failed'
      }
    },

    /**
     * Окно-просмотрщик создаёт Rust (incognito + on_navigation по белому списку);
     * повторный вызов с той же меткой — фокус существующего.
     */
    async openViewer(label: string, url: string, title: string): Promise<void> {
      await tauriInvoke('ipfs_open_viewer', { label, url, title })
    },

    // --- удалённый pin (Ф5c, durability) ---
    async refreshPinService(): Promise<void> {
      if (!this.available) return
      try {
        this.pinServiceConfigured = await tauriInvoke<boolean>('ipfs_pin_service_status')
      } catch {
        this.pinServiceConfigured = false
      }
    },

    /** Настроить удалённый pinning-сервис (endpoint + токен). Нужна поднятая нода. */
    async setPinService(endpoint: string, key: string): Promise<boolean> {
      if (!this.available) {
        this.showDesktopOnly()
        return false
      }
      const port = await this.ensureRunning()
      if (!port) return false
      try {
        await tauriInvoke('ipfs_pin_service_set', { endpoint, key })
        await this.refreshPinService()
        return this.pinServiceConfigured
      } catch (e) {
        this.message = String(e)
        return false
      }
    },

    async clearPinService(): Promise<void> {
      if (!this.available) return
      try {
        await tauriInvoke('ipfs_pin_service_clear')
      } catch {
        // best-effort
      }
      this.pinServiceConfigured = false
    },

    /** Запинить CID на удалённом сервисе (best-effort, фоном). */
    async pinRemote(cid: string): Promise<void> {
      try {
        await tauriInvoke('ipfs_pin_remote', { cid })
      } catch {
        // без сервиса/недоступен — durability просто не добавили
      }
    },

    /** Обновление: снести бинарь (repo сохраняется) и переустановить запиненную версию. */
    async update(): Promise<void> {
      if (!this.available) return
      try {
        const snap = await tauriInvoke<IpfsStateSnapshot>('ipfs_update')
        this.applySnapshot(snap)
      } catch (e) {
        this.message = String(e)
        return
      }
      await this.ensureRunning()
    },

    // --- кнопки consent-модалки ---
    chooseInstall(): void {
      this._resolveDecision('install')
    },
    /** Явный выбор «через публичный шлюз» — запоминаем отказ. */
    choosePublic(): void {
      this._resolveDecision('decline')
    },
    _resolveDecision(choice: ConsentChoice): void {
      const r = this._decisionResolver
      this._decisionResolver = null
      this._consentPromise = null
      if (r) r(choice)
    },

    /** Кнопка Cancel в прогресс-модалке: прекратить ожидание установки. */
    cancelInstall(): void {
      const r = this._cancelResolver
      this._cancelResolver = null
      if (r) r()
    },

    /**
     * Отменить саму установку: скачивание прерывается, недокачанное удаляется.
     * Ссылка, ради которой ставили, откроется через публичный шлюз, а согласие
     * сбрасывается — на следующем клике спросим снова, а не начнём качать молча.
     */
    async abortInstall(): Promise<void> {
      this.setConsent('unknown')
      this.cancelInstall()
      try {
        await tauriInvoke('ipfs_cancel_install')
      } catch {
        // бэкенд не ответил — установка завершится сама, ждать её уже некому
      }
    },

    /** Одна consent-сессия: конкурентные клики ждут один и тот же диалог. */
    askConsent(): Promise<ConsentChoice> {
      if (this._consentPromise) return this._consentPromise
      this._consentPromise = new Promise<ConsentChoice>((resolve) => {
        this._decisionResolver = resolve
      })
      this.openModal('consent')
      return this._consentPromise
    },

    /** Идемпотентно: установить (если нужно) + запустить демон. Порт или null. */
    async ensureRunning(): Promise<number | null> {
      if (this.status === 'running' && this.gatewayPort) return this.gatewayPort
      if (this._ensurePromise) return this._ensurePromise
      this._ensurePromise = (async () => {
        try {
          const snap = await withTimeout(
            tauriInvoke<IpfsStateSnapshot>('ipfs_ensure'),
            ENSURE_TIMEOUT_MS
          )
          this.applySnapshot(snap)
          if (snap.status === 'running') return snap.gateway_port
          // Установку отменили (abortInstall) — это не сбой, паузы не нужно.
          if (snap.status === 'off') return null
          // Не running без исключения (напр. демон не поднялся) — фиксируем как
          // фейл, иначе _recentlyFailed() не даёт cooldown и ensure долбится.
          this.status = 'failed'
          this._lastFailedAt = Date.now()
          return null
        } catch (e) {
          this.status = 'failed'
          this.message = String(e)
          this._lastFailedAt = Date.now()
          return null
        } finally {
          this._ensurePromise = null
        }
      })()
      return this._ensurePromise
    },

    /**
     * Гонка «дождаться установки» против кнопки Cancel (докачка не прерывается).
     * Конкурентные вызовы делят ОДИН cancel-промис: иначе второй клик перезаписал
     * бы резолвер, Cancel отпускал бы только последнего ждущего, а первый
     * досиживал бы до 10 мин и потом закрывал бы чужую модалку.
     */
    _ensureOrCancel(): Promise<number | null> {
      if (!this._cancelPromise) {
        this._cancelPromise = new Promise<null>((resolve) => {
          this._cancelResolver = () => resolve(null)
        })
      }
      const cancelled = this._cancelPromise
      const waiters = ++this._ensureWaiters
      void waiters
      return Promise.race([this.ensureRunning(), cancelled]).finally(() => {
        if (--this._ensureWaiters <= 0) {
          this._ensureWaiters = 0
          this._cancelPromise = null
          this._cancelResolver = null
        }
      })
    },

    _recentlyFailed(): boolean {
      return this.status === 'failed' && Date.now() - this._lastFailedAt < FAIL_COOLDOWN_MS
    },

    /**
     * Главная точка для перехватчика ссылок: вернуть базовый URL шлюза.
     * Локальная нода (Tier 1) при готовности/согласии, иначе публичный (Tier 0).
     */
    async resolveGateway(): Promise<string> {
      const src = pickGatewaySource({
        available: this.available,
        running: this.status === 'running',
        hasPort: this.gatewayPort > 0,
        consent: this.consent,
      })

      if (src === 'public') return IPFS_GATEWAY
      if (src === 'local') return this.localBase
      // Устойчивый недавний фейл — не долбим ensure, идём на публичный шлюз.
      if (src === 'ensure' && this._recentlyFailed()) return IPFS_GATEWAY

      if (src === 'ask') {
        const choice = await this.askConsent()
        if (choice === 'decline') {
          this.setConsent('declined')
          this.closeModal()
          return IPFS_GATEWAY
        }
        if (choice === 'dismiss') {
          // consent остаётся unknown — предложим снова на следующем клике
          this.closeModal()
          return IPFS_GATEWAY
        }
        this.setConsent('accepted')
      }

      // src === 'ensure' или пользователь только что согласился — ставим/запускаем.
      this.openModal('progress')
      const port = await this._ensureOrCancel()
      // Закрываем только СВОЮ прогресс-модалку: пока ждали, пользователь мог
      // открыть другую (pin-config) — её не трогаем.
      if (this.modalPhase === 'progress') this.closeModal()
      return port ? this.localBase : IPFS_GATEWAY
    },
  },
})
