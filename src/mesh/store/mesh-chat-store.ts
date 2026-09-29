/**
 * Переписка в mesh-сетях: диалоги и сообщения аккаунта, приём и отправка.
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
import { channelDialogId, directDialogId, meshSenderId, parseMeshDialogId } from '../ids'
import type { McContact } from '../meshcore/codec'
import { MAX_TEXT_LEN } from '../meshcore/constants'
import type { SessionChannel, SessionMessage } from '../meshcore/session'
import { splitForMesh } from '../text'
import { meshDialogToMessenger, meshMessageToMessenger } from './messenger-mapping'
import { useMeshConnectionStore } from './mesh-connection-store'

/** Сколько ключей недавних сообщений помнить в памяти — на случай, если база недоступна. */
const RECENT_KEYS = 1000

export type MeshSendError = 'not_connected' | 'too_long' | 'empty' | 'no_dialog'

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

  /** Личный диалог с контактом радио (для «Написать» на странице Mesh). */
  async function ensureDirectDialog(selfKey: string, contact: McContact): Promise<string> {
    await ensureLoaded()
    const id = directDialogId('meshcore', selfKey, contact.publicKey)
    const d = await createDialog({
      id,
      network: 'meshcore',
      selfKey: selfKey.slice(0, 12),
      kind: 'direct',
      peerKey: contact.publicKey,
      name: contact.name || shortKey(contact.publicKey),
    })
    return d.id
  }

  async function ensureChannelDialog(selfKey: string, channel: SessionChannel): Promise<string> {
    await ensureLoaded()
    const id = channelDialogId('meshcore', selfKey, channel.id)
    const d = await createDialog({
      id,
      network: 'meshcore',
      selfKey: selfKey.slice(0, 12),
      kind: 'channel',
      peerKey: null,
      channelKind: channel.kind,
      name: channel.name,
    })
    return d.id
  }

  /** Имена контактов и каналов поменялись на радио — обновить диалоги. */
  async function syncNames(
    selfKey: string,
    contacts: McContact[],
    channels: SessionChannel[]
  ): Promise<void> {
    const self = selfKey.slice(0, 12)
    for (const d of dialogs.value) {
      if (d.selfKey !== self) continue
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

  // ─── Приём ────────────────────────────────────────────────────────────────

  async function receive(m: SessionMessage, selfKey: string): Promise<void> {
    await ensureLoaded()
    if (!account.value) return
    const dialog =
      m.kind === 'direct'
        ? await createDialog({
            id: directDialogId('meshcore', selfKey, m.peerPrefix),
            network: 'meshcore',
            selfKey: selfKey.slice(0, 12),
            kind: 'direct',
            peerKey: m.peerKey,
            name: m.senderName || shortKey(m.peerPrefix),
          })
        : await createDialog({
            id: channelDialogId('meshcore', selfKey, m.channel.id),
            network: 'meshcore',
            selfKey: selfKey.slice(0, 12),
            kind: 'channel',
            peerKey: null,
            channelKind: m.channel.kind,
            name: m.channel.name,
          })
    const senderKey = m.kind === 'direct' ? m.peerPrefix : null
    const dedupKey = `${dialog.id}|${senderKey ?? m.senderName ?? '?'}|${m.senderTimestamp}|${m.text}`
    if (!rememberKey(dedupKey)) return
    const record: MeshMessageRecord = {
      id: newId(dialog.id),
      dialogId: dialog.id,
      account: account.value,
      dedupKey,
      ts: Date.now(),
      senderTs: m.senderTimestamp,
      mine: false,
      senderId: meshSenderId('meshcore', { key: senderKey, name: m.senderName }),
      senderName: m.kind === 'direct' ? m.senderName || dialog.name : m.senderName,
      text: m.text,
      status: 'received',
      hops: m.hops,
      snr: m.snr,
    }
    // Повтор ЛС (радио шлёт копию, пока нет ACK) база не примет второй раз.
    if (!(await meshAPI.addMessage(record))) return
    messages[dialog.id]?.push(record)
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
    return (messages[id] ?? []).map(meshMessageToMessenger)
  }

  // ─── Отправка ─────────────────────────────────────────────────────────────

  /** Предел текста одного сообщения в байтах UTF-8. */
  function textLimit(dialogId: string): number {
    const parsed = parseMeshDialogId(dialogId)
    if (parsed?.kind !== 'channel') return MAX_TEXT_LEN
    const conn = useMeshConnectionStore()
    // Радио допишет «имя: » перед текстом.
    const name = conn.self?.name ?? ''
    return Math.max(0, MAX_TEXT_LEN - new TextEncoder().encode(`${name}: `).length)
  }

  /** Отправить в этот диалог можно прямо сейчас: подключено то самое радио. */
  function canSend(dialogId: string): boolean {
    const d = find(dialogId)
    const conn = useMeshConnectionStore()
    return !!d && conn.status === 'connected' && conn.selfKey === d.selfKey
  }

  function update(record: MeshMessageRecord, patch: Partial<MeshMessageRecord>): void {
    Object.assign(record, patch)
    void meshAPI.updateMessage(record.id, patch)
  }

  async function send(
    dialogId: string,
    text: string
  ): Promise<{ ok: true } | { ok: false; error: MeshSendError }> {
    await ensureLoaded()
    const dialog = find(dialogId)
    if (!dialog || !account.value) return { ok: false, error: 'no_dialog' }
    if (!canSend(dialogId)) return { ok: false, error: 'not_connected' }
    const parts = splitForMesh(text, textLimit(dialogId))
    if (parts === null) return { ok: false, error: 'too_long' }
    if (parts.length === 0) return { ok: false, error: 'empty' }
    if (!messages[dialogId]) await openDialog(dialogId)
    for (const part of parts) {
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

  /** Повторить своё недоставленное сообщение (то же время — получатель узнает повтор). */
  async function retry(dialogId: string, messageId: string): Promise<boolean> {
    const dialog = find(dialogId)
    const record = messages[dialogId]?.find((m) => m.id === messageId)
    if (!dialog || !record || !record.mine || record.status !== 'failed') return false
    if (!canSend(dialogId)) return false
    update(record, { status: 'sending', error: undefined })
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
    const session = useMeshConnectionStore().session
    const parsed = parseMeshDialogId(dialog.id)
    if (!session || !parsed || !canSend(dialog.id)) {
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
    return new Promise<void>((resolve) => {
      let released = false
      const release = (): void => {
        if (!released) {
          released = true
          resolve()
        }
      }
      session
        .sendDirect(peerKey, record.text, record.senderTs, (u) => {
          const status: MeshMessageStatus = u.status
          update(record, { status, attempt: u.attempt, flood: u.flood, error: u.error })
          release()
        })
        .catch((e: unknown) => {
          update(record, { status: 'failed', error: errorCode(e) })
          release()
        })
    })
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
    syncNames,
    receive,
    openDialog,
    markRead,
    messengerMessages,
    textLimit,
    canSend,
    send,
    retry,
    deleteDialog,
    reset,
    purgeAccount,
  }
})

function errorCode(e: unknown): string {
  if (
    e &&
    typeof e === 'object' &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  ) {
    return (e as { code: string }).code
  }
  return 'send_failed'
}
