// Коллекции из сети. Нода отдаёт их в двух раскладках:
//  - `getprofilecollections` — коллекции профиля: `contentIds` строкой JSON,
//    обложка `i`, настройки `s` строкой, `contentTypes`, высота последней
//    версии; без времени. Не больше 20 за раз, `lang` пустой — иначе пусто;
//  - `getrawtransactionwithmessagebyid` — одна коллекция в раскладке поста:
//    элементы в `repost`, обложка в `m`, настройки объектом в `t`, история
//    версий; без `contentTypes`.
// Удалённых коллекций нет ни там, ни там.
//
// Элементы — `getrawtransactionwithmessagebyid` пачками; ответ без порядка,
// раскладываем по `contentIds`. Удалённого поста в ответе нет.

import { getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { safeDecode } from '@/helpers/content/safe-decode'
import { extractPostsFromResponse } from '@/composables/use-feed'
import { fetchRawPostsByIds } from '@/composables/helpers/feed-queries'
import { rememberUsers } from '@/services/user-names'
import type { RawUserProfile } from '@/helpers/common/adapt-post'
import type { AdaptedPost } from '@/types/adapted-post'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import {
  COLLECTION_EDIT_WINDOW_BLOCKS,
  cleanContentIds,
  descriptionOf,
  kindOfContentTypes,
  parseCollectionSettings,
  type CollectionKind,
} from './collection-model'

export interface CollectionVersion {
  height: number
  hash: string
}

export interface ChainCollection {
  /** txid первой версии — id коллекции. */
  txid: string
  /** txid текущей версии; без правок совпадает с `txid`. */
  hash: string
  address: string
  /** Тип элементов из транзакции: 201, 210; null — не задан (старый клиент). */
  contentTypes: number | null
  caption: string
  description: string
  image: string
  lang: string
  contentIds: string[]
  /** Все ключи настроек `s`, включая описание `m`. */
  settings: Record<string, unknown>
  edited: boolean
  /** Высота текущей версии — есть в списке профиля. */
  height?: number
  /** Время публикации, секунды — есть у одной коллекции. */
  time?: number
  /** Прежние версии, первая — публикация (одна коллекция). */
  versions?: CollectionVersion[]
}

/** Сколько коллекций нода отдаёт за раз. */
export const PROFILE_COLLECTIONS_PAGE = 20
/** Предел страниц: у самых активных авторов коллекций — десятки. */
const MAX_PAGES = 10
/** Элементов в одном запросе. */
const ITEMS_BATCH = 25

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanContentIds(raw)
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? cleanContentIds(parsed) : []
  } catch {
    return []
  }
}

function parseVersions(raw: unknown): CollectionVersion[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: CollectionVersion[] = []
  for (const v of raw) {
    const h = Number((v as { h?: unknown } | null)?.h)
    const hs = str((v as { hs?: unknown } | null)?.hs)
    if (Number.isFinite(h) && hs) out.push({ height: h, hash: hs })
  }
  return out
}

/** Коллекция из любой из двух раскладок; не коллекция или битая — null. */
export function normalizeCollection(raw: unknown): ChainCollection | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.type !== undefined && r.type !== 'collection') return null
  const txid = str(r.txid)
  const address = str(r.address)
  if (!/^[0-9a-f]{64}$/.test(txid) || !address) return null

  // Одна коллекция приходит в раскладке поста: элементы в repost, обложка в m, настройки в t.
  const shareLayout = r.contentIds === undefined && r.repost !== undefined
  const settings = parseCollectionSettings(shareLayout ? r.t : r.s)
  const hash = str(r.hash) || txid
  const contentTypes = Number(r.contentTypes)
  const height = Number(r.height)
  const time = Number(r.time)
  const versions = parseVersions(r.versions)

  const collection: ChainCollection = {
    txid,
    hash,
    address,
    contentTypes: kindOfContentTypes(contentTypes) ? contentTypes : null,
    caption: safeDecode(str(r.c)).trim(),
    description: descriptionOf(settings).trim(),
    image: safeDecode(str(shareLayout ? r.m : r.i)).trim(),
    lang: str(r.l),
    contentIds: parseIds(shareLayout ? r.repost : r.contentIds),
    settings,
    edited: r.edit === true || r.edit === 'true' || hash !== txid,
  }
  if (Number.isFinite(height) && height > 0) collection.height = height
  if (Number.isFinite(time) && time > 0) collection.time = time
  if (versions) collection.versions = versions
  return collection
}

/** Плейлист ли это по транзакции; коллекции старого клиента — null. */
export function declaredKind(collection: ChainCollection): Exclude<CollectionKind, 'posts'> | null {
  return kindOfContentTypes(collection.contentTypes)
}

/**
 * Что собрано, по самим элементам: все доступные — видео, значит видео; все
 * аудио — аудио; иначе публикации. Удалённые не считаются.
 */
export function kindOfItems(posts: readonly (AdaptedPost | null)[]): CollectionKind {
  const live = posts.filter((p): p is AdaptedPost => !!p)
  if (!live.length) return 'posts'
  if (live.every((p) => p.type === 'video')) return 'video'
  if (live.every((p) => p.type === 'audio')) return 'audio'
  return 'posts'
}

/** Тип коллекции: из транзакции, а если не задан — по элементам. */
export function collectionKind(
  collection: ChainCollection,
  posts: readonly (AdaptedPost | null)[]
): CollectionKind {
  return declaredKind(collection) ?? kindOfItems(posts)
}

function rowsOf(response: unknown): unknown[] {
  if (Array.isArray(response)) return response
  const r = response as { contents?: unknown; data?: unknown } | null
  if (Array.isArray(r?.contents)) return r.contents
  const data = r?.data as { contents?: unknown } | unknown[] | undefined
  if (Array.isArray(data)) return data
  if (data && Array.isArray((data as { contents?: unknown }).contents))
    return (data as { contents: unknown[] }).contents
  return []
}

interface ProfilePage {
  collections: ChainCollection[]
  /** txid, ниже которого листать дальше; null — страница последняя. */
  next: string | null
}

async function profilePage(address: string, top: string): Promise<ProfilePage> {
  const response = await getByPRCWithAuth({
    method: rpcEndpoints.getProfileCollections,
    // Второй параметр — txid, ниже которого листать: номер страницы прокси
    // превращает в строку, и нода всегда отдаёт первую.
    parameters: [0, top, PROFILE_COLLECTIONS_PAGE, '', [], [], [], [], [], '', address],
    cachehash: Date.now().toString(36),
    options: {},
    state: 1,
  })
  const rows = rowsOf(response) as Record<string, unknown>[]
  // Нода отбирает коллекции с номером меньше, чем у переданной: дальше — от самого младшего.
  let next: string | null = null
  let lowest = Infinity
  for (const row of rows) {
    const id = Number(row?.id)
    if (Number.isFinite(id) && id < lowest && typeof row.txid === 'string') {
      lowest = id
      next = row.txid
    }
  }
  return {
    collections: rows
      .map(normalizeCollection)
      .filter((c): c is ChainCollection => !!c && c.address === address),
    next: rows.length < PROFILE_COLLECTIONS_PAGE ? null : next,
  }
}

/**
 * Все коллекции профиля, новые правки первыми. Нода листает по номеру
 * коллекции, а сортирует по высоте последней правки, поэтому у автора больше
 * чем с 20 коллекциями давно не правленая может выпасть — так листает и
 * старый клиент.
 */
export async function fetchProfileCollections(address: string): Promise<ChainCollection[]> {
  const out: ChainCollection[] = []
  const seen = new Set<string>()
  let top = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const { collections, next } = await profilePage(address, top)
    for (const c of collections) {
      if (seen.has(c.txid)) continue
      seen.add(c.txid)
      out.push(c)
    }
    if (!next || next === top) break
    top = next
  }
  return out
}

/** Одна коллекция по txid (любой версии); удалена или не найдена — null. */
export async function fetchCollection(txid: string): Promise<ChainCollection | null> {
  const response = await getByPRCWithAuth({
    method: rpcEndpoints.getRawTransactionWithMessageById,
    parameters: [[txid]],
    cachehash: Date.now().toString(36),
    options: {},
    state: 1,
  })
  const row = rowsOf(response)[0] as Record<string, unknown> | null | undefined
  const profile = row?.userprofile as RawUserProfile | undefined
  if (profile?.address) rememberUsers([profile])
  return normalizeCollection(row)
}

/**
 * Посты коллекции по порядку. null — пост удалён или нода его не знает; такой
 * элемент остаётся на своём месте, чтобы автор мог его убрать.
 */
export async function fetchCollectionItems(
  ids: readonly string[]
): Promise<(AdaptedPost | null)[]> {
  const unique = [...new Set(ids)]
  const found = new Map<string, AdaptedPost>()
  for (let i = 0; i < unique.length; i += ITEMS_BATCH) {
    const batch = unique.slice(i, i + ITEMS_BATCH)
    const raw = await fetchRawPostsByIds(batch)
    const rows = [...new Set(batch.map((id) => raw.get(id)).filter((p) => !!p))]
    const response = { data: { contents: rows } } as unknown as GetHierarchicalStripResponse
    for (const post of extractPostsFromResponse(response)) {
      for (const key of [post.txid, post.hash, String(post.id)]) if (key) found.set(key, post)
    }
  }
  return ids.map((id) => {
    const post = found.get(id)
    return post && post.type !== 'contentDelete' ? post : null
  })
}

/**
 * Сколько правок коллекции нода насчитает в окне лимита: версии после
 * публикации с высотой в последних 43 200 блоках. Текущая версия в истории не
 * числится; её высота известна из списка профиля, а без неё считаем, что она
 * в окне.
 */
export function editsInWindow(collection: ChainCollection, tipHeight: number): number {
  const from = tipHeight - COLLECTION_EDIT_WINDOW_BLOCKS
  const versions = collection.versions ?? []
  let count = versions.slice(1).filter((v) => v.height > from).length
  if (collection.hash !== collection.txid) {
    const current = collection.height
    if (current === undefined || current > from) count += 1
  }
  return count
}
