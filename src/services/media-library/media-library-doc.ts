// Личные списки разделов «Видео» и «Аудио»: «Сохранённые видео», «Смотреть
// позже», «Моя музыка» и личные плейлисты. Их видит только владелец: в
// блокчейне они были бы публичными, а плейлист там правится 5 раз в месяц.
//
// Хранятся в данных аккаунта Matrix (MEDIA_LIBRARY_ACCOUNT_DATA) — общие для
// устройств, как список каналов мессенджера. Два устройства могут менять их
// одновременно, поэтому у каждого элемента, названия и самого списка своё
// время изменения, и слияние идёт по записям: удалённое остаётся отметкой,
// чтобы его время победило старое «добавлено» с другого устройства.

export const MEDIA_LIBRARY_ACCOUNT_DATA = 'app.bastyon.media'

export type LibraryKind = 'video' | 'audio'

/** Встроенные списки; личные плейлисты — `p:<случайный id>`. */
export const SAVED_VIDEOS = 'saved-video'
export const WATCH_LATER = 'watch-later'
export const MY_MUSIC = 'music'

export const SYSTEM_LISTS: Readonly<Record<string, LibraryKind>> = {
  [SAVED_VIDEOS]: 'video',
  [WATCH_LATER]: 'video',
  [MY_MUSIC]: 'audio',
}

export const PLAYLIST_PREFIX = 'p:'

/** Элементов в одном списке — данные аккаунта не резиновые. */
export const LIBRARY_LIST_MAX = 1000
/** Личных плейлистов. */
export const LIBRARY_PLAYLISTS_MAX = 100
/** Отметки об удалении старше — забываем. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 3600_000

export interface LibraryItem {
  on: boolean
  /** Когда `on` или место менялись (мс). */
  t: number
  /** Ключ порядка: в личных плейлистах — по возрастанию, иначе время добавления. */
  o: number
}

export interface LibraryList {
  kind: LibraryKind
  /** Название личного плейлиста; у встроенных пусто. */
  name: string
  /** Когда менялись название или удаление (мс). */
  t: number
  deleted?: boolean
  items: Record<string, LibraryItem>
}

export interface MediaLibraryDoc {
  v: 1
  lists: Record<string, LibraryList>
}

export function emptyLibraryDoc(): MediaLibraryDoc {
  return { v: 1, lists: {} }
}

const TXID = /^[0-9a-f]{64}$/
const LIST_ID = /^(saved-video|watch-later|music|p:[A-Za-z0-9_-]{4,40})$/
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isPlaylistId(id: string): boolean {
  return id.startsWith(PLAYLIST_PREFIX)
}

/** Документ из хранилища или с сервера; чужое и битое отбрасывается. */
export function parseLibraryDoc(raw: unknown): MediaLibraryDoc {
  const doc = emptyLibraryDoc()
  const lists = (raw as { lists?: unknown } | null)?.lists
  if (!lists || typeof lists !== 'object') return doc
  for (const [id, value] of Object.entries(lists as Record<string, unknown>)) {
    if (!LIST_ID.test(id) || !value || typeof value !== 'object') continue
    const l = value as Record<string, unknown>
    const kind = SYSTEM_LISTS[id] ?? (l.kind === 'video' || l.kind === 'audio' ? l.kind : null)
    if (!kind || !num(l.t)) continue
    const list: LibraryList = {
      kind,
      name: typeof l.name === 'string' ? l.name.slice(0, 100) : '',
      t: l.t,
      items: {},
    }
    if (l.deleted === true) list.deleted = true
    const items = l.items && typeof l.items === 'object' ? (l.items as Record<string, unknown>) : {}
    for (const [txid, entry] of Object.entries(items)) {
      const e = entry as Record<string, unknown> | null
      if (!TXID.test(txid) || !e || typeof e.on !== 'boolean' || !num(e.t)) continue
      list.items[txid] = { on: e.on, t: e.t, o: num(e.o) ? e.o : e.t }
    }
    doc.lists[id] = list
  }
  return doc
}

function mergeList(a: LibraryList, b: LibraryList): LibraryList {
  const head = b.t > a.t ? b : a
  const items: Record<string, LibraryItem> = { ...a.items }
  for (const [txid, theirs] of Object.entries(b.items)) {
    const ours = items[txid]
    if (!ours || theirs.t > ours.t) items[txid] = { ...theirs }
  }
  const list: LibraryList = { kind: a.kind, name: head.name, t: head.t, items }
  if (head.deleted) list.deleted = true
  return list
}

/** Слияние двух копий: у каждой записи побеждает более позднее изменение. */
export function mergeLibraryDoc(a: MediaLibraryDoc, b: MediaLibraryDoc): MediaLibraryDoc {
  const lists: Record<string, LibraryList> = { ...a.lists }
  for (const [id, theirs] of Object.entries(b.lists)) {
    const ours = lists[id]
    lists[id] = ours ? mergeList(ours, theirs) : theirs
  }
  return { v: 1, lists }
}

export function sameLibraryDoc(a: MediaLibraryDoc, b: MediaLibraryDoc): boolean {
  return JSON.stringify(sortedDoc(a)) === JSON.stringify(sortedDoc(b))
}

function sortedDoc(doc: MediaLibraryDoc): unknown {
  return Object.keys(doc.lists)
    .sort()
    .map((id) => {
      const l = doc.lists[id]!
      const items = Object.keys(l.items)
        .sort()
        .map((k) => [k, l.items[k]!.on, l.items[k]!.t, l.items[k]!.o])
      return [id, l.kind, l.name, l.t, !!l.deleted, items]
    })
}

/** Забыть давние отметки об удалении — и элементов, и плейлистов. */
export function pruneLibraryDoc(doc: MediaLibraryDoc, now: number): MediaLibraryDoc {
  const lists: Record<string, LibraryList> = {}
  for (const [id, list] of Object.entries(doc.lists)) {
    if (list.deleted && now - list.t > TOMBSTONE_TTL_MS) continue
    const items: Record<string, LibraryItem> = {}
    for (const [txid, item] of Object.entries(list.items)) {
      if (!item.on && now - item.t > TOMBSTONE_TTL_MS) continue
      items[txid] = item
    }
    lists[id] = { ...list, items }
  }
  return { v: 1, lists }
}

/**
 * Элементы списка по порядку: в личных плейлистах — как расставил владелец
 * (новые в конце), в «Сохранённых» и «Моей музыке» — свежие сверху.
 */
export function listItemIds(doc: MediaLibraryDoc, id: string): string[] {
  const list = doc.lists[id]
  if (!list || list.deleted) return []
  const entries = Object.entries(list.items).filter(([, e]) => e.on)
  if (isPlaylistId(id)) entries.sort((x, y) => x[1].o - y[1].o || x[0].localeCompare(y[0]))
  else entries.sort((x, y) => y[1].o - x[1].o || x[0].localeCompare(y[0]))
  return entries.map(([txid]) => txid)
}

/** Личные плейлисты этого типа, недавно созданные первыми. */
export function playlistIds(doc: MediaLibraryDoc, kind: LibraryKind): string[] {
  return Object.entries(doc.lists)
    .filter(([id, l]) => isPlaylistId(id) && !l.deleted && l.kind === kind)
    .sort((x, y) => y[1].t - x[1].t)
    .map(([id]) => id)
}

export function hasItem(doc: MediaLibraryDoc, id: string, txid: string): boolean {
  const list = doc.lists[id]
  return !!list && !list.deleted && !!list.items[txid]?.on
}

function listFor(doc: MediaLibraryDoc, id: string, now: number): LibraryList | null {
  const existing = doc.lists[id]
  if (existing && !existing.deleted) return existing
  const kind = SYSTEM_LISTS[id]
  return kind ? { kind, name: '', t: now, items: {} } : null
}

/** Добавить или убрать элемент. Новое — в конец плейлиста. Предел — LIBRARY_LIST_MAX. */
export function setItem(
  doc: MediaLibraryDoc,
  id: string,
  txid: string,
  on: boolean,
  now: number
): MediaLibraryDoc {
  const list = listFor(doc, id, now)
  if (!list || !TXID.test(txid) || !!list.items[txid]?.on === on) return doc
  if (on && listItemIds(doc, id).length >= LIBRARY_LIST_MAX) return doc
  const prev = list.items[txid]
  const last = Math.max(0, ...Object.values(list.items).map((e) => e.o))
  const o = on ? (isPlaylistId(id) ? Math.max(last + 1, now) : now) : (prev?.o ?? now)
  const items = { ...list.items, [txid]: { on, t: now, o } }
  return { v: 1, lists: { ...doc.lists, [id]: { ...list, items } } }
}

/** Переставить элемент личного плейлиста на место `index`. */
export function moveItem(
  doc: MediaLibraryDoc,
  id: string,
  txid: string,
  index: number,
  now: number
): MediaLibraryDoc {
  const list = doc.lists[id]
  if (!list || list.deleted || !isPlaylistId(id) || !list.items[txid]?.on) return doc
  const order = listItemIds(doc, id).filter((x) => x !== txid)
  const at = Math.max(0, Math.min(index, order.length))
  const before = at > 0 ? list.items[order[at - 1]!]!.o : null
  const after = at < order.length ? list.items[order[at]!]!.o : null
  const o =
    before === null && after === null
      ? now
      : before === null
        ? after! - 1
        : after === null
          ? before + 1
          : (before + after) / 2
  const items = { ...list.items, [txid]: { on: true, t: now, o } }
  return { v: 1, lists: { ...doc.lists, [id]: { ...list, items } } }
}

/** Новый личный плейлист; null — их уже LIBRARY_PLAYLISTS_MAX. */
export function createPlaylist(
  doc: MediaLibraryDoc,
  id: string,
  kind: LibraryKind,
  name: string,
  now: number
): MediaLibraryDoc | null {
  const count = Object.entries(doc.lists).filter(([k, l]) => isPlaylistId(k) && !l.deleted).length
  if (count >= LIBRARY_PLAYLISTS_MAX || !LIST_ID.test(id) || !isPlaylistId(id)) return null
  const list: LibraryList = { kind, name: name.trim().slice(0, 100), t: now, items: {} }
  return { v: 1, lists: { ...doc.lists, [id]: list } }
}

export function renamePlaylist(
  doc: MediaLibraryDoc,
  id: string,
  name: string,
  now: number
): MediaLibraryDoc {
  const list = doc.lists[id]
  if (!list || list.deleted || !isPlaylistId(id)) return doc
  return {
    v: 1,
    lists: { ...doc.lists, [id]: { ...list, name: name.trim().slice(0, 100), t: now } },
  }
}

export function deletePlaylist(doc: MediaLibraryDoc, id: string, now: number): MediaLibraryDoc {
  const list = doc.lists[id]
  if (!list || list.deleted || !isPlaylistId(id)) return doc
  return {
    v: 1,
    lists: { ...doc.lists, [id]: { kind: list.kind, name: '', t: now, deleted: true, items: {} } },
  }
}
