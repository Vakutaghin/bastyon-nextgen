import { defineStore } from 'pinia'
import { IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'
import { pickGatewaySource, type IpfsConsent } from '@/helpers/ipfs/ipfs-tier'

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
}

export type IpfsInstallProgress = {
  phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready'
  fraction: number
  message: string
}

export type IpfsModalPhase = 'consent' | 'progress' | 'desktop-only'

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
    _lastFailedAt: 0,
  }),

  getters: {
    localBase(state): string {
      return `http://127.0.0.1:${state.gatewayPort}`
    },
    busy(state): boolean {
      return state.status === 'installing' || state.status === 'starting'
    },
  },

  actions: {
    async hydrate(): Promise<void> {
      if (!this.available) return
      await this.subscribe()
      try {
        const snap = await tauriInvoke<IpfsStateSnapshot>('ipfs_status')
        this.applySnapshot(snap)
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
        // Подписка не удалась — сбрасываем флаг, чтобы следующий hydrate повторил.
        this._subscribed = false
        throw e
      }
    },

    applySnapshot(snap: IpfsStateSnapshot): void {
      this.status = snap.status
      this.gatewayPort = snap.gateway_port
      this.message = snap.message ?? null
      this.installed = snap.installed
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

    /** Гонка «дождаться установки» против кнопки Cancel (докачка не прерывается). */
    _ensureOrCancel(): Promise<number | null> {
      const cancelled = new Promise<null>((resolve) => {
        this._cancelResolver = () => resolve(null)
      })
      return Promise.race([this.ensureRunning(), cancelled]).finally(() => {
        this._cancelResolver = null
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
      this.closeModal()
      return port ? this.localBase : IPFS_GATEWAY
    },
  },
})
