/**
 * Узел Reticulum (десктоп): свой адрес LXMF, интерфейсы, кто объявился в
 * сети, узел доставки. Переписка LXMF уходит в mesh-chat-store, как у радио.
 *
 * Identity выводится из ключа аккаунта (reticulum/identity.ts): мнемоника
 * восстанавливает и адрес Reticulum. Настройки (хабы, LAN, RNode, узел
 * доставки) — на аккаунт, в localStorage; чистятся при выходе.
 *
 * В режиме Tor интерфейсы, которые ходят в интернет или LAN (TCP к хабу,
 * AutoInterface), не поднимаются — как IPFS: остаётся только радио (RNode).
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/blockchain'
import { RNS_CONFIG_PREFIX } from '@/blockchain/constants/storage'
import { useTorStore } from '@/stores/tor-store'
import { deriveRnsIdentity } from '../reticulum/identity'
import {
  isRnsAvailable,
  rnsAnnounce,
  rnsSetPropagationNode,
  rnsStart,
  rnsStatus,
  rnsStop,
  rnsSync,
  type RnsAspect,
  type RnsEvent,
  type RnsInterface,
  type RnsInterfaceStatus,
} from '../reticulum/rns-api'
import { useMeshChatStore } from './mesh-chat-store'
import { meshErrorCode } from './radio-common'

export type RnsStatusName = 'idle' | 'starting' | 'running' | 'stopping'

export interface RnsConfig {
  interfaces: RnsInterface[]
  displayName: string
  propagationNode: string | null
  /** Поднимать узел при входе в аккаунт. */
  autostart: boolean
}

export interface RnsPeer {
  /** Адрес (destination hash), hex. */
  dest: string
  identity: string
  name: string | null
  hops: number | null
  /** Когда слышали announce, мс. */
  seen: number
  aspect: RnsAspect
}

const DEFAULT_CONFIG: RnsConfig = {
  interfaces: [{ kind: 'auto' }],
  displayName: '',
  propagationNode: null,
  autostart: false,
}

/** Сколько объявившихся узлов помнить (самые свежие). */
const MAX_PEERS = 500

/** Как часто обновлять счётчики интерфейсов, пока узел работает. */
const STATUS_EVERY_MS = 30_000

/**
 * Интерфейс, не поднявшийся при старте (хаб недоступен, RNode не подключён),
 * узел больше не пробует — тогда узел перезапускается с растущей паузой.
 */
const RESTART_DELAYS_MS = [60_000, 120_000, 300_000, 600_000, 900_000]

function configKey(address: string): string {
  return `${RNS_CONFIG_PREFIX}${address}`
}

function loadConfig(address: string | null): RnsConfig {
  if (!address) return { ...DEFAULT_CONFIG }
  try {
    const raw = localStorage.getItem(configKey(address))
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<RnsConfig>) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Ключ аккаунта (32 байта) как байты — из Buffer или hex. */
function accountKeyBytes(key: unknown): Uint8Array | null {
  if (key instanceof Uint8Array) return key.length === 32 ? key : null
  if (typeof key === 'string' && /^(0x)?[0-9a-f]{64}$/i.test(key)) return hexToBytes(key)
  return null
}

/** Интерфейсы, которые можно поднять в текущем режиме сети. */
export function allowedInterfaces(list: RnsInterface[], tor: boolean): RnsInterface[] {
  return tor ? list.filter((i) => i.kind === 'rnode') : list
}

export const useReticulumStore = defineStore('reticulum', () => {
  const status = ref<RnsStatusName>('idle')
  const error = ref<string | null>(null)
  const address = ref<string | null>(null)
  const identityHash = ref<string | null>(null)
  const config = ref<RnsConfig>({ ...DEFAULT_CONFIG })
  const interfaces = ref<RnsInterfaceStatus[]>([])
  const peers = ref<RnsPeer[]>([])
  const syncState = ref<{ state: string; received: number } | null>(null)
  /** Ход ответа узла NomadNet (страница или файл), пока он идёт ресурсом. */
  const transfer = ref<{ received: number; total: number } | null>(null)
  /** Для какого аккаунта загружены настройки. */
  let account: string | null = null
  let statusTimer: ReturnType<typeof setInterval> | null = null
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let restartStep = 0

  /** Есть ли свой узел в этой сборке (десктоп). Проверяется при обращении. */
  const available = computed(() => isRnsAvailable())
  const contacts = computed(() => peers.value.filter((p) => p.aspect === 'lxmf.delivery'))
  const nomadNodes = computed(() => peers.value.filter((p) => p.aspect === 'nomadnetwork.node'))
  const propagationNodes = computed(() =>
    peers.value.filter((p) => p.aspect === 'lxmf.propagation')
  )

  function ensureConfig(): void {
    const current = useAuthStore().address ?? null
    if (current === account) return
    account = current
    config.value = loadConfig(current)
  }

  function saveConfig(): void {
    if (!account) return
    try {
      localStorage.setItem(configKey(account), JSON.stringify(config.value))
    } catch {
      /* нет localStorage — настройки на этот запуск */
    }
  }

  function peerName(dest: string): string | null {
    return peers.value.find((p) => p.dest === dest)?.name ?? null
  }

  function onEvent(ev: RnsEvent): void {
    const chat = useMeshChatStore()
    switch (ev.kind) {
      case 'announce': {
        const known = peers.value.find((p) => p.dest === ev.dest && p.aspect === ev.aspect)
        const rest = peers.value.filter((p) => p !== known)
        const peer: RnsPeer = {
          dest: ev.dest,
          identity: ev.identity,
          // Ответ на запрос пути приходит announce-ом без имени — прежнее не терять.
          name: ev.name ?? known?.name ?? null,
          hops: ev.hops,
          seen: ev.heard ? Math.round(ev.heard * 1000) : Date.now(),
          aspect: ev.aspect,
        }
        peers.value = [peer, ...rest].sort((a, b) => b.seen - a.seen).slice(0, MAX_PEERS)
        if (ev.aspect === 'lxmf.delivery' && address.value && ev.name) {
          void chat.syncLxmfPeer(address.value, ev.dest, ev.name)
        }
        break
      }
      case 'message':
        if (address.value) void chat.receiveLxmf(ev, address.value, peerName(ev.from))
        break
      case 'state':
        chat.updateLxmfState(ev.id, ev.state, ev.reason)
        break
      case 'interface':
        interfaces.value = interfaces.value.map((i) =>
          i.name === ev.name ? { ...i, online: ev.online } : i
        )
        break
      case 'sync':
        syncState.value = { state: ev.state, received: ev.received }
        break
      case 'progress':
        transfer.value = { received: ev.received, total: ev.total }
        break
    }
  }

  /** Поднять узел с настройками аккаунта. Возвращает код ошибки или null. */
  async function start(): Promise<string | null> {
    ensureConfig()
    if (!isRnsAvailable()) return 'unsupported'
    if (status.value === 'running' || status.value === 'starting') return null
    const auth = useAuthStore()
    const key = accountKeyBytes(auth.keyPair?.privateKey)
    if (!key) return 'no_account_key'
    status.value = 'starting'
    error.value = null
    try {
      await useMeshChatStore().ensureLoaded()
      const tor = useTorStore().enabled
      const started = await rnsStart(
        {
          identity: await deriveRnsIdentity(key),
          displayName: config.value.displayName || 'Bastyon',
          interfaces: allowedInterfaces(config.value.interfaces, tor),
          propagationNode: config.value.propagationNode,
        },
        onEvent
      )
      address.value = started.address
      identityHash.value = started.identityHash
      status.value = 'running'
      statusTimer ??= setInterval(() => void refreshStatus(), STATUS_EVERY_MS)
      await refreshStatus()
      return null
    } catch (e) {
      status.value = 'idle'
      error.value = meshErrorCode(e)
      return error.value
    }
  }

  function clearTimers(): void {
    if (statusTimer) clearInterval(statusTimer)
    if (restartTimer) clearTimeout(restartTimer)
    statusTimer = null
    restartTimer = null
  }

  async function stop(): Promise<void> {
    clearTimers()
    if (status.value === 'idle') return
    status.value = 'stopping'
    try {
      await rnsStop()
    } catch {
      /* уже остановлен */
    }
    status.value = 'idle'
    interfaces.value = []
  }

  async function refreshStatus(): Promise<void> {
    if (status.value !== 'running') return
    try {
      const s = await rnsStatus()
      interfaces.value = s.interfaces
      scheduleRestart(s.interfaces.some((i) => i.started === false))
    } catch {
      /* узел остановился */
    }
  }

  /** Перезапустить узел позже, если какой-то интерфейс так и не поднялся. */
  function scheduleRestart(missing: boolean): void {
    if (!missing) {
      restartStep = 0
      return
    }
    if (restartTimer) return
    const delay = RESTART_DELAYS_MS[Math.min(restartStep, RESTART_DELAYS_MS.length - 1)]!
    restartStep++
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (status.value !== 'running') return
      void stop().then(() => start())
    }, delay)
  }

  /** При входе в аккаунт: поднять узел, если так настроено. */
  async function autostart(): Promise<void> {
    ensureConfig()
    // Не через computed `available`: он запомнил бы ответ на момент входа.
    if (!isRnsAvailable() || !config.value.autostart || status.value !== 'idle') return
    await start()
  }

  /** Поменять настройки; работающий узел перезапускается с ними. */
  async function updateConfig(patch: Partial<RnsConfig>): Promise<void> {
    ensureConfig()
    config.value = { ...config.value, ...patch }
    saveConfig()
    if (patch.propagationNode !== undefined && status.value === 'running') {
      await rnsSetPropagationNode(patch.propagationNode)
    }
    if ((patch.interfaces || patch.displayName !== undefined) && status.value === 'running') {
      await stop()
      await start()
    }
  }

  async function announce(): Promise<void> {
    await rnsAnnounce()
  }

  async function sync(): Promise<void> {
    syncState.value = { state: 'requesting', received: 0 }
    await rnsSync()
  }

  /** Смена аккаунта или выход: узел останавливается, состояние чистится. */
  async function reset(): Promise<void> {
    await stop()
    restartStep = 0
    address.value = null
    identityHash.value = null
    peers.value = []
    syncState.value = null
    transfer.value = null
    error.value = null
    account = null
    config.value = { ...DEFAULT_CONFIG }
  }

  return {
    available,
    status,
    error,
    address,
    identityHash,
    config,
    interfaces,
    peers,
    contacts,
    nomadNodes,
    propagationNodes,
    syncState,
    transfer,
    ensureConfig,
    peerName,
    start,
    stop,
    autostart,
    refreshStatus,
    updateConfig,
    announce,
    sync,
    reset,
  }
})
