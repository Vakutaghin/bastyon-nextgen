// Переписка, сохранённая на устройстве. Сервер чатов стирает сообщения старше
// трёх месяцев; с включённым сохранением они остаются здесь и видны в чате.
//
// Хранится в IndexedDB (db/apis/chat-archive-api) шифротекстом: ключ — от
// приватного ключа аккаунта (lib/archive-crypto), без входа в аккаунт копию не
// прочитать. Что сохранять — настройка аккаунта (lib/archive-prefs). Новые
// сообщения пишет фоновая синхронизация (messenger-store/use-archive-sync), в
// ленту чата копию подмешивает загрузка истории (use-message-loading).

import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { chatArchiveAPI, type ArchiveChatStats } from '@/db/apis/chat-archive-api'
import { settingsAPI } from '@/db/apis/settings-api'
import type { ChatArchiveChat, ChatArchiveRecord } from '@/db/types'

import { deriveArchiveKey, openJson, sealJson } from '../lib/archive-crypto'
import { earliestServerTs, findGoneBoundary, mergeWithArchive } from '../lib/archive-merge'
import {
  DEFAULT_ARCHIVE_PREFS,
  isChatArchived,
  sanitizeArchivePrefs,
  withChat,
  type ArchiveMode,
  type ArchivePrefs,
} from '../lib/archive-prefs'
import { matrixService } from '../services/matrix-service'
import { resolveMediaUrl } from '../services/matrix-service/mxc-resolver'
import { isMeshTransport, type Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from './consts'
import {
  mapMediaContent,
  mediaTypeOf,
  type MediaContent,
} from './messenger-chat-store/media-content'

/** Ключ настроек сохранения в таблице settings: `chatArchive:<адрес>`. */
export const ARCHIVE_PREFS_KEY = 'chatArchive'

/** Сколько сохранённых сообщений подгружать в ленту за раз. */
const ARCHIVE_PAGE = 50

/** Что лежит в записи шифротекстом: сообщение без чата, id и времени (они открыты). */
type ArchivedMessage = Pick<
  Message,
  'senderId' | 'senderName' | 'text' | 'type' | 'url' | 'info' | 'rawContent' | 'encrypted'
> & { replyTo?: string; reactions?: Message['reactions'] }

/** Подпись чата: комнаты может уже не быть, а в настройках его видно. */
export interface ArchiveChatInfo {
  name: string
  avatar?: string
  group?: boolean
}

/** Сохранённые сообщения чата, подмешанные в ленту. */
interface ChatView {
  messages: Message[]
  /** Раньше этого времени копию ещё не читали. */
  floor: number
  /** Прочитано всё, что сохранено. */
  exhausted: boolean
}

/** Записывать в копию можно только то, что дошло до сервера и прочиталось. */
export function isSavable(m: Message): boolean {
  return (
    m.id.startsWith('$') &&
    !m.deleted &&
    !isMeshTransport(m.transport) &&
    m.status !== 'failed' &&
    m.status !== 'sending' &&
    m.text !== ENCRYPTED_MESSAGE_PLACEHOLDER
  )
}

function toArchived(m: Message): ArchivedMessage {
  const info = m.info ? { ...m.info } : undefined
  if (info) delete info.uploadProgress
  return {
    senderId: m.senderId,
    senderName: m.senderName,
    text: m.text,
    type: m.type,
    url: m.url,
    info,
    rawContent: m.rawContent,
    encrypted: m.encrypted,
    replyTo: m.replyTo?.id,
    reactions: m.reactions?.length ? m.reactions : undefined,
  }
}

function fromArchived(chatId: string, id: string, ts: number, a: ArchivedMessage): Message {
  const message: Message = {
    id,
    chatId,
    senderId: a.senderId,
    senderName: a.senderName,
    text: a.text,
    type: a.type,
    url: a.url,
    info: a.info,
    rawContent: a.rawContent ?? null,
    timestamp: ts,
    read: true,
    status: 'sent',
    encrypted: a.encrypted,
    ...(a.replyTo ? { replyTo: { id: a.replyTo } } : {}),
    ...(a.reactions ? { reactions: a.reactions } : {}),
  }
  // Ссылка на файл — через нынешний адрес сервера: он мог смениться.
  const client = matrixService.getClient()
  const media = mediaTypeOf((a.rawContent as { msgtype?: unknown } | null)?.msgtype)
  if (client && media && media === a.type && a.rawContent) {
    const mapped = mapMediaContent(a.rawContent as MediaContent, media, (url) =>
      resolveMediaUrl(client, url)
    )
    message.url = mapped.url ?? a.url
    message.info = mapped.info.secrets ? mapped.info : { ...mapped.info, ...pickSecrets(a.info) }
  }
  return message
}

/** Ключ файла, развёрнутый при первом показе, — из сохранённого info. */
function pickSecrets(info: Message['info']): Record<string, unknown> {
  return info?.secrets ? { secrets: info.secrets } : {}
}

export const useMessengerArchiveStore = defineStore('messenger-archive', () => {
  /** Чья копия открыта: адрес аккаунта. */
  const account = ref<string | null>(null)
  /** Ключ копии в памяти; без него не пишем и не читаем. */
  let key: CryptoKey | null = null
  /** Номер входа: работа прежнего аккаунта после смены ничего не пишет. */
  let generation = 0
  const ready = ref(false)
  const prefs = ref<ArchivePrefs>({ ...DEFAULT_ARCHIVE_PREFS })
  /** Сколько сохранено по чатам — для настроек. */
  const stats = reactive<Record<string, ArchiveChatStats>>({})
  /** Подписи сохранённых чатов. */
  const infos = reactive<Record<string, ArchiveChatInfo>>({})
  /** Сообщения с этим временем и раньше на сервере уже стёрты, мс. */
  const goneBefore = reactive<Record<string, number>>({})

  const views = new Map<string, ChatView>()
  const known = new Map<string, Set<string>>()
  const metas = new Map<string, ChatArchiveChat>()
  const removedListeners = new Set<(chatId: string) => void>()

  const prefsKey = (address: string) => `${ARCHIVE_PREFS_KEY}:${address}`

  const isArchived = (chatId: string): boolean => ready.value && isChatArchived(prefs.value, chatId)

  const hasCopy = (chatId: string): boolean => (stats[chatId]?.count ?? 0) > 0

  /** Открыть копию аккаунта: ключ, настройки, что сохранено. */
  async function attach(address: string, privateKey: ArrayLike<number>): Promise<void> {
    if (account.value === address && ready.value) return
    reset()
    const run = generation
    account.value = address
    try {
      const nextKey = await deriveArchiveKey(privateKey)
      const [rawPrefs, counted, chats] = await Promise.all([
        settingsAPI.get(prefsKey(address)),
        chatArchiveAPI.stats(address),
        chatArchiveAPI.chats(address),
      ])
      if (run !== generation) return
      key = nextKey
      prefs.value = sanitizeArchivePrefs(rawPrefs)
      Object.assign(stats, counted)
      for (const chat of chats) {
        metas.set(chat.chatId, chat)
        if (chat.goneBefore) goneBefore[chat.chatId] = chat.goneBefore
        if (chat.iv && chat.data) {
          const info = await openJson<ArchiveChatInfo>(nextKey, { iv: chat.iv, data: chat.data })
          if (info && run === generation) infos[chat.chatId] = info
        }
      }
      if (run === generation) ready.value = true
    } catch (e) {
      console.warn('[archive] attach failed:', e)
    }
  }

  /** Закрыть копию (выход, смена аккаунта). Сама копия остаётся на устройстве. */
  function reset(): void {
    generation++
    key = null
    ready.value = false
    account.value = null
    prefs.value = { ...DEFAULT_ARCHIVE_PREFS }
    for (const id of Object.keys(stats)) delete stats[id]
    for (const id of Object.keys(infos)) delete infos[id]
    for (const id of Object.keys(goneBefore)) delete goneBefore[id]
    views.clear()
    known.clear()
    metas.clear()
  }

  async function savePrefs(next: ArchivePrefs): Promise<void> {
    // Простой объект: в `chats` остаётся Proxy реактивного состояния, а его
    // IndexedDB не сохраняет (DataCloneError) — и выбор терялся молча.
    const plain = sanitizeArchivePrefs(JSON.parse(JSON.stringify(next)))
    prefs.value = plain
    if (account.value) await settingsAPI.set(prefsKey(account.value), plain)
  }

  const setEnabled = (enabled: boolean) => savePrefs({ ...prefs.value, enabled })
  const setMode = (mode: ArchiveMode) => savePrefs({ ...prefs.value, mode })
  const setChat = (chatId: string, on: boolean) => savePrefs(withChat(prefs.value, chatId, on))

  async function knownIds(chatId: string): Promise<Set<string>> {
    let ids = known.get(chatId)
    if (ids) return ids
    const address = account.value
    ids = new Set(address ? await chatArchiveAPI.ids(address, chatId) : [])
    // Пока читали, могли записать ещё — не теряем.
    const raced = known.get(chatId)
    if (raced) for (const id of raced) ids.add(id)
    known.set(chatId, ids)
    return ids
  }

  /** Какие из этих id уже сохранены. */
  async function savedAmong(chatId: string, ids: string[]): Promise<Set<string>> {
    const all = await knownIds(chatId)
    return new Set(ids.filter((id) => all.has(id)))
  }

  /**
   * Записать сообщения. Уже сохранённые не переписываются, кроме `refresh`
   * (у них поменялись реакции). Удалённые на сервере — стираются.
   */
  async function save(
    chatId: string,
    list: readonly Message[],
    opts: { refresh?: ReadonlySet<string> } = {}
  ): Promise<number> {
    const address = account.value
    const run = generation
    if (!address || !key || !isArchived(chatId)) return 0
    const deleted = list.filter((m) => m.deleted && m.id.startsWith('$')).map((m) => m.id)
    if (deleted.length) await remove(chatId, deleted)
    const ids = await knownIds(chatId)
    const fresh = list.filter((m) => isSavable(m) && (!ids.has(m.id) || opts.refresh?.has(m.id)))
    if (!fresh.length || run !== generation) return 0
    const records: ChatArchiveRecord[] = []
    for (const m of fresh) {
      const sealed = await sealJson(key, toArchived(m))
      records.push({ account: address, chatId, id: m.id, ts: m.timestamp, ...sealed })
    }
    if (run !== generation) return 0
    await chatArchiveAPI.put(records)
    let added = 0
    for (const r of records) {
      if (ids.has(r.id)) continue
      ids.add(r.id)
      added++
      const row = stats[chatId]
      if (!row) stats[chatId] = { count: 1, firstTs: r.ts, lastTs: r.ts }
      else {
        row.count += 1
        row.firstTs = Math.min(row.firstTs, r.ts)
        row.lastTs = Math.max(row.lastTs, r.ts)
      }
    }
    return added
  }

  /** Стереть сообщения из копии: удалены у всех. */
  async function remove(chatId: string, ids: readonly string[]): Promise<void> {
    const address = account.value
    if (!address || !ids.length || !hasCopy(chatId)) return
    const saved = await knownIds(chatId)
    const present = ids.filter((id) => saved.has(id))
    if (!present.length) return
    await chatArchiveAPI.remove(address, chatId, present)
    for (const id of present) saved.delete(id)
    const view = views.get(chatId)
    if (view) view.messages = view.messages.filter((m) => !present.includes(m.id))
    const row = stats[chatId]
    if (row) {
      row.count = Math.max(0, row.count - present.length)
      if (!row.count) delete stats[chatId]
    }
  }

  /**
   * Удаление, присланное участником (lib/archive-redact): своё сообщение
   * удалить может автор, чужое — только с правами в комнате (`privileged`).
   * Какие стёрты.
   */
  async function removeAuthored(
    chatId: string,
    ids: readonly string[],
    sender: string,
    privileged: boolean
  ): Promise<string[]> {
    const address = account.value
    if (!address || !key || !ids.length || !hasCopy(chatId)) return []
    const saved = await knownIds(chatId)
    const present = ids.filter((id) => saved.has(id))
    if (!present.length) return []
    let allowed = present
    if (!privileged) {
      allowed = []
      for (const row of await chatArchiveAPI.get(address, chatId, present)) {
        const a = await openJson<ArchivedMessage>(key, row)
        if (a?.senderId === sender) allowed.push(row.id)
      }
    }
    await remove(chatId, allowed)
    return allowed
  }

  /** Стереть копию чата целиком. */
  async function removeChat(chatId: string): Promise<void> {
    const address = account.value
    if (!address) return
    await chatArchiveAPI.removeChat(address, chatId)
    forgetChat(chatId)
    removedListeners.forEach((fn) => fn(chatId))
  }

  /** Стереть всю сохранённую переписку аккаунта. */
  async function removeAll(): Promise<void> {
    const address = account.value
    if (!address) return
    const chats = Object.keys(stats)
    await chatArchiveAPI.removeAccount(address)
    for (const chatId of new Set([...chats, ...metas.keys()])) {
      forgetChat(chatId)
      removedListeners.forEach((fn) => fn(chatId))
    }
  }

  function forgetChat(chatId: string): void {
    delete stats[chatId]
    delete infos[chatId]
    delete goneBefore[chatId]
    views.delete(chatId)
    known.delete(chatId)
    metas.delete(chatId)
  }

  /** Копию чата стёрли: лента убирает подмешанные из неё сообщения. */
  function onChatRemoved(fn: (chatId: string) => void): () => void {
    removedListeners.add(fn)
    return () => removedListeners.delete(fn)
  }

  async function readRecords(records: ChatArchiveRecord[]): Promise<Message[]> {
    if (!key) return []
    const out: Message[] = []
    for (const r of records) {
      const a = await openJson<ArchivedMessage>(key, r)
      if (a) out.push(fromArchived(r.chatId, r.id, r.ts, a))
    }
    return out
  }

  async function loadPage(chatId: string, view: ChatView, before: number): Promise<void> {
    const address = account.value
    if (!address) return
    const rows = await chatArchiveAPI.before(address, chatId, before, ARCHIVE_PAGE)
    const page = await readRecords(rows)
    const have = new Set(view.messages.map((m) => m.id))
    view.messages = [...page.filter((m) => !have.has(m.id)), ...view.messages]
    view.floor = rows.length ? Math.min(before, rows[0]!.ts) : before
    if (rows.length < ARCHIVE_PAGE) view.exhausted = true
  }

  /**
   * Лента сервера вместе с копией. `exhausted` — сервер старше ничего не
   * отдаст: тогда показываем сохранённое раньше его ленты, страницу за
   * страницей (`older` — следующую). `more` — в копии есть ещё раньше.
   */
  async function mergeInto(
    chatId: string,
    server: Message[],
    opts: { exhausted: boolean; reachedStart: boolean; older?: boolean }
  ): Promise<{ messages: Message[]; more: boolean }> {
    if (!ready.value || !key || !hasCopy(chatId)) return { messages: server, more: false }
    const view = views.get(chatId) ?? { messages: [], floor: Infinity, exhausted: false }
    views.set(chatId, view)
    const minServer = earliestServerTs(server)
    const exhausted = opts.exhausted || !Number.isFinite(minServer)
    if (opts.reachedStart) {
      // Лента сервера с самого начала: всё, что раньше неё, он уже стёр.
      void noteGone(chatId, Number.isFinite(minServer) ? minServer - 1 : Date.now())
    }
    if (exhausted && !view.exhausted) {
      const haveOlder = view.messages.some((m) => m.timestamp < minServer)
      if (opts.older || !haveOlder) await loadPage(chatId, view, Math.min(view.floor, minServer))
    }
    return {
      messages: mergeWithArchive(server, view.messages, goneBefore[chatId] ?? 0),
      more: exhausted && !view.exhausted,
    }
  }

  async function noteGone(chatId: string, ts: number): Promise<void> {
    if (ts <= (goneBefore[chatId] ?? 0)) return
    goneBefore[chatId] = ts
    await patchMeta(chatId, { goneBefore: ts })
  }

  /**
   * Что из сохранённого раньше ленты сервера он уже стёр: двоичным поиском по
   * ответам сервера (`isGone`). true — граница сдвинулась.
   */
  async function probeGone(
    chatId: string,
    before: number,
    isGone: (id: string) => Promise<boolean | null>
  ): Promise<boolean> {
    const address = account.value
    if (!address || !hasCopy(chatId)) return false
    const floor = goneBefore[chatId] ?? 0
    const candidates = (await chatArchiveAPI.keysBefore(address, chatId, before)).filter(
      (c) => c.ts > floor
    )
    if (!candidates.length) return false
    const last = await findGoneBoundary(candidates, isGone)
    if (last === null || last < 0) return false
    await noteGone(chatId, candidates[last]!.ts)
    return true
  }

  /** Id самого раннего сохранённого сообщения: от него история догружается дальше назад. */
  async function oldestId(chatId: string): Promise<string | null> {
    const address = account.value
    return address ? ((await chatArchiveAPI.first(address, chatId))?.id ?? null) : null
  }

  /** Запись о чате: подпись, граница стёртого, догрузка истории. */
  async function meta(chatId: string): Promise<ChatArchiveChat | null> {
    const address = account.value
    if (!address) return null
    let row = metas.get(chatId) ?? (await chatArchiveAPI.getChat(address, chatId))
    if (!row) {
      row = { account: address, chatId, goneBefore: 0, walks: [], backfilled: false, updatedAt: 0 }
    }
    metas.set(chatId, row)
    return row
  }

  async function patchMeta(chatId: string, patch: Partial<ChatArchiveChat>): Promise<void> {
    const run = generation
    const row = await meta(chatId)
    if (!row || run !== generation) return
    Object.assign(row, patch, { updatedAt: Date.now() })
    await chatArchiveAPI.putChat({ ...row, walks: row.walks.map((w) => ({ ...w })) })
  }

  /** Запомнить подпись чата (шифротекстом): в настройках он виден и без комнаты. */
  async function noteInfo(chatId: string, info: ArchiveChatInfo): Promise<void> {
    const current = infos[chatId]
    if (!key || (current?.name === info.name && current.avatar === info.avatar)) return
    const clean: ArchiveChatInfo = { name: info.name, group: info.group || undefined }
    // Картинка группы бывает data:-строкой на сотни килобайт — такую не храним.
    if (info.avatar && info.avatar.length < 2048) clean.avatar = info.avatar
    infos[chatId] = clean
    await patchMeta(chatId, await sealJson(key, clean))
  }

  return {
    account,
    ready,
    prefs,
    stats,
    infos,
    goneBefore,
    isArchived,
    hasCopy,
    attach,
    reset,
    setEnabled,
    setMode,
    setChat,
    save,
    savedAmong,
    remove,
    removeAuthored,
    removeChat,
    removeAll,
    onChatRemoved,
    mergeInto,
    probeGone,
    oldestId,
    meta,
    patchMeta,
    noteInfo,
  }
})
