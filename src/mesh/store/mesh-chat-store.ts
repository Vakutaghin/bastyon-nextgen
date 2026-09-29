/**
 * Переписка в mesh-сетях (MeshCore, Meshtastic): диалоги и сообщения
 * аккаунта, приём и отправка.
 *
 * Радио историю не хранит, поэтому всё записывается в IndexedDB (mesh-api) и
 * отсюда показывается в общем списке мессенджера (messenger-store сливает
 * эти диалоги с комнатами Matrix).
 *
 * Отправка по диалогу идёт по очереди: следующее сообщение уходит, когда
 * предыдущее радио уже приняло (или отказало). Иначе части длинного текста
 * могли бы прийти в другом порядке.
 */

import { defineStore } from 'pinia'
import { computed, reactive, ref, toRaw } from 'vue'

import { useAuthStore } from '@/blockchain'
import { meshAPI } from '@/db/apis/mesh-api'
import type {
  MeshAttachment,
  MeshDialogRecord,
  MeshMessageRecord,
  MeshMessageStatus,
} from '@/db/types'
import { notifyMessage } from '@/composables/use-browser-notifications'
import { useMessengerUiStore } from '@/b-components/messenger/store/messenger-ui-store'
import glassSound from '@/b-components/messenger/sounds/glass.mp3'
import type { Dialog, Message } from '@/b-components/messenger/types'
import {
  channelDialogId,
  directDialogId,
  roomDialogId,
  meshSenderId,
  nodeKey,
  nodeNumOf,
  parseMeshDialogId,
  type MeshNetwork,
} from '../ids'
import { fromBase64, toBase64 } from '../bytes'
import type { McContact } from '../meshcore/codec'
import { MAX_TEXT_LEN } from '../meshcore/constants'
import type { SessionChannel, SessionMessage } from '../meshcore/session'
import { MAX_TEXT_BYTES as MT_MAX_TEXT_BYTES } from '../meshtastic/constants'
import type { MtIncoming, MtSessionChannel } from '../meshtastic/session'
import { rnsPaper, rnsSend, type RnsEvent } from '../reticulum/rns-api'
import { showRadioNotification } from '../radio/platform'
import { splitForMesh } from '../text'
import {
  forgetMeshMedia,
  meshDialogToMessenger,
  meshMessagesToMessenger,
} from './messenger-mapping'
import { useMeshConnectionStore } from './mesh-connection-store'
import { useMeshtasticConnectionStore } from './meshtastic-connection-store'
import { useMeshRoutesStore } from './mesh-routes-store'
import { useReticulumStore } from './reticulum-store'

/** Сколько ключей недавних сообщений помнить в памяти — на случай, если база недоступна. */
const RECENT_KEYS = 1000

/**
 * Текст одного сообщения LXMF. Короткое уходит одним пакетом, длинное —
 * через Link частями (Resource), так что предел — разумный, а не эфирный.
 */
const LXMF_MAX_TEXT_BYTES = 8_000
/** Вложения в одном сообщении LXMF (узел примет до 900 КБ; Python — до 1000 КБ). */
export const LXMF_MAX_ATTACHMENT_BYTES = 900_000

export type MeshSendError =
  | 'not_connected'
  | 'too_long'
  | 'empty'
  | 'no_dialog'
  | 'too_large'
  | 'not_supported'

/** Вложения в строке списка диалогов и в уведомлении: значки и имена файлов. */
export function attachmentsLabel(list: MeshAttachment[] | undefined): string {
  return (list ?? [])
    .map((a) => (a.kind === 'image' ? '🖼' : a.kind === 'audio' ? '🎤' : `📎 ${a.name}`))
    .join(' ')
}

type ChannelKind = 'public' | 'hashtag' | 'private'

/** Входящее сообщение любой сети — в том виде, в каком его пишет стор. */
interface Incoming {
  network: MeshNetwork
  selfKey: string
  kind: 'direct' | 'channel' | 'room'
  /** ЛС и комната: собеседник (MeshCore — префикс ключа, Meshtastic — номер узла hex). */
  peerKey?: string
  /** ЛС: полный ключ собеседника, если известен (MeshCore). */
  peerFullKey?: string | null
  /** ЛС Meshtastic: открытый ключ собеседника — запомнить в диалоге. */
  peerPublicKey?: string | null
  channel?: { id: string; name: string; kind: ChannelKind }
  senderKey: string | null
  senderName: string | null
  /** Имя диалога, если его ещё нет. */
  dialogName: string
  senderTs: number
  text: string
  /** Уникальность сообщения в диалоге (повторы от радио — те же). */
  uniq: string
  hops: number | null
  snr: number | null
  packetId?: number
  replyToPacket?: number
  reactionTo?: number
  pki?: boolean
  attachments?: MeshAttachment[]
}

function newId(dialogId: string): string {
  const c = globalThis.crypto
  const uid =
    typeof c?.randomUUID === 'function' ? c.randomUUID() : `${Date.now()}-${Math.random()}`
  return `${dialogId}|${uid}`
}

function shortKey(key: string): string {
  return key.slice(0, 8)
}

export const useMeshChatStore = defineStore('mesh-chat', () => {
  const account = ref<string | null>(null)
  const dialogs = ref<MeshDialogRecord[]>([])
  /** Загруженные сообщения открытых диалогов. */
  const messages = reactive<Record<string, MeshMessageRecord[]>>({})
  const recentKeys = new Set<string>()
  const sendChains = new Map<string, Promise<void>>()
  let loading: Promise<void> | null = null

  const messengerDialogs = computed<Dialog[]>(() => dialogs.value.map(meshDialogToMessenger))
  const totalUnread = computed(() => dialogs.value.reduce((n, d) => n + d.unread, 0))

  function find(id: string): MeshDialogRecord | undefined {
    return dialogs.value.find((d) => d.id === id)
  }

  /** Диалоги текущего аккаунта (после входа и смены аккаунта — заново). */
  async function ensureLoaded(): Promise<void> {
    const address = useAuthStore().address ?? null
    if (!address) return
    if (account.value === address && !loading) return
    if (loading && account.value === address) return loading
    account.value = address
    loading = (async () => {
      const list = await meshAPI.dialogs(address)
      if (account.value !== address) return
      dialogs.value = list
    })().finally(() => {
      loading = null
    })
    return loading
  }

  function rememberKey(key: string): boolean {
    if (recentKeys.has(key)) return false
    recentKeys.add(key)
    if (recentKeys.size > RECENT_KEYS) {
      const first = recentKeys.values().next().value
      if (first !== undefined) recentKeys.delete(first)
    }
    return true
  }

  async function saveDialog(d: MeshDialogRecord): Promise<void> {
    await meshAPI.putDialog({ ...toRaw(d) })
  }

  async function createDialog(
    fields: Omit<
      MeshDialogRecord,
      'account' | 'lastTs' | 'lastText' | 'lastMine' | 'unread' | 'createdAt'
    >
  ): Promise<MeshDialogRecord> {
    const existing = find(fields.id)
    if (existing) return existing
    const record: MeshDialogRecord = {
      ...fields,
      account: account.value ?? '',
      lastTs: 0,
      lastText: '',
      lastMine: false,
      unread: 0,
      createdAt: Date.now(),
    }
    dialogs.value = [...dialogs.value, record]
    await saveDialog(record)
    return find(record.id) ?? record
  }

  function selfKeyOf(network: MeshNetwork, selfKey: string): string {
    return (network === 'lxmf' ? selfKey.slice(0, 32) : selfKey.slice(0, 12)).toLowerCase()
  }

  function directFields(network: MeshNetwork, selfKey: string, peer: string, name: string) {
    return {
      id: directDialogId(network, selfKey, peer),
      network,
      selfKey: selfKeyOf(network, selfKey),
      kind: 'direct' as const,
      peerKey: null as string | null,
      name,
    }
  }

  function roomFields(network: MeshNetwork, selfKey: string, room: string, name: string) {
    return {
      id: roomDialogId(network, selfKey, room),
      network,
      selfKey: selfKey.slice(0, 12).toLowerCase(),
      kind: 'room' as const,
      peerKey: null as string | null,
      name,
    }
  }

  function channelFields(
    network: MeshNetwork,
    selfKey: string,
    channel: { id: string; name: string; kind: ChannelKind }
  ) {
    return {
      id: channelDialogId(network, selfKey, channel.id),
      network,
      selfKey: selfKey.slice(0, 12).toLowerCase(),
      kind: 'channel' as const,
      peerKey: null,
      channelKind: channel.kind,
      name: channel.name,
    }
  }

  // ─── Диалоги со страницы Mesh ─────────────────────────────────────────────

  /** Личный диалог с контактом радио MeshCore (для «Написать» на странице Mesh). */
  async function ensureDirectDialog(selfKey: string, contact: McContact): Promise<string> {
    await ensureLoaded()
    const d = await createDialog({
      ...directFields(
        'meshcore',
        selfKey,
        contact.publicKey,
        contact.name || shortKey(contact.publicKey)
      ),
      peerKey: contact.publicKey,
    })
    return d.id
  }

  /** Комната MeshCore (room server) — после входа на странице Mesh. */
  async function ensureRoomDialog(selfKey: string, room: McContact): Promise<string> {
    await ensureLoaded()
    const d = await createDialog({
      ...roomFields('meshcore', selfKey, room.publicKey, room.name || shortKey(room.publicKey)),
      peerKey: room.publicKey,
    })
    return d.id
  }

  async function ensureChannelDialog(selfKey: string, channel: SessionChannel): Promise<string> {
    await ensureLoaded()
    return (await createDialog(channelFields('meshcore', selfKey, channel))).id
  }

  /** Личный диалог с узлом Meshtastic. */
  /**
   * ЛС Meshtastic. `publicKey` — ключ узла для ЛС (из записи связки): с ним
   * отправка сама отдаст ключ радио (add_contact), не дожидаясь NodeInfo.
   */
  async function ensureMeshtasticDirectDialog(
    selfNum: number,
    node: { num: number; name: string; publicKey?: string }
  ): Promise<string> {
    await ensureLoaded()
    const peer = nodeKey(node.num)
    const d = await createDialog({
      ...directFields('meshtastic', nodeKey(selfNum), peer, node.name),
      peerKey: peer,
    })
    if (node.publicKey && d.peerPublicKey !== node.publicKey) {
      d.peerPublicKey = node.publicKey
      await saveDialog(d)
    }
    return d.id
  }

  async function ensureMeshtasticChannelDialog(
    selfNum: number,
    channel: MtSessionChannel
  ): Promise<string> {
    await ensureLoaded()
    return (await createDialog(channelFields('meshtastic', nodeKey(selfNum), channel))).id
  }

  /** Имена контактов и каналов поменялись на радио MeshCore — обновить диалоги. */
  async function syncNames(
    selfKey: string,
    contacts: McContact[],
    channels: SessionChannel[]
  ): Promise<void> {
    const self = selfKey.slice(0, 12)
    for (const d of dialogs.value) {
      if (d.selfKey !== self || d.network !== 'meshcore') continue
      const parsed = parseMeshDialogId(d.id)
      if (!parsed) continue
      let name = d.name
      let peerKey = d.peerKey
      if (parsed.kind === 'direct' || parsed.kind === 'room') {
        const c = contacts.find((x) => x.publicKey.startsWith(parsed.key))
        if (c) {
          name = c.name || name
          peerKey = c.publicKey
        }
      } else {
        const ch = channels.find((x) => x.id === parsed.key)
        if (ch) name = ch.name || name
      }
      if (name !== d.name || peerKey !== d.peerKey) {
        d.name = name
        d.peerKey = peerKey
        await saveDialog(d)
      }
    }
  }

  /**
   * То же для Meshtastic: имя и ключ узла узнаются из его NodeInfo. Ключ
   * запоминается в диалоге — пригодится, когда радио его забудет.
   */
  async function syncMeshtasticPeers(
    selfKey: string,
    peerOf: (num: number) => { name: string | null; publicKey: string | null } | null,
    channels: MtSessionChannel[]
  ): Promise<void> {
    for (const d of dialogs.value) {
      if (d.selfKey !== selfKey || d.network !== 'meshtastic') continue
      const parsed = parseMeshDialogId(d.id)
      if (!parsed) continue
      let name = d.name
      let publicKey = d.peerPublicKey
      if (parsed.kind === 'direct') {
        const num = nodeNumOf(parsed.key)
        const peer = num !== null ? peerOf(num) : null
        name = peer?.name || name
        publicKey = peer?.publicKey || publicKey
      } else {
        name = channels.find((x) => x.id === parsed.key)?.name || name
      }
      if (name !== d.name || publicKey !== d.peerPublicKey) {
        d.name = name
        if (publicKey) d.peerPublicKey = publicKey
        await saveDialog(d)
      }
    }
  }

  /** Личный диалог LXMF по адресу собеседника. */
  async function ensureLxmfDialog(
    self: string,
    dest: string,
    name: string | null
  ): Promise<string> {
    await ensureLoaded()
    const peer = dest.toLowerCase()
    const d = await createDialog({
      ...directFields('lxmf', self, peer, name || shortKey(peer)),
      peerKey: peer,
    })
    return d.id
  }

  /** Собеседник объявил своё имя — обновить диалог, если он есть. */
  async function syncLxmfPeer(self: string, dest: string, name: string): Promise<void> {
    const d = find(directDialogId('lxmf', self, dest))
    if (!d || d.name === name) return
    d.name = name
    await saveDialog(d)
  }

  // ─── Приём ────────────────────────────────────────────────────────────────

  /** Сообщение от радио MeshCore. */
  async function receive(m: SessionMessage, selfKey: string): Promise<void> {
    if (m.kind === 'direct' && m.room) {
      // Пост комнаты: диалог — комната, отправитель — автор (4 байта ключа).
      const author = m.authorPrefix
      await ingest({
        network: 'meshcore',
        selfKey,
        kind: 'room',
        peerKey: m.peerPrefix,
        peerFullKey: m.peerKey,
        senderKey: author,
        senderName: author ? m.senderName : m.peerName,
        dialogName: m.peerName || shortKey(m.peerPrefix),
        senderTs: m.senderTimestamp,
        text: m.text,
        uniq: `${author ?? m.peerPrefix}|${m.senderTimestamp}|${m.text}`,
        hops: m.hops,
        snr: m.snr,
      })
      return
    }
    const senderKey = m.kind === 'direct' ? m.peerPrefix : null
    await ingest({
      network: 'meshcore',
      selfKey,
      kind: m.kind,
      peerKey: m.kind === 'direct' ? m.peerPrefix : undefined,
      peerFullKey: m.kind === 'direct' ? m.peerKey : undefined,
      channel: m.kind === 'channel' ? m.channel : undefined,
      senderKey,
      senderName: m.senderName,
      dialogName: m.kind === 'direct' ? m.senderName || shortKey(m.peerPrefix) : m.channel.name,
      senderTs: m.senderTimestamp,
      text: m.text,
      // Радио повторяет ЛС, пока нет ACK: отправитель, его время и текст — те же.
      uniq: `${senderKey ?? m.senderName ?? '?'}|${m.senderTimestamp}|${m.text}`,
      hops: m.hops,
      snr: m.snr,
    })
  }

  /** Сообщение от радио Meshtastic. */
  async function receiveMeshtastic(m: MtIncoming, selfNum: number): Promise<void> {
    const peer = nodeKey(m.from)
    await ingest({
      network: 'meshtastic',
      selfKey: nodeKey(selfNum),
      kind: m.kind,
      peerKey: m.kind === 'direct' ? peer : undefined,
      channel: m.kind === 'channel' ? m.channel : undefined,
      senderKey: peer,
      senderName: m.fromName,
      dialogName: m.kind === 'direct' ? m.fromName || `!${peer}` : m.channel.name,
      senderTs: m.rxTime,
      text: m.text,
      // У пакета Meshtastic id уникален для отправителя.
      uniq: `${peer}|${m.packetId}`,
      hops: m.hops,
      snr: m.snr,
      packetId: m.packetId,
      replyToPacket: !m.reaction && m.replyId ? m.replyId : undefined,
      reactionTo: m.reaction && m.replyId ? m.replyId : undefined,
      pki: m.kind === 'direct' ? m.pki : undefined,
      peerPublicKey: m.kind === 'direct' ? m.fromKey : undefined,
    })
  }

  /** Сообщение LXMF (Reticulum). */
  async function receiveLxmf(
    m: Extract<RnsEvent, { kind: 'message' }>,
    self: string,
    fromName: string | null
  ): Promise<void> {
    const text = m.title && m.content ? `${m.title}\n${m.content}` : m.content || m.title
    const attachments: MeshAttachment[] = (m.attachments ?? []).map((a) => ({
      kind: a.kind,
      name: a.name,
      mime: a.mime,
      data: fromBase64(a.data),
    }))
    if (!text && attachments.length === 0) return
    await ingest({
      network: 'lxmf',
      selfKey: self,
      kind: 'direct',
      peerKey: m.from,
      peerFullKey: m.from,
      senderKey: m.from,
      senderName: fromName,
      dialogName: fromName || shortKey(m.from),
      senderTs: Math.floor(m.timestamp),
      text,
      // id сообщения LXMF — хэш содержимого: повтор через другой путь тот же.
      uniq: m.id,
      hops: null,
      snr: null,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  /** Судьба своего сообщения LXMF — по его id. */
  const lxmfRecords = new Map<string, MeshMessageRecord>()

  function updateLxmfState(
    id: string,
    state: 'sending' | 'sent' | 'delivered' | 'failed',
    reason?: string
  ): void {
    const record = lxmfRecords.get(id)
    if (!record) return
    // Поздний «ушло» не отменяет «доставлено».
    if (record.status === 'delivered' && state !== 'failed') return
    update(record, {
      status: state,
      error: state === 'failed' ? reason || 'send_failed' : undefined,
    })
    if (state === 'delivered' || state === 'failed') lxmfRecords.delete(id)
  }

  async function ingest(m: Incoming): Promise<void> {
    await ensureLoaded()
    if (!account.value) return
    const dialog =
      m.kind === 'direct'
        ? await createDialog({
            ...directFields(m.network, m.selfKey, m.peerKey!, m.dialogName),
            peerKey: m.peerFullKey ?? (m.network === 'meshtastic' ? m.peerKey! : null),
          })
        : m.kind === 'room'
          ? await createDialog({
              ...roomFields(m.network, m.selfKey, m.peerKey!, m.dialogName),
              peerKey: m.peerFullKey ?? null,
            })
          : await createDialog(channelFields(m.network, m.selfKey, m.channel!))
    if (m.peerPublicKey && dialog.peerPublicKey !== m.peerPublicKey) {
      dialog.peerPublicKey = m.peerPublicKey
      await saveDialog(dialog)
    }
    const dedupKey = `${dialog.id}|${m.uniq}`
    if (!rememberKey(dedupKey)) return
    const senderName = m.kind === 'direct' ? m.senderName || dialog.name : m.senderName
    const record: MeshMessageRecord = {
      id: newId(dialog.id),
      dialogId: dialog.id,
      account: account.value,
      dedupKey,
      ts: Date.now(),
      senderTs: m.senderTs,
      mine: false,
      senderId: meshSenderId(m.network, { key: m.senderKey, name: m.senderName }),
      senderName,
      text: m.text,
      status: 'received',
      hops: m.hops,
      snr: m.snr,
      packetId: m.packetId,
      replyToPacket: m.replyToPacket,
      reactionTo: m.reactionTo,
      pki: m.pki,
      attachments: m.attachments,
    }
    // Повтор ЛС (радио шлёт копию, пока нет ACK) база не примет второй раз.
    if (!(await meshAPI.addMessage(record))) return
    messages[dialog.id]?.push(record)
    // Реакция не новое сообщение: без непрочитанного и звука.
    if (m.reactionTo !== undefined) return
    dialog.lastTs = record.ts
    const shown = m.text || attachmentsLabel(m.attachments)
    dialog.lastText = m.kind !== 'direct' && m.senderName ? `${m.senderName}: ${shown}` : shown
    dialog.lastMine = false
    const ui = useMessengerUiStore()
    if (!ui.isChatOnScreen(dialog.id)) {
      dialog.unread += 1
      try {
        new Audio(glassSound).play().catch(() => {})
      } catch {
        /* нет звука — не беда */
      }
      // На Android — системное уведомление (Web Notification в WebView нет).
      const title = record.senderName || dialog.name
      if (!showRadioNotification(title, shown)) notifyMessage(title, shown)
    }
    await saveDialog(dialog)
  }

  // ─── Открытие ─────────────────────────────────────────────────────────────

  async function openDialog(id: string): Promise<void> {
    await ensureLoaded()
    const d = find(id)
    if (!d) return
    if (!messages[id]) {
      const list = await meshAPI.messages(id)
      // Приложение закрыли посреди отправки: судьба неизвестна.
      for (const m of list) {
        if (m.status === 'sending') {
          m.status = 'failed'
          void meshAPI.updateMessage(m.id, { status: 'failed' })
        }
        rememberKey(m.dedupKey)
      }
      messages[id] = list
    }
    markRead(id)
  }

  function markRead(id: string): void {
    const d = find(id)
    if (d && d.unread > 0) {
      d.unread = 0
      void saveDialog(d)
    }
  }

  function messengerMessages(id: string): Message[] {
    return meshMessagesToMessenger(messages[id] ?? [])
  }

  // ─── Отправка ─────────────────────────────────────────────────────────────

  /** Предел текста одного сообщения в байтах UTF-8. */
  function textLimit(dialogId: string): number {
    const parsed = parseMeshDialogId(dialogId)
    if (parsed?.network === 'lxmf') return LXMF_MAX_TEXT_BYTES
    if (parsed?.network === 'meshtastic') return MT_MAX_TEXT_BYTES
    // Комната пересылает пост с 4 байтами ключа автора — они съедают место.
    if (parsed?.kind === 'room') return MAX_TEXT_LEN - 4
    if (parsed?.kind !== 'channel') return MAX_TEXT_LEN
    const conn = useMeshConnectionStore()
    // Радио MeshCore допишет «имя: » перед текстом.
    const name = conn.self?.name ?? ''
    return Math.max(0, MAX_TEXT_LEN - new TextEncoder().encode(`${name}: `).length)
  }

  /** Отправить в этот диалог можно прямо сейчас: подключено то самое радио. */
  function canSend(dialogId: string): boolean {
    const d = find(dialogId)
    if (!d) return false
    if (d.network === 'meshtastic') {
      const conn = useMeshtasticConnectionStore()
      return conn.status === 'connected' && conn.selfKey === d.selfKey && !conn.regionUnset
    }
    if (d.network === 'lxmf') {
      const rns = useReticulumStore()
      return rns.status === 'running' && rns.address?.toLowerCase() === d.selfKey
    }
    const conn = useMeshConnectionStore()
    return conn.status === 'connected' && conn.selfKey === d.selfKey
  }

  function update(record: MeshMessageRecord, patch: Partial<MeshMessageRecord>): void {
    Object.assign(record, patch)
    void meshAPI.updateMessage(record.id, patch)
  }

  /**
   * Отправить текст. `replyTo` — id сообщения, на которое это ответ (Meshtastic
   * передаёт ответ по радио; в MeshCore ответов нет — уйдёт просто текст).
   */
  async function send(
    dialogId: string,
    text: string,
    opts: { replyTo?: string } = {}
  ): Promise<{ ok: true } | { ok: false; error: MeshSendError }> {
    await ensureLoaded()
    const dialog = find(dialogId)
    if (!dialog || !account.value) return { ok: false, error: 'no_dialog' }
    if (!canSend(dialogId)) return { ok: false, error: 'not_connected' }
    const parts = splitForMesh(text, textLimit(dialogId))
    if (parts === null) return { ok: false, error: 'too_long' }
    if (parts.length === 0) return { ok: false, error: 'empty' }
    if (!messages[dialogId]) await openDialog(dialogId)
    const replyToPacket =
      dialog.network === 'meshtastic' && opts.replyTo
        ? messages[dialogId]!.find((m) => m.id === opts.replyTo)?.packetId
        : undefined
    for (const [i, part] of parts.entries()) {
      const now = Date.now()
      const id = newId(dialogId)
      const record: MeshMessageRecord = {
        id,
        dialogId,
        account: account.value,
        dedupKey: id,
        ts: now,
        senderTs: Math.floor(now / 1000),
        mine: true,
        senderId: 'me',
        senderName: null,
        text: part,
        status: 'sending',
        // Ответом помечается первая часть — с неё начинается сообщение.
        replyToPacket: i === 0 ? replyToPacket : undefined,
      }
      await meshAPI.addMessage(record)
      messages[dialogId]!.push(record)
      const live = messages[dialogId]![messages[dialogId]!.length - 1]!
      dialog.lastTs = now
      dialog.lastText = part
      dialog.lastMine = true
      enqueue(dialog, live)
    }
    await saveDialog(dialog)
    return { ok: true }
  }

  /**
   * Отправить вложения (картинки уже уменьшены) с подписью — только LXMF: у
   * радио-сетей на это нет места в пакете.
   */
  async function sendAttachments(
    dialogId: string,
    attachments: MeshAttachment[],
    caption = ''
  ): Promise<{ ok: true } | { ok: false; error: MeshSendError }> {
    await ensureLoaded()
    const dialog = find(dialogId)
    if (!dialog || !account.value) return { ok: false, error: 'no_dialog' }
    if (dialog.network !== 'lxmf') return { ok: false, error: 'not_supported' }
    if (!canSend(dialogId)) return { ok: false, error: 'not_connected' }
    if (attachments.length === 0) return { ok: false, error: 'empty' }
    const size = attachments.reduce((n, a) => n + a.data.length, 0)
    if (size > LXMF_MAX_ATTACHMENT_BYTES) return { ok: false, error: 'too_large' }
    if (new TextEncoder().encode(caption).length > LXMF_MAX_TEXT_BYTES) {
      return { ok: false, error: 'too_long' }
    }
    if (!messages[dialogId]) await openDialog(dialogId)
    const now = Date.now()
    const id = newId(dialogId)
    const record: MeshMessageRecord = {
      id,
      dialogId,
      account: account.value,
      dedupKey: id,
      ts: now,
      senderTs: Math.floor(now / 1000),
      mine: true,
      senderId: 'me',
      senderName: null,
      text: caption,
      status: 'sending',
      attachments,
    }
    await meshAPI.addMessage(record)
    messages[dialogId]!.push(record)
    const live = messages[dialogId]![messages[dialogId]!.length - 1]!
    dialog.lastTs = now
    dialog.lastText = caption || attachmentsLabel(attachments)
    dialog.lastMine = true
    enqueue(dialog, live)
    await saveDialog(dialog)
    return { ok: true }
  }

  /**
   * Бумажное сообщение LXMF: узел шифрует текст собеседнику и отдаёт ссылку
   * `lxm://` — её передают как угодно (QR, текст). В чате оно остаётся своим
   * сообщением. Возвращает ссылку.
   */
  async function sendPaper(
    dialogId: string,
    text: string
  ): Promise<{ ok: true; uri: string } | { ok: false; error: MeshSendError | string }> {
    await ensureLoaded()
    const dialog = find(dialogId)
    const body = text.trim()
    if (!dialog || !account.value || !dialog.peerKey) return { ok: false, error: 'no_dialog' }
    if (dialog.network !== 'lxmf') return { ok: false, error: 'not_supported' }
    if (!canSend(dialogId)) return { ok: false, error: 'not_connected' }
    if (!body) return { ok: false, error: 'empty' }
    let uri: string
    try {
      uri = (await rnsPaper(dialog.peerKey, body)).uri
    } catch (e) {
      return { ok: false, error: errorCode(e) }
    }
    if (!messages[dialogId]) await openDialog(dialogId)
    const now = Date.now()
    const id = newId(dialogId)
    const record: MeshMessageRecord = {
      id,
      dialogId,
      account: account.value,
      dedupKey: id,
      ts: now,
      senderTs: Math.floor(now / 1000),
      mine: true,
      senderId: 'me',
      senderName: null,
      text: body,
      status: 'sent',
    }
    await meshAPI.addMessage(record)
    messages[dialogId]!.push(record)
    dialog.lastTs = now
    dialog.lastText = body
    dialog.lastMine = true
    await saveDialog(dialog)
    return { ok: true, uri }
  }

  /**
   * Реакция эмодзи на сообщение (Meshtastic: текст-эмодзи со ссылкой на пакет,
   * как в официальных приложениях). Своя реакция видна сразу.
   */
  async function react(dialogId: string, messageId: string, emoji: string): Promise<boolean> {
    await ensureLoaded()
    const dialog = find(dialogId)
    const target = messages[dialogId]?.find((m) => m.id === messageId)
    if (!dialog || dialog.network !== 'meshtastic' || !account.value) return false
    if (target?.packetId === undefined || !canSend(dialogId)) return false
    const now = Date.now()
    const id = newId(dialogId)
    const record: MeshMessageRecord = {
      id,
      dialogId,
      account: account.value,
      dedupKey: id,
      ts: now,
      senderTs: Math.floor(now / 1000),
      mine: true,
      senderId: 'me',
      senderName: null,
      text: emoji,
      status: 'sending',
      reactionTo: target.packetId,
    }
    await meshAPI.addMessage(record)
    messages[dialogId]!.push(record)
    enqueue(dialog, messages[dialogId]![messages[dialogId]!.length - 1]!)
    return true
  }

  /** Повторить своё недоставленное сообщение. */
  async function retry(dialogId: string, messageId: string): Promise<boolean> {
    const dialog = find(dialogId)
    // Вложение показано своим сообщением «<запись>#<номер>» — повторяется запись.
    const recordId = messageId.replace(/#\d+$/, '')
    const record = messages[dialogId]?.find((m) => m.id === recordId)
    if (!dialog || !record || !record.mine || record.status !== 'failed') return false
    if (!canSend(dialogId)) return false
    update(record, { status: 'sending', error: undefined, relayed: undefined })
    enqueue(dialog, record)
    return true
  }

  function enqueue(dialog: MeshDialogRecord, record: MeshMessageRecord): void {
    const prev = sendChains.get(dialog.id) ?? Promise.resolve()
    const next = prev.then(() => transmit(dialog, record)).catch(() => {})
    sendChains.set(dialog.id, next)
  }

  /** Отдать радио одно сообщение; промис — когда радио его приняло или отказало. */
  function transmit(dialog: MeshDialogRecord, record: MeshMessageRecord): Promise<void> {
    if (!canSend(dialog.id)) {
      update(record, { status: 'failed', error: 'not_connected' })
      return Promise.resolve()
    }
    if (dialog.network === 'lxmf') return transmitLxmf(dialog, record)
    return dialog.network === 'meshtastic'
      ? transmitMeshtastic(dialog, record)
      : transmitMeshcore(dialog, record)
  }

  /** Ждать, пока радио возьмёт сообщение; дальше статусы приходят сами. */
  function untilAccepted(
    start: (onUpdate: (patch: Partial<MeshMessageRecord>) => void) => Promise<unknown>,
    record: MeshMessageRecord
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let released = false
      const release = (): void => {
        if (!released) {
          released = true
          resolve()
        }
      }
      start((patch) => {
        update(record, patch)
        release()
      }).catch((e: unknown) => {
        update(record, { status: 'failed', error: errorCode(e) })
        release()
      })
    })
  }

  function transmitMeshcore(dialog: MeshDialogRecord, record: MeshMessageRecord): Promise<void> {
    const session = useMeshConnectionStore().session
    const parsed = parseMeshDialogId(dialog.id)
    if (!session || !parsed) {
      update(record, { status: 'failed', error: 'not_connected' })
      return Promise.resolve()
    }
    if (parsed.kind === 'channel') {
      const channel = session.channels.find((c) => c.id === parsed.key)
      if (!channel) {
        update(record, { status: 'failed', error: 'channel_not_found' })
        return Promise.resolve()
      }
      return session
        .sendChannel(channel, record.text, record.senderTs)
        .then(() => update(record, { status: 'sent' }))
        .catch((e: unknown) => update(record, { status: 'failed', error: errorCode(e) }))
    }
    const peerKey = dialog.peerKey ?? session.findContact(parsed.key)?.publicKey ?? null
    if (!peerKey) {
      update(record, { status: 'failed', error: 'not_in_contacts' })
      return Promise.resolve()
    }
    return untilAccepted(
      (onUpdate) =>
        session.sendDirect(peerKey, record.text, record.senderTs, (u) => {
          const status: MeshMessageStatus = u.status
          onUpdate({ status, attempt: u.attempt, flood: u.flood, error: u.error })
        }),
      record
    )
  }

  function transmitMeshtastic(dialog: MeshDialogRecord, record: MeshMessageRecord): Promise<void> {
    const session = useMeshtasticConnectionStore().session
    const parsed = parseMeshDialogId(dialog.id)
    if (!session || !parsed) {
      update(record, { status: 'failed', error: 'not_connected' })
      return Promise.resolve()
    }
    let target: { kind: 'direct'; num: number } | { kind: 'channel'; index: number }
    if (parsed.kind === 'channel') {
      const channel = session.channels.find((c) => c.id === parsed.key)
      if (!channel) {
        update(record, { status: 'failed', error: 'channel_not_found' })
        return Promise.resolve()
      }
      target = { kind: 'channel', index: channel.index }
    } else {
      const num = nodeNumOf(parsed.key)
      if (num === null) {
        update(record, { status: 'failed', error: 'no_dialog' })
        return Promise.resolve()
      }
      target = { kind: 'direct', num }
    }
    const reaction = record.reactionTo !== undefined
    const extra = {
      replyId: reaction ? record.reactionTo : record.replyToPacket,
      emoji: reaction,
      peer: dialog.peerPublicKey
        ? { publicKey: dialog.peerPublicKey, longName: dialog.name }
        : null,
    }
    return untilAccepted(async (onUpdate) => {
      const packetId = await session.sendText(
        target,
        record.text,
        (u) =>
          onUpdate({
            status: u.status,
            error: u.error,
            relayed: u.relayed,
            // Прошивка могла отбросить текст по лимиту — он ушёл под новым id.
            ...(u.packetId !== undefined ? { packetId: u.packetId } : {}),
          }),
        extra
      )
      if (record.packetId === undefined) update(record, { packetId })
    }, record)
  }

  /**
   * LXMF: узел сам выбирает способ (один пакет, Link или узел доставки) и
   * сообщает судьбу событием `state` — здесь только «узел взял».
   */
  async function transmitLxmf(dialog: MeshDialogRecord, record: MeshMessageRecord): Promise<void> {
    const to = dialog.peerKey
    if (!to) {
      update(record, { status: 'failed', error: 'no_dialog' })
      return
    }
    try {
      const attachments = (record.attachments ?? []).map((a) => ({
        kind: a.kind,
        name: a.name,
        mime: a.mime,
        data: toBase64(a.data),
      }))
      // Собеседнику по mesh-маршруту — своя запись связки к первому сообщению.
      const custom = await useMeshRoutesStore().customFor(to)
      const { id } = await rnsSend(to, record.text, 'auto', '', attachments, custom)
      update(record, { lxmfId: id })
      lxmfRecords.set(id, record)
    } catch (e) {
      update(record, { status: 'failed', error: errorCode(e) })
    }
  }

  // ─── Удаление и сброс ─────────────────────────────────────────────────────

  async function deleteDialog(id: string): Promise<void> {
    dialogs.value = dialogs.value.filter((d) => d.id !== id)
    delete messages[id]
    await meshAPI.deleteDialog(id)
  }

  /**
   * Смена аккаунта или выход. `purge` — стереть переписку аккаунта с диска
   * (выход), как мессенджер стирает расшифровки Matrix.
   */
  function reset(opts: { purge?: boolean } = {}): void {
    const previous = account.value
    account.value = null
    forgetMeshMedia()
    dialogs.value = []
    for (const key of Object.keys(messages)) delete messages[key]
    recentKeys.clear()
    sendChains.clear()
    lxmfRecords.clear()
    if (opts.purge && previous) void meshAPI.purgeAccount(previous)
  }

  async function purgeAccount(address: string): Promise<void> {
    if (account.value === address) reset()
    await meshAPI.purgeAccount(address)
  }

  return {
    account,
    dialogs,
    messages,
    messengerDialogs,
    totalUnread,
    ensureLoaded,
    ensureDirectDialog,
    ensureChannelDialog,
    ensureRoomDialog,
    ensureMeshtasticDirectDialog,
    ensureMeshtasticChannelDialog,
    syncNames,
    syncMeshtasticPeers,
    receive,
    receiveMeshtastic,
    receiveLxmf,
    sendAttachments,
    sendPaper,
    updateLxmfState,
    ensureLxmfDialog,
    syncLxmfPeer,
    openDialog,
    markRead,
    messengerMessages,
    textLimit,
    canSend,
    send,
    react,
    retry,
    deleteDialog,
    reset,
    purgeAccount,
  }
})

function errorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: unknown }).code
    // Отказ с причиной (channel_not_found) — по причине.
    const message = e instanceof Error ? e.message : ''
    if (code === 'rejected' && /^[a-z_]+$/.test(message) && message !== 'rejected') return message
    if (typeof code === 'string') return code
  }
  return 'send_failed'
}
