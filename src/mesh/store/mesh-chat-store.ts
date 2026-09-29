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
import type { MeshDialogRecord, MeshMessageRecord, MeshMessageStatus } from '@/db/types'
import { notifyMessage } from '@/composables/use-browser-notifications'
import { useMessengerUiStore } from '@/b-components/messenger/store/messenger-ui-store'
import glassSound from '@/b-components/messenger/sounds/glass.mp3'
import type { Dialog, Message } from '@/b-components/messenger/types'
import {
  channelDialogId,
  directDialogId,
  meshSenderId,
  nodeKey,
  nodeNumOf,
  parseMeshDialogId,
  type MeshNetwork,
} from '../ids'
import type { McContact } from '../meshcore/codec'
import { MAX_TEXT_LEN } from '../meshcore/constants'
import type { SessionChannel, SessionMessage } from '../meshcore/session'
import { MAX_TEXT_BYTES as MT_MAX_TEXT_BYTES } from '../meshtastic/constants'
import type { MtIncoming, MtSessionChannel } from '../meshtastic/session'
import { splitForMesh } from '../text'
import { meshDialogToMessenger, meshMessagesToMessenger } from './messenger-mapping'
import { useMeshConnectionStore } from './mesh-connection-store'
import { useMeshtasticConnectionStore } from './meshtastic-connection-store'

/** Сколько ключей недавних сообщений помнить в памяти — на случай, если база недоступна. */
const RECENT_KEYS = 1000

export type MeshSendError = 'not_connected' | 'too_long' | 'empty' | 'no_dialog'

type ChannelKind = 'public' | 'hashtag' | 'private'

/** Входящее сообщение любой сети — в том виде, в каком его пишет стор. */
interface Incoming {
  network: MeshNetwork
  selfKey: string
  kind: 'direct' | 'channel'
  /** ЛС: собеседник (MeshCore — префикс ключа, Meshtastic — номер узла hex). */
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

  function directFields(network: MeshNetwork, selfKey: string, peer: string, name: string) {
    return {
      id: directDialogId(network, selfKey, peer),
      network,
      selfKey: selfKey.slice(0, 12).toLowerCase(),
      kind: 'direct' as const,
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

  async function ensureChannelDialog(selfKey: string, channel: SessionChannel): Promise<string> {
    await ensureLoaded()
    return (await createDialog(channelFields('meshcore', selfKey, channel))).id
  }

  /** Личный диалог с узлом Meshtastic. */
  async function ensureMeshtasticDirectDialog(
    selfNum: number,
    node: { num: number; name: string }
  ): Promise<string> {
    await ensureLoaded()
    const peer = nodeKey(node.num)
    const d = await createDialog({
      ...directFields('meshtastic', nodeKey(selfNum), peer, node.name),
      peerKey: peer,
    })
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
      if (parsed.kind === 'direct') {
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

  // ─── Приём ────────────────────────────────────────────────────────────────

  /** Сообщение от радио MeshCore. */
  async function receive(m: SessionMessage, selfKey: string): Promise<void> {
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

  async function ingest(m: Incoming): Promise<void> {
    await ensureLoaded()
    if (!account.value) return
    const dialog =
      m.kind === 'direct'
        ? await createDialog({
            ...directFields(m.network, m.selfKey, m.peerKey!, m.dialogName),
            peerKey: m.peerFullKey ?? (m.network === 'meshtastic' ? m.peerKey! : null),
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
    }
    // Повтор ЛС (радио шлёт копию, пока нет ACK) база не примет второй раз.
    if (!(await meshAPI.addMessage(record))) return
    messages[dialog.id]?.push(record)
    // Реакция не новое сообщение: без непрочитанного и звука.
    if (m.reactionTo !== undefined) return
    dialog.lastTs = record.ts
    dialog.lastText = m.kind === 'channel' && m.senderName ? `${m.senderName}: ${m.text}` : m.text
    dialog.lastMine = false
    const ui = useMessengerUiStore()
    if (!ui.isChatOnScreen(dialog.id)) {
      dialog.unread += 1
      try {
        new Audio(glassSound).play().catch(() => {})
      } catch {
        /* нет звука — не беда */
      }
      notifyMessage(record.senderName || dialog.name, m.text)
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
    if (parsed?.network === 'meshtastic') return MT_MAX_TEXT_BYTES
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
    const record = messages[dialogId]?.find((m) => m.id === messageId)
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
    dialogs.value = []
    for (const key of Object.keys(messages)) delete messages[key]
    recentKeys.clear()
    sendChains.clear()
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
    ensureMeshtasticDirectDialog,
    ensureMeshtasticChannelDialog,
    syncNames,
    syncMeshtasticPeers,
    receive,
    receiveMeshtastic,
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
