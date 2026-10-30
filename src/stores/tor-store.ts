import { defineStore } from 'pinia'

import {
  guardWebView,
  isAndroidTor,
  torInvoke,
  torListen,
  webViewThroughTor,
} from '@/helpers/tor/tor-bridge'
import {
  routingModeOf,
  TOR_ENABLED_KEY as LS_ENABLED,
  type TorRoutingMode,
} from '@/helpers/tor/tor-gate'
import { isTorMediaPolicyApplied } from '@/helpers/tor/tor-media-policy'

export type TorStatus = 'off' | 'installing' | 'starting' | 'bootstrapping' | 'ready' | 'failed'

/**
 * `auto` — мосты по стране через Moat, как Connection Assist в Tor Browser
 * (src-tauri/crates/bastyon-tor/src/connect.rs). `meek` — встроенный meek_lite через CDN.
 */
export type TorBridgeKind = 'none' | 'auto' | 'snowflake' | 'obfs4' | 'meek' | 'custom'

export const TOR_BRIDGE_KINDS: readonly TorBridgeKind[] = [
  'auto',
  'none',
  'snowflake',
  'obfs4',
  'meek',
  'custom',
]

/** Тот, кто мосты не выбирал, получает автоподбор: из РФ без мостов Tor не подключается. */
export const DEFAULT_BRIDGE_KIND: TorBridgeKind = 'auto'

/** Ошибки со своим текстом в меню (src-tauri/crates/bastyon-tor/src/state.rs, TorErrorCode). */
export type TorErrorCode = 'all_methods_failed' | 'no_valid_bridges'

export type TorStateSnapshot = {
  status: TorStatus
  bootstrap_pct: number
  message?: string | null
  socks_port: number
  control_port: number
  use_bridges: boolean
  bridge_kind: TorBridgeKind
  /** Чем подключается текущая попытка: `direct`, `snowflake`, `webtunnel`… */
  active_transport?: string | null
  /** Номер попытки автоподбора, с 1. */
  attempt?: number
  /** Страна по данным Moat (`ru`). */
  country?: string | null
  /** Бутстрап давно не двигается — способ, похоже, заблокирован. */
  stalled?: boolean
  /** Идёт запрос мостов у Moat. */
  fetching_bridges?: boolean
  error_code?: TorErrorCode | null
}

type TorBridgesResult = { snapshot: TorStateSnapshot; rejected: string[] }

export type TorRequestedBridges = { country: string | null; bridges: string[] }

export type TorInstallProgress = {
  phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready'
  fraction: number
  message: string
}

const LS_BRIDGES_USE = 'tor:bridges:use'
const LS_BRIDGES_KIND = 'tor:bridges:kind'
const LS_BRIDGES_CUSTOM = 'tor:bridges:custom'

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  // Tauri инжектит глобалы (__TAURI__ и т.п.) как реальные объекты — детектим через `in`.
  if ('__TAURI__' in window) return true
  if ('__TAURI_INTERNALS__' in window) return true
  if ('__TAURI_METADATA__' in window) return true
  try {
    return Object.keys(window).some((k) => k.startsWith('__TAURI'))
  } catch {
    return false
  }
}

function loadBool(key: string, def: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return def
    return raw === '1' || raw === 'true'
  } catch {
    return def
  }
}

function loadString(key: string, def: string): string {
  try {
    return localStorage.getItem(key) ?? def
  } catch {
    return def
  }
}

/** Сохранённый выбор; незнакомое значение — автоподбор. */
function loadBridgeKind(): TorBridgeKind {
  const raw = loadString(LS_BRIDGES_KIND, DEFAULT_BRIDGE_KIND)
  return (TOR_BRIDGE_KINDS as readonly string[]).includes(raw)
    ? (raw as TorBridgeKind)
    : DEFAULT_BRIDGE_KIND
}

function persistBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* best-effort */
  }
}

function persistString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* best-effort */
  }
}

const enabledListeners = new Set<() => void>()

/**
 * Tor включили (не при запуске с уже включённым): соединения, открытые до
 * этого напрямую, переоткрываются через Tor. Возвращает отписку.
 */
export function onTorEnabled(cb: () => void): () => void {
  enabledListeners.add(cb)
  return () => enabledListeners.delete(cb)
}

/** Вынесено, чтобы тесты стора подменяли перезагрузку. */
export const torStoreHooks = {
  reload: (): void => {
    if (typeof window !== 'undefined') window.location.reload()
  },
}

function reloadDocument(): void {
  torStoreHooks.reload()
}

export const useTorStore = defineStore('tor', {
  state: () => ({
    /** Компьютер (Tor скачивается) или Android (Tor в APK, `builtin`). */
    available: isTauriEnv() || isAndroidTor(),
    builtin: isAndroidTor(),
    enabled: loadBool(LS_ENABLED, false),
    status: 'off' as TorStatus,
    bootstrapPct: 0,
    message: null as string | null,
    socksPort: 9250,
    install: null as TorInstallProgress | null,
    useBridges: loadBridgeKind() !== 'none',
    bridgeKind: loadBridgeKind(),
    customBridges: loadString(LS_BRIDGES_CUSTOM, ''),
    activeTransport: null as string | null,
    attempt: 0,
    country: null as string | null,
    stalled: false,
    fetchingBridges: false,
    errorCode: null as TorErrorCode | null,
    /** Строки «Своих мостов», которые бэкенд не признал мостом. */
    rejectedBridges: [] as string[],
    /** Tor скачан (настройки → «Модули»); null — ещё не спрашивали. */
    installed: null as boolean | null,
    _subscribed: false,
    _stateUnlisten: null as (() => void) | null,
    _installUnlisten: null as (() => void) | null,
  }),

  getters: {
    isReady(state): boolean {
      return state.enabled && state.status === 'ready'
    },
    /**
     * Пользователь включил Tor. Пока он не `ready`, запросы ждут
     * или падают — но не идут напрямую (V20). Медиа-политика тоже от этого флага.
     */
    wantsTor(state): boolean {
      return state.enabled && state.available
    },
    /**
     * Картинки, видео и фреймы окна пошли бы мимо Tor — их показывают по
     * нажатию через Tor (V21). На Android окно само ходит через Tor.
     */
    mediaBypassesTor(state): boolean {
      return state.enabled && state.available && !webViewThroughTor()
    },
    /** direct | tor | wait | failed — см. `helpers/tor/tor-gate`. */
    routingMode(state): TorRoutingMode {
      return routingModeOf(state)
    },
    /** Tor реально готов принимать трафик прямо сейчас. */
    shouldTorify(state): boolean {
      return state.enabled && state.status === 'ready' && state.available
    },
    isBusy(state): boolean {
      return (
        state.status === 'installing' ||
        state.status === 'starting' ||
        state.status === 'bootstrapping'
      )
    },
  },

  actions: {
    async hydrate(): Promise<void> {
      if (!this.available) return
      // Флаг из localStorage: политика нужна до первого рендера, не после tor_start.
      if (this.enabled) await guardWebView()
      await this.subscribe()
      // Мосты — до снимка: у только что запущенного Rust они по умолчанию
      // (`none`), и снимок затирал сохранённый выбор, а pushBridges отправлял
      // `none` обратно — после перезапуска Tor подключался без мостов.
      await this.pushBridges().catch(() => {})
      try {
        const snap = await torInvoke<TorStateSnapshot>('tor_status')
        this.applySnapshot(snap)
      } catch {
        // backend not ready — will retry on next user action
      }

      if (this.enabled && this.status === 'off') {
        await this.enable()
      } else if (!this.enabled && this.builtin) {
        // Android помнит «Tor включён» сам (прокси окна до загрузки), а
        // данные окна могли стереть: включён ли Tor, решает этот флаг.
        await torInvoke('tor_stop').catch(() => {})
      }
    },

    async subscribe(): Promise<void> {
      if (this._subscribed) return
      this._subscribed = true
      this._stateUnlisten = await torListen<TorStateSnapshot>('tor:state', (snap) => {
        this.applySnapshot(snap)
      })
      this._installUnlisten = await torListen<TorInstallProgress>(
        'tor:install-progress',
        (progress) => {
          this.install = progress
          if (progress.phase === 'ready') {
            // installer finished; backend will move into Starting/Bootstrapping next.
            this.install = null
          }
        }
      )
    },

    applySnapshot(snap: TorStateSnapshot): void {
      this.status = snap.status
      this.bootstrapPct = snap.bootstrap_pct
      this.message = snap.message ?? null
      this.socksPort = snap.socks_port
      this.useBridges = snap.use_bridges
      this.bridgeKind = snap.bridge_kind
      this.activeTransport = snap.active_transport ?? null
      this.attempt = snap.attempt ?? 0
      this.country = snap.country ?? null
      this.stalled = snap.stalled ?? false
      this.fetchingBridges = snap.fetching_bridges ?? false
      this.errorCode = snap.error_code ?? null
    },

    async enable(): Promise<void> {
      if (!this.available) return
      const turnedOn = !this.enabled
      this.enabled = true
      persistBool(LS_ENABLED, true)
      // До tor_start: картинки/фреймы не должны успеть уйти мимо Tor (V21).
      await guardWebView()
      if (turnedOn) {
        for (const cb of enabledListeners) {
          try {
            cb()
          } catch {
            /* слушатель сам разберётся */
          }
        }
      }
      try {
        await this.pushBridges()
        const snap = await torInvoke<TorStateSnapshot>('tor_start')
        this.applySnapshot(snap)
      } catch (e) {
        this.status = 'failed'
        this.message = String(e)
      }
    },

    /**
     * `keepPolicy` — для перезапуска (мосты): CSP остаётся, перезагрузки нет.
     * Иначе, если медиа-политика была применена, документ перезагружается —
     * meta-CSP снять нельзя, а без этого картинки так и не загрузятся.
     */
    async disable(opts: { keepPolicy?: boolean } = {}): Promise<void> {
      this.enabled = false
      persistBool(LS_ENABLED, false)
      if (!this.available) return
      try {
        const snap = await torInvoke<TorStateSnapshot>('tor_stop')
        this.applySnapshot(snap)
      } catch {
        // backend already stopped or unreachable
      }
      if (!opts.keepPolicy && isTorMediaPolicyApplied()) {
        reloadDocument()
      }
    },

    async refreshInstalled(): Promise<void> {
      if (!this.available) return
      this.installed = await torInvoke<boolean>('tor_installed').catch(() => null)
    },

    /**
     * «Удалить» в настройках → «Модули». Только выключенный: файлы работающего
     * tor не удалить. Скачается снова, когда Tor включат. false — не вышло.
     */
    async uninstall(): Promise<boolean> {
      if (!this.available || this.builtin || this.enabled) return false
      try {
        await torInvoke('tor_uninstall')
        return true
      } catch {
        return false
      } finally {
        await this.refreshInstalled()
      }
    },

    async toggle(): Promise<void> {
      if (this.enabled) {
        await this.disable()
      } else {
        await this.enable()
      }
    },

    setBridgeConfig(opts: {
      useBridges: boolean
      kind: TorBridgeKind
      customBridges?: string
    }): void {
      this.useBridges = opts.useBridges
      this.bridgeKind = opts.kind
      if (opts.customBridges !== undefined) {
        this.customBridges = opts.customBridges
      }
      persistBool(LS_BRIDGES_USE, this.useBridges)
      persistString(LS_BRIDGES_KIND, this.bridgeKind)
      persistString(LS_BRIDGES_CUSTOM, this.customBridges)
    },

    async pushBridges(): Promise<void> {
      if (!this.available) return
      const lines = this.customBridges
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      try {
        const result = await torInvoke<TorBridgesResult>('tor_set_bridges', {
          payload: {
            use_bridges: this.useBridges,
            kind: this.bridgeKind,
            custom_bridges: lines,
          },
        })
        this.rejectedBridges = this.bridgeKind === 'custom' ? (result?.rejected ?? []) : []
      } catch {
        // bridges will be retried on next state push
      }
    },

    /**
     * Свежие мосты от Tor Project для страны пользователя (Moat через meek,
     * без капчи) — для «Своих мостов». Бросает ошибку бэкенда как есть.
     */
    async requestBridges(): Promise<TorRequestedBridges> {
      if (!this.available) return { country: null, bridges: [] }
      return torInvoke<TorRequestedBridges>('tor_request_bridges')
    },

    async applyAndRestart(opts: {
      useBridges: boolean
      kind: TorBridgeKind
      customBridges?: string
    }): Promise<void> {
      this.setBridgeConfig(opts)
      await this.pushBridges()
      await this.restart()
    },

    /**
     * Перезапуск с новыми мостами («Применить», «Повторить»). `enabled` не
     * сбрасывается: раньше перезапуск шёл через `disable()`, routingMode на это
     * время становился `direct`, и запросы, ждавшие Tor (RPC с подписью, /sync
     * с токеном), уходили напрямую. Rust тоже помнит, что Tor включён.
     */
    async restart(): Promise<void> {
      if (!this.available || !this.enabled) return
      try {
        const snap = await torInvoke<TorStateSnapshot>('tor_stop', { restart: true })
        this.applySnapshot(snap)
      } catch {
        // backend already stopped
      }
      try {
        const snap = await torInvoke<TorStateSnapshot>('tor_start')
        this.applySnapshot(snap)
      } catch (e) {
        this.status = 'failed'
        this.message = String(e)
      }
    },
  },
})
