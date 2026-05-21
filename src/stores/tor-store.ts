import { defineStore } from 'pinia'

export type TorStatus =
  | 'off'
  | 'installing'
  | 'starting'
  | 'bootstrapping'
  | 'ready'
  | 'failed'

export type TorBridgeKind = 'none' | 'snowflake' | 'obfs4' | 'custom'

export type TorStateSnapshot = {
  status: TorStatus
  bootstrap_pct: number
  message?: string | null
  socks_port: number
  control_port: number
  use_bridges: boolean
  bridge_kind: TorBridgeKind
}

export type TorInstallProgress = {
  phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready'
  fraction: number
  message: string
}

const LS_ENABLED = 'tor:enabled'
const LS_BRIDGES_USE = 'tor:bridges:use'
const LS_BRIDGES_KIND = 'tor:bridges:kind'
const LS_BRIDGES_CUSTOM = 'tor:bridges:custom'

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  if (typeof w.__TAURI__ !== 'undefined') return true
  if (typeof w.__TAURI_INTERNALS__ !== 'undefined') return true
  if (typeof w.__TAURI_METADATA__ !== 'undefined') return true
  try {
    return Object.keys(w).some((k) => k.startsWith('__TAURI'))
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
  const unlisten = await listen<T>(event, (e) => cb(e.payload))
  return unlisten
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

function persistBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {}
}

function persistString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export const useTorStore = defineStore('tor', {
  state: () => ({
    available: isTauriEnv(),
    enabled: loadBool(LS_ENABLED, false),
    status: 'off' as TorStatus,
    bootstrapPct: 0,
    message: null as string | null,
    socksPort: 9250,
    install: null as TorInstallProgress | null,
    useBridges: loadBool(LS_BRIDGES_USE, false),
    bridgeKind: (loadString(LS_BRIDGES_KIND, 'none') as TorBridgeKind),
    customBridges: loadString(LS_BRIDGES_CUSTOM, ''),
    _subscribed: false,
    _stateUnlisten: null as (() => void) | null,
    _installUnlisten: null as (() => void) | null,
  }),

  getters: {
    isReady(state): boolean {
      return state.enabled && state.status === 'ready'
    },
    /** Whether outgoing requests should be torified now. */
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
      await this.subscribe()
      try {
        const snap = await tauriInvoke<TorStateSnapshot>('tor_status')
        this.applySnapshot(snap)
      } catch {
        // backend not ready — will retry on next user action
      }

      await this.pushBridges().catch(() => {})

      if (this.enabled && this.status === 'off') {
        await this.enable()
      }
    },

    async subscribe(): Promise<void> {
      if (this._subscribed) return
      this._subscribed = true
      this._stateUnlisten = await tauriListen<TorStateSnapshot>('tor:state', (snap) => {
        this.applySnapshot(snap)
      })
      this._installUnlisten = await tauriListen<TorInstallProgress>(
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
    },

    async enable(): Promise<void> {
      if (!this.available) return
      this.enabled = true
      persistBool(LS_ENABLED, true)
      try {
        await this.pushBridges()
        const snap = await tauriInvoke<TorStateSnapshot>('tor_start')
        this.applySnapshot(snap)
      } catch (e) {
        this.status = 'failed'
        this.message = String(e)
      }
    },

    async disable(): Promise<void> {
      this.enabled = false
      persistBool(LS_ENABLED, false)
      if (!this.available) return
      try {
        const snap = await tauriInvoke<TorStateSnapshot>('tor_stop')
        this.applySnapshot(snap)
      } catch {
        // backend already stopped or unreachable
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
        await tauriInvoke('tor_set_bridges', {
          payload: {
            use_bridges: this.useBridges,
            kind: this.bridgeKind,
            custom_bridges: lines,
          },
        })
      } catch {
        // bridges will be retried on next state push
      }
    },

    async applyAndRestart(opts: {
      useBridges: boolean
      kind: TorBridgeKind
      customBridges?: string
    }): Promise<void> {
      this.setBridgeConfig(opts)
      await this.pushBridges()
      if (this.enabled) {
        await this.disable()
        await this.enable()
      }
    },
  },
})
