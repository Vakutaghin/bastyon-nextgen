/**
 * Подключённое mesh-радио (MeshCore): соединение, сведения об узле, контакты
 * и каналы. Живёт отдельно от страниц — радио остаётся на связи, пока
 * пользователь ходит по приложению; входящие уходят в mesh-chat-store.
 *
 * Пропало соединение само (кабель, питание, вышли из зоны Bluetooth) —
 * переподключаемся несколько раз с растущей паузой. Отключил пользователь —
 * нет.
 */

import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'

import { useAuthStore } from '@/blockchain'
import { MESH_LAST_DEVICE_PREFIX } from '@/blockchain/constants/storage'
import type { McBattery, McContact, McDeviceInfo, McSelfInfo } from '../meshcore/codec'
import { ADV_TYPE } from '../meshcore/constants'
import { hashtagSecret, normalizeHashtag, randomChannelSecret } from '../meshcore/channels'
import { MeshCoreSession, type SessionChannel, type SessionOptions } from '../meshcore/session'
import { openFrameLink, targetLabel, type MeshTarget } from '../radio/open-link'
import { radioErrorFrom } from '../radio/types'
import { useMeshChatStore } from './mesh-chat-store'

export type MeshConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

/** Паузы между попытками переподключения после обрыва, мс. */
export const RECONNECT_DELAYS = [2_000, 5_000, 15_000, 30_000]

/** Настройки сеанса с радио (повторы, ожидание ACK); тесты их укорачивают. */
export const MESH_SESSION_OPTIONS: SessionOptions = { appName: 'Bastyon' }

function lastDeviceKey(address: string): string {
  return `${MESH_LAST_DEVICE_PREFIX}${address}`
}

function loadLastDevice(address: string | null): MeshTarget | null {
  if (!address) return null
  try {
    const raw = localStorage.getItem(lastDeviceKey(address))
    if (!raw) return null
    const t = JSON.parse(raw) as MeshTarget
    if (t && (t.transport === 'serial' || t.transport === 'tcp' || t.transport === 'ble')) return t
  } catch {
    /* повреждённая запись — как будто её нет */
  }
  return null
}

function saveLastDevice(address: string | null, target: MeshTarget): void {
  if (!address) return
  try {
    localStorage.setItem(lastDeviceKey(address), JSON.stringify(target))
  } catch {
    /* нет localStorage — просто не запомним */
  }
}

/** Код ошибки для интерфейса (`mesh.errors.<код>`). */
export function meshErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: unknown }).code
    const message = e instanceof Error ? e.message : ''
    // Отказ с названной причиной (channels_full, channel_not_found) — по причине.
    if (code === 'rejected' && /^[a-z_]+$/.test(message) && message !== 'rejected') return message
    // Команда без ответа — чаще всего это не MeshCore-радио (прошивка другая).
    if (code === 'timeout') return 'no_answer'
    if (typeof code === 'string') return code
  }
  return radioErrorFrom(e).code
}

export const useMeshConnectionStore = defineStore('mesh-connection', () => {
  const status = ref<MeshConnectionStatus>('idle')
  const error = ref<string | null>(null)
  const target = ref<MeshTarget | null>(null)
  const self = ref<McSelfInfo | null>(null)
  const device = ref<McDeviceInfo | null>(null)
  const contacts = ref<McContact[]>([])
  const channels = ref<SessionChannel[]>([])
  const discovered = ref<McContact[]>([])
  const battery = ref<McBattery | null>(null)
  const contactsFull = ref(false)
  /** Текущий сеанс; сам объект не реактивный. */
  const session = shallowRef<MeshCoreSession | null>(null)
  const lastDevice = ref<MeshTarget | null>(null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  /** Растёт с каждым подключением: поздние события старого сеанса — мимо. */
  let generation = 0

  const selfKey = computed(() => self.value?.publicKey.slice(0, 12) ?? null)
  const label = computed(() => (target.value ? targetLabel(target.value) : ''))
  /** С кем можно переписываться лично: узлы-собеседники, не репитеры. */
  const chatContacts = computed(() =>
    contacts.value.filter((c) => c.type === ADV_TYPE.CHAT || c.type === ADV_TYPE.ROOM)
  )

  function refreshLastDevice(): void {
    lastDevice.value = loadLastDevice(useAuthStore().address ?? null)
  }

  function syncFromSession(s: MeshCoreSession): void {
    self.value = s.self
    device.value = s.device
    contacts.value = [...s.contacts.values()].sort((a, b) => b.lastAdvert - a.lastAdvert)
    channels.value = [...s.channels]
  }

  function wire(s: MeshCoreSession, gen: number): void {
    const chat = useMeshChatStore()
    s.on('message', (m) => {
      if (gen !== generation) return
      void chat.receive(m, s.self.publicKey)
    })
    s.on('contacts', () => {
      if (gen !== generation || !s.self) return
      contacts.value = [...s.contacts.values()].sort((a, b) => b.lastAdvert - a.lastAdvert)
      discovered.value = discovered.value.filter((d) => !s.contacts.has(d.publicKey))
      void chat.syncNames(s.self.publicKey, contacts.value, channels.value)
    })
    s.on('channels', () => {
      if (gen !== generation || !s.self) return
      channels.value = [...s.channels]
      void chat.syncNames(s.self.publicKey, contacts.value, channels.value)
    })
    s.on('discovered', (c) => {
      if (gen !== generation || s.contacts.has(c.publicKey)) return
      discovered.value = [c, ...discovered.value.filter((d) => d.publicKey !== c.publicKey)].slice(
        0,
        50
      )
    })
    s.on('contactsFull', () => {
      if (gen === generation) contactsFull.value = true
    })
    s.on('closed', (reason) => {
      if (gen !== generation) return
      session.value = null
      scheduleReconnect(reason)
    })
  }

  /**
   * Подключиться к радио. Прежнее соединение закрывается. Возвращает код
   * ошибки или `null`.
   */
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
      const link = await openFrameLink(to)
      if (gen !== generation) {
        await link.close()
        return 'cancelled'
      }
      const s = MeshCoreSession.create(link, MESH_SESSION_OPTIONS)
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
      reconnectAttempt = 0
      contactsFull.value = false
      const address = useAuthStore().address ?? null
      saveLastDevice(address, to)
      lastDevice.value = to
      void useMeshChatStore().syncNames(s.self.publicKey, contacts.value, channels.value)
      void refreshBattery()
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
      reconnectAttempt = 0
      return
    }
    status.value = 'reconnecting'
    error.value = reason ? meshErrorCode({ code: reason.split(':')[0]?.trim() }) : null
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
  }

  async function refreshBattery(): Promise<void> {
    const s = session.value
    if (!s) return
    try {
      battery.value = await s.battery()
    } catch {
      /* старые прошивки и сбои — просто без заряда */
    }
  }

  function requireSession(): MeshCoreSession {
    const s = session.value
    if (!s) throw radioErrorFrom('not_connected')
    return s
  }

  async function sendAdvert(flood: boolean): Promise<void> {
    await requireSession().sendAdvert(flood)
  }

  async function rename(name: string): Promise<void> {
    const s = requireSession()
    await s.rename(name)
    self.value = s.self
  }

  async function addDiscovered(contact: McContact): Promise<void> {
    await requireSession().addContact(contact)
    discovered.value = discovered.value.filter((d) => d.publicKey !== contact.publicKey)
  }

  async function removeContact(publicKey: string): Promise<void> {
    await requireSession().removeContact(publicKey)
  }

  async function addHashtagChannel(tag: string): Promise<SessionChannel> {
    const name = normalizeHashtag(tag)
    return requireSession().addChannel(name, await hashtagSecret(name))
  }

  /** Приватный канал со случайным ключом или с ключом, который дал участник. */
  async function addPrivateChannel(name: string, secretHex?: string): Promise<SessionChannel> {
    const secret = (secretHex ?? randomChannelSecret()).toLowerCase()
    if (!/^[0-9a-f]{32}$/.test(secret)) throw radioErrorFrom('bad_channel_key')
    return requireSession().addChannel(name.trim(), secret)
  }

  async function removeChannel(index: number): Promise<void> {
    await requireSession().removeChannel(index)
  }

  /** Смена аккаунта или выход: радио отключается, состояние чистится. */
  async function reset(): Promise<void> {
    await disconnect()
    target.value = null
    self.value = null
    device.value = null
    contacts.value = []
    channels.value = []
    discovered.value = []
    contactsFull.value = false
    lastDevice.value = null
  }

  return {
    status,
    error,
    target,
    label,
    self,
    selfKey,
    device,
    contacts,
    chatContacts,
    channels,
    discovered,
    battery,
    contactsFull,
    session,
    lastDevice,
    refreshLastDevice,
    connect,
    disconnect,
    refreshBattery,
    sendAdvert,
    rename,
    addDiscovered,
    removeContact,
    addHashtagChannel,
    addPrivateChannel,
    removeChannel,
    reset,
  }
})
