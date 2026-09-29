/**
 * Подключённое радио Meshtastic: соединение, свой узел, узлы сети, каналы и
 * настройки радио. Живёт отдельно от страниц — радио остаётся на связи, пока
 * пользователь ходит по приложению; входящие уходят в mesh-chat-store.
 *
 * Протокол (протобуфы, ~150 КБ) грузится при первом подключении, а не вместе
 * с мессенджером.
 *
 * Пропало соединение само (кабель, питание, перезагрузка после смены
 * региона) — переподключаемся несколько раз с растущей паузой. Отключил
 * пользователь — нет.
 */

import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'

import { useAuthStore } from '@/blockchain'
import { nodeKey } from '../ids'
import type { MtLoRa, MtMetadata, MtNode } from '../meshtastic/codec'
import type {
  MeshtasticSession,
  MtSelf,
  MtSessionChannel,
  MtSessionOptions,
} from '../meshtastic/session'
import { openPacketLink, targetLabel, type MeshTarget } from '../radio/open-link'
import { radioErrorFrom } from '../radio/types'
import { useMeshChatStore } from './mesh-chat-store'
import {
  loadLastDevice,
  meshErrorCode,
  RECONNECT_DELAYS,
  saveLastDevice,
  type MeshConnectionStatus,
} from './radio-common'

/** Настройки сеанса (ожидания подтверждений); тесты их укорачивают. */
export const MESHTASTIC_SESSION_OPTIONS: MtSessionOptions = {}

export const useMeshtasticConnectionStore = defineStore('meshtastic-connection', () => {
  const status = ref<MeshConnectionStatus>('idle')
  const error = ref<string | null>(null)
  const target = ref<MeshTarget | null>(null)
  const self = ref<MtSelf | null>(null)
  const metadata = ref<MtMetadata | null>(null)
  const lora = ref<MtLoRa | null>(null)
  const nodes = ref<MtNode[]>([])
  const channels = ref<MtSessionChannel[]>([])
  const battery = ref<{ level: number | null; voltage: number | null } | null>(null)
  /** Последнее сообщение прошивки для пользователя (ключ, регион…). */
  const notice = ref<string | null>(null)
  /** Радио перезагружается после смены настроек — ждём его обратно. */
  const rebooting = ref(false)
  const session = shallowRef<MeshtasticSession | null>(null)
  const lastDevice = ref<MeshTarget | null>(null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  /** Растёт с каждым подключением: поздние события старого сеанса — мимо. */
  let generation = 0

  const selfKey = computed(() => (self.value ? nodeKey(self.value.nodeNum) : null))
  const label = computed(() => (target.value ? targetLabel(target.value) : ''))
  const regionUnset = computed(() => !!lora.value && lora.value.region === 0)

  function refreshLastDevice(): void {
    lastDevice.value = loadLastDevice(useAuthStore().address ?? null, 'meshtastic')
  }

  function sortedNodes(s: MeshtasticSession): MtNode[] {
    return [...s.nodes.values()]
      .filter((n) => n.num !== s.self.nodeNum)
      .sort((a, b) => b.lastHeard - a.lastHeard)
  }

  function syncFromSession(s: MeshtasticSession): void {
    self.value = { ...s.self }
    metadata.value = s.metadata
    lora.value = s.lora
    nodes.value = sortedNodes(s)
    channels.value = [...s.channels]
  }

  function syncNames(s: MeshtasticSession): void {
    void useMeshChatStore().syncMeshtasticPeers(
      nodeKey(s.self.nodeNum),
      (num) => {
        const user = s.node(num)?.user
        return user ? { name: s.nodeName(num), publicKey: user.publicKey } : null
      },
      channels.value
    )
  }

  function wire(s: MeshtasticSession, gen: number): void {
    const chat = useMeshChatStore()
    const live = (): boolean => gen === generation
    s.on('message', (m) => {
      if (live()) void chat.receiveMeshtastic(m, s.self.nodeNum)
    })
    s.on('nodes', () => {
      if (!live() || !s.self) return
      nodes.value = sortedNodes(s)
      syncNames(s)
    })
    s.on('channels', () => {
      if (!live()) return
      channels.value = [...s.channels]
      syncNames(s)
    })
    s.on('self', () => {
      if (live()) self.value = { ...s.self }
    })
    s.on('config', () => {
      if (live()) lora.value = s.lora
    })
    s.on('battery', (level, voltage) => {
      if (live()) battery.value = { level, voltage }
    })
    s.on('notification', (text) => {
      if (live()) notice.value = text
    })
    s.on('closed', (reason) => {
      if (!live()) return
      session.value = null
      scheduleReconnect(reason)
    })
  }

  /** Подключиться к радио. Прежнее соединение закрывается. Возвращает код ошибки или `null`. */
  async function connect(
    to: MeshTarget,
    opts: { reconnecting?: boolean } = {}
  ): Promise<string | null> {
    if (!opts.reconnecting) cancelReconnect()
    await closeSession()
    const gen = ++generation
    status.value = opts.reconnecting ? 'reconnecting' : 'connecting'
    error.value = null
    target.value = to
    try {
      await useMeshChatStore().ensureLoaded()
      const { MeshtasticSession } = await import('../meshtastic/session')
      const link = await openPacketLink(to)
      if (gen !== generation) {
        await link.close()
        return 'cancelled'
      }
      const s = MeshtasticSession.create(link, MESHTASTIC_SESSION_OPTIONS)
      // Подписки до start(): радио отдаёт накопленные сообщения сразу.
      wire(s, gen)
      await s.start()
      if (gen !== generation) {
        await s.close()
        return 'cancelled'
      }
      session.value = markRaw(s)
      syncFromSession(s)
      status.value = 'connected'
      rebooting.value = false
      reconnectAttempt = 0
      const address = useAuthStore().address ?? null
      saveLastDevice(address, 'meshtastic', to)
      lastDevice.value = to
      syncNames(s)
      return null
    } catch (e) {
      if (gen !== generation) return 'cancelled'
      const code = meshErrorCode(e)
      if (opts.reconnecting) {
        scheduleReconnect(code)
      } else {
        status.value = 'idle'
        error.value = code
      }
      return code
    }
  }

  function scheduleReconnect(reason: string | null): void {
    const to = target.value
    const delay = RECONNECT_DELAYS[reconnectAttempt]
    if (!to || delay === undefined) {
      status.value = 'idle'
      error.value = 'device_lost'
      rebooting.value = false
      reconnectAttempt = 0
      return
    }
    status.value = 'reconnecting'
    error.value = rebooting.value
      ? null
      : reason
        ? meshErrorCode({ code: reason.split(':')[0]?.trim() })
        : null
    reconnectAttempt++
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect(to, { reconnecting: true })
    }, delay)
  }

  function cancelReconnect(): void {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    reconnectAttempt = 0
  }

  async function closeSession(): Promise<void> {
    const s = session.value
    session.value = null
    if (s) await s.close().catch(() => {})
  }

  /** Отключиться по просьбе пользователя: без переподключения. */
  async function disconnect(): Promise<void> {
    cancelReconnect()
    generation++
    await closeSession()
    status.value = 'idle'
    error.value = null
    battery.value = null
    rebooting.value = false
  }

  function requireSession(): MeshtasticSession {
    const s = session.value
    if (!s) throw radioErrorFrom('not_connected')
    return s
  }

  /**
   * Регион и пресет. Радио перезагрузится, соединение восстановится само.
   * Возвращает true, если ждём перезагрузки.
   */
  async function setRadio(patch: { region?: number; modemPreset?: number }): Promise<boolean> {
    const s = requireSession()
    const reboots = await s.setLoRa(patch)
    lora.value = s.lora
    if (reboots) rebooting.value = true
    return reboots
  }

  async function rename(longName: string, shortName: string): Promise<void> {
    const s = requireSession()
    await s.setOwner(longName, shortName)
    self.value = { ...s.self }
  }

  async function addChannel(name: string, psk: Uint8Array): Promise<number> {
    const s = requireSession()
    const index = await s.addChannel(name, psk)
    channels.value = [...s.channels]
    return index
  }

  /** Каналы из ссылки `meshtastic.org/e/#…`. Возвращает, сколько добавлено. */
  async function addChannelsFromUrl(url: string): Promise<number> {
    const s = requireSession()
    const { decodeChannelUrl } = await import('../meshtastic/codec')
    const share = decodeChannelUrl(url)
    if (!share) throw radioErrorFrom('bad_channel_link')
    const added = await s.importChannels(share)
    channels.value = [...s.channels]
    return added.length
  }

  async function removeChannel(index: number): Promise<void> {
    const s = requireSession()
    await s.removeChannel(index)
    channels.value = [...s.channels]
  }

  function channelUrl(index: number): string | null {
    return session.value?.channelUrl(index) ?? null
  }

  /** Попросить у узла имя и ключ (для ЛС нужен его ключ). */
  async function requestNodeInfo(num: number): Promise<void> {
    await requireSession().requestNodeInfo(num)
  }

  async function removeNode(num: number): Promise<void> {
    const s = requireSession()
    await s.removeNode(num)
    nodes.value = sortedNodes(s)
  }

  async function setFavorite(num: number, favorite: boolean): Promise<void> {
    const s = requireSession()
    await s.setFavorite(num, favorite)
    nodes.value = sortedNodes(s)
  }

  function dismissNotice(): void {
    notice.value = null
  }

  /** Смена аккаунта или выход: радио отключается, состояние чистится. */
  async function reset(): Promise<void> {
    await disconnect()
    target.value = null
    self.value = null
    metadata.value = null
    lora.value = null
    nodes.value = []
    channels.value = []
    notice.value = null
    lastDevice.value = null
  }

  return {
    status,
    error,
    target,
    label,
    self,
    selfKey,
    metadata,
    lora,
    regionUnset,
    nodes,
    channels,
    battery,
    notice,
    rebooting,
    session,
    lastDevice,
    refreshLastDevice,
    connect,
    disconnect,
    setRadio,
    rename,
    addChannel,
    addChannelsFromUrl,
    removeChannel,
    channelUrl,
    requestNodeInfo,
    removeNode,
    setFavorite,
    dismissNotice,
    reset,
  }
})
