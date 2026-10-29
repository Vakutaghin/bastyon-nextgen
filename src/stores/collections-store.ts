// Коллекции и плейлисты профилей (транзакции 220) и свои, ещё не в блоке.
//
// Что собрано, решает поле `contentTypes`; у коллекций старого клиента его нет —
// тогда смотрим на первые элементы (CLASSIFY_SAMPLE): все видео — видеоплейлист,
// все аудио — аудио, иначе коллекция публикаций. Обложка — своя, а нет её —
// превью первого элемента.
//
// Своё ожидающее (новая, правка, удаление) видно сразу, поверх ответа ноды.
// Нода не примет вторую правку той же коллекции, пока первая не в блоке, и
// правку коллекции, которой ещё нет в блоке: такие изменения ждут здесь и
// уходят сами, когда прошлое подтвердилось. Подтверждение сообщает
// pending-transactions-store (onTransactionSettled).

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { PENDING_COLLECTIONS_PREFIX } from '@/blockchain/constants/storage'
import { onTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import {
  CollectionDraftInvalid,
  deleteCollection,
  sendCollection,
} from '@/blockchain/core/actions/collection-action'
import {
  collectionKind,
  fetchCollection,
  fetchCollectionItems,
  fetchProfileCollections,
  type ChainCollection,
} from '@/services/collections/collections-api'
import {
  COLLECTION_EDIT_LIMIT,
  contentTypesOf,
  validateCollectionDraft,
  type CollectionDraft,
  type CollectionKind,
} from '@/services/collections/collection-model'
import { fetchMediaInfo } from '@/services/media/media-info'
import { mediaCover, mediaTypeOf } from '@/services/media/media-post'
import { logger } from '@/services/logger'
import type { AdaptedPost } from '@/types/adapted-post'

const log = logger.scope('[collections]')

/** Сколько первых элементов смотреть, чтобы понять тип коллекции старого клиента. */
export const CLASSIFY_SAMPLE = 5
/** Список профиля свежий столько времени. */
const FRESH_MS = 60_000

export interface CollectionView extends ChainCollection {
  kind: CollectionKind
  /** Обложка: своя или превью первого элемента; null — нет ни того, ни другого. */
  cover: string | null
  /** Превью первого элемента — если своя обложка не загрузится (сервер Up1 недоступен). */
  fallbackCover?: string | null
  /** Своё изменение ещё не в блоке. */
  pending?: 'create' | 'edit' | 'delete'
  /** Изменение ждёт, пока прошлое попадёт в блок. */
  queued?: boolean
  /** Не попало в блок за час. */
  failed?: boolean
}

interface AuthorEntry {
  status: 'loading' | 'ready' | 'error'
  items: CollectionView[]
  loadedAt: number
}

/** Отправленное, но не подтверждённое — переживает перезапуск. */
interface PendingEntry {
  /** txid отправленной транзакции. */
  txid: string
  /** id коллекции: у новой — тот же txid. */
  rootTxid: string
  action: 'create' | 'edit' | 'delete'
  draft: CollectionDraft
  sentAt: number
  failed?: boolean
}

/** Изменение, которое нода пока не примет. */
interface QueuedEntry {
  rootTxid: string
  action: 'edit' | 'delete'
  draft: CollectionDraft
}

interface Stored {
  pending: PendingEntry[]
  queued: QueuedEntry[]
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Вид коллекции из черновика — пока нода её не отдаёт. */
function viewOfDraft(
  base: ChainCollection | null,
  rootTxid: string,
  address: string,
  draft: CollectionDraft
): ChainCollection {
  return {
    txid: rootTxid,
    hash: rootTxid,
    address,
    contentTypes: contentTypesOf(draft.kind) ?? null,
    caption: draft.caption.trim(),
    description: draft.description.trim(),
    image: draft.image.trim(),
    lang: draft.lang,
    contentIds: [...draft.contentIds],
    settings: { ...(draft.settings ?? {}), ...(draft.description ? { m: draft.description } : {}) },
    edited: !!base,
    ...(base?.height ? { height: base.height } : {}),
  }
}

/** Обложка по умолчанию — превью первого доступного элемента. */
async function coverOfFirst(posts: (AdaptedPost | null)[]): Promise<string | null> {
  const first = posts.find(
    (p): p is AdaptedPost => !!p && (!!mediaTypeOf(p) || p.images.length > 0)
  )
  if (!first) return null
  if (!mediaTypeOf(first)) return first.images[0] ?? null
  const info = await fetchMediaInfo([first.videoUrl!])
  return mediaCover(first, info.get(first.videoUrl!))
}

/** Ключ настроек `s`: обложка подставлена сама — превью первого элемента. */
export const AUTO_COVER_KEY = 'ac'

/**
 * Обложка по умолчанию. Своей нет (или стоит прежняя автоматическая) — берём
 * превью первого элемента и помечаем в настройках, что она автоматическая:
 * сменится первый элемент — сменится и обложка. Свою обложку не трогаем.
 * В транзакцию она идёт ссылкой — старый клиент тоже её покажет.
 */
export async function withAutoCover(draft: CollectionDraft): Promise<CollectionDraft> {
  const settings = { ...(draft.settings ?? {}) }
  const auto =
    typeof settings[AUTO_COVER_KEY] === 'string' ? (settings[AUTO_COVER_KEY] as string) : ''
  const image = draft.image.trim()
  if (image && image !== auto) {
    delete settings[AUTO_COVER_KEY]
    return { ...draft, settings }
  }
  const head = draft.contentIds.slice(0, CLASSIFY_SAMPLE)
  const items = head.length ? await fetchCollectionItems(head).catch(() => []) : []
  const cover = await coverOfFirst(items).catch(() => null)
  if (cover) settings[AUTO_COVER_KEY] = cover
  else delete settings[AUTO_COVER_KEY]
  return { ...draft, image: cover ?? '', settings }
}

/** Черновик правки из коллекции: всё как есть, элементы — новые. */
export function draftOf(
  view: CollectionView,
  contentIds: string[] = view.contentIds
): CollectionDraft {
  return {
    rootTxid: view.txid,
    kind: view.kind,
    caption: view.caption,
    description: view.description,
    image: view.image,
    lang: view.lang,
    contentIds: [...contentIds],
    settings: { ...view.settings },
  }
}

export const useCollectionsStore = defineStore('collections', () => {
  const owner = ref<string | null>(null)
  const authors = ref<Record<string, AuthorEntry>>({})
  const pending = ref<PendingEntry[]>([])
  const queued = ref<QueuedEntry[]>([])
  /** Тип и обложка, уже найденные по элементам (txid текущей версии → вид). */
  const classified = new Map<
    string,
    { kind: CollectionKind; cover: string | null; fallbackCover: string | null }
  >()
  let stopSettled: (() => void) | null = null

  function persist(): void {
    if (!owner.value) return
    try {
      const data: Stored = { pending: pending.value, queued: queued.value }
      storage()?.setItem(`${PENDING_COLLECTIONS_PREFIX}${owner.value}`, JSON.stringify(data))
    } catch {
      /* в памяти до следующего раза */
    }
  }

  function attach(address: string | null): void {
    if (owner.value === address) return
    owner.value = address
    pending.value = []
    queued.value = []
    if (!address) return
    try {
      const raw = storage()?.getItem(`${PENDING_COLLECTIONS_PREFIX}${address}`)
      const stored = raw ? (JSON.parse(raw) as Partial<Stored>) : null
      pending.value = Array.isArray(stored?.pending) ? stored.pending : []
      queued.value = Array.isArray(stored?.queued) ? stored.queued : []
    } catch {
      /* битая копия — начинаем с пустого */
    }
    stopSettled ??= onTransactionSettled(onSettled)
  }

  /**
   * Смена аккаунта: своё ожидающее — у каждого аккаунта своё. Коллекции
   * авторов и найденный тип — публичные данные, их не стираем: сброс идёт
   * уже после входа, и список нового аккаунта, загруженный открытой
   * страницей, пропадал — она висела на «Загружаем…».
   */
  function reset(): void {
    owner.value = null
    pending.value = []
    queued.value = []
  }

  // --- Список профиля ---

  async function classify(list: ChainCollection[]): Promise<CollectionView[]> {
    const unknown = list.filter((c) => !classified.has(c.hash))
    const sample = unknown.flatMap((c) => c.contentIds.slice(0, CLASSIFY_SAMPLE))
    const posts = sample.length ? await fetchCollectionItems(sample).catch(() => []) : []
    const byId = new Map<string, AdaptedPost | null>()
    sample.forEach((id, i) => byId.set(id, posts[i] ?? null))
    await Promise.all(
      unknown.map(async (c) => {
        const items = c.contentIds.slice(0, CLASSIFY_SAMPLE).map((id) => byId.get(id) ?? null)
        const auto = await coverOfFirst(items).catch(() => null)
        classified.set(c.hash, {
          kind: collectionKind(c, items),
          cover: c.image || auto,
          fallbackCover: auto,
        })
      })
    )
    return list.map((c) => {
      const known = classified.get(c.hash)
      return {
        ...c,
        kind: known?.kind ?? collectionKind(c, []),
        cover: known?.cover ?? (c.image || null),
        fallbackCover: known?.fallbackCover ?? null,
      }
    })
  }

  async function loadAuthor(address: string, force = false): Promise<void> {
    const entry = authors.value[address]
    if (!force && entry && (entry.status === 'loading' || Date.now() - entry.loadedAt < FRESH_MS))
      return
    authors.value = {
      ...authors.value,
      [address]: { status: 'loading', items: entry?.items ?? [], loadedAt: entry?.loadedAt ?? 0 },
    }
    try {
      const items = await classify(await fetchProfileCollections(address))
      authors.value = {
        ...authors.value,
        [address]: { status: 'ready', items, loadedAt: Date.now() },
      }
    } catch (e) {
      log.warn('profile collections failed', address, e)
      authors.value = {
        ...authors.value,
        [address]: { status: 'error', items: entry?.items ?? [], loadedAt: Date.now() },
      }
    }
  }

  function statusOf(address: string): AuthorEntry['status'] | 'idle' {
    return authors.value[address]?.status ?? 'idle'
  }

  /** Коллекции автора со своими ожидающими изменениями поверх. */
  function collectionsOf(address: string): CollectionView[] {
    const base = authors.value[address]?.items ?? []
    if (address !== owner.value || (!pending.value.length && !queued.value.length)) return base
    const out = new Map(base.map((c) => [c.txid, c] as const))
    const apply = (
      rootTxid: string,
      action: string,
      draft: CollectionDraft,
      flags: Partial<CollectionView>
    ): void => {
      const prev = out.get(rootTxid) ?? null
      const view = viewOfDraft(prev, rootTxid, address, draft)
      out.set(rootTxid, {
        ...view,
        kind: draft.kind,
        cover: draft.image || prev?.cover || null,
        ...flags,
        ...(action === 'delete' ? { pending: 'delete' } : {}),
      })
    }
    for (const p of pending.value) {
      apply(p.rootTxid, p.action, p.draft, {
        pending: p.action,
        ...(p.failed ? { failed: true } : {}),
      })
    }
    for (const q of queued.value) apply(q.rootTxid, q.action, q.draft, { queued: true })
    const list = [...out.values()]
    // Новые — сверху, как у ноды (по высоте последней правки).
    return list.sort(
      (a, b) => (a.pending === 'create' ? -1 : 0) - (b.pending === 'create' ? -1 : 0)
    )
  }

  function ofKind(address: string, kind: CollectionKind): CollectionView[] {
    return collectionsOf(address).filter((c) => c.kind === kind && c.pending !== 'delete')
  }

  /** Своя коллекция — с ожидающими правками; для редактора и «Добавить в…». */
  function ownCollection(rootTxid: string): CollectionView | null {
    if (!owner.value) return null
    return collectionsOf(owner.value).find((c) => c.txid === rootTxid) ?? null
  }

  // --- Одна коллекция ---

  async function loadCollection(
    txid: string
  ): Promise<{ collection: CollectionView; items: (AdaptedPost | null)[] } | null> {
    const own = ownCollection(txid)
    const chain = own?.pending === 'create' ? null : await fetchCollection(txid)
    // Своё изменение ещё не в блоке — показываем его, история версий — из сети.
    const local = own && (own.pending || own.queued) ? own : null
    const base: ChainCollection | null = local
      ? { ...local, ...(chain?.versions ? { versions: chain.versions } : {}) }
      : chain
    if (!base) return null
    const items = await fetchCollectionItems(base.contentIds)
    const auto = await coverOfFirst(items).catch(() => null)
    const collection: CollectionView = {
      ...(local ?? {}),
      ...base,
      kind: local?.kind ?? collectionKind(base, items),
      cover: base.image || auto,
      fallbackCover: auto,
    }
    return { collection, items }
  }

  // --- Изменения ---

  const busy = computed(
    () => (rootTxid: string) => pending.value.some((p) => p.rootTxid === rootTxid && !p.failed)
  )

  /** Сколько правок уже сделано и ждёт — чтобы не упереться в 5 за месяц. */
  function pendingEditsOf(rootTxid: string): number {
    return pending.value.filter((p) => p.rootTxid === rootTxid && p.action === 'edit' && !p.failed)
      .length
  }

  async function sendNow(
    rootTxid: string | null,
    action: PendingEntry['action'],
    draft: CollectionDraft
  ): Promise<string> {
    if (action === 'delete') {
      const txid = await deleteCollection(rootTxid!, draft.caption)
      pending.value = [
        ...pending.value,
        { txid, rootTxid: rootTxid!, action, draft, sentAt: Date.now() },
      ]
      persist()
      return txid
    }
    const ready = await withAutoCover(draft)
    const { txid } = await sendCollection(ready)
    pending.value = [
      ...pending.value,
      { txid, rootTxid: rootTxid ?? txid, action, draft: ready, sentAt: Date.now() },
    ]
    persist()
    return txid
  }

  /** Новая коллекция или плейлист. Возвращает её txid. */
  async function create(draft: CollectionDraft): Promise<string> {
    const fresh: CollectionDraft = { ...draft }
    delete fresh.rootTxid
    return sendNow(null, 'create', fresh)
  }

  /**
   * Правка. Пока прошлое изменение этой коллекции не в блоке, правка ждёт
   * (`queued`) и уйдёт сама; повторные правки в ожидании сливаются в одну.
   */
  async function edit(rootTxid: string, draft: CollectionDraft): Promise<'sent' | 'queued'> {
    const next = { ...draft, rootTxid }
    // Ждущую правку проверяем сразу: уйдёт она без человека, и ошибку он не увидит.
    const invalid = validateCollectionDraft(next)
    if (invalid) throw new CollectionDraftInvalid(invalid)
    if (busy.value(rootTxid)) {
      queued.value = [
        ...queued.value.filter((q) => q.rootTxid !== rootTxid),
        { rootTxid, action: 'edit', draft: next },
      ]
      persist()
      return 'queued'
    }
    await sendNow(rootTxid, 'edit', next)
    return 'sent'
  }

  async function remove(rootTxid: string, draft: CollectionDraft): Promise<'sent' | 'queued'> {
    if (busy.value(rootTxid)) {
      queued.value = [
        ...queued.value.filter((q) => q.rootTxid !== rootTxid),
        { rootTxid, action: 'delete', draft },
      ]
      persist()
      return 'queued'
    }
    await sendNow(rootTxid, 'delete', draft)
    return 'sent'
  }

  /** Добавить публикацию в конец коллекции или убрать её — одной правкой. */
  async function toggleItem(
    view: CollectionView,
    postTxid: string,
    on: boolean
  ): Promise<'sent' | 'queued'> {
    const ids = view.contentIds.filter((id) => id !== postTxid)
    if (on) ids.push(postTxid)
    return edit(view.txid, draftOf(view, ids))
  }

  /** Убрать с экрана то, что за час не попало в блок. */
  function dismissFailed(rootTxid: string): void {
    pending.value = pending.value.filter((p) => !(p.rootTxid === rootTxid && p.failed))
    persist()
  }

  async function onSettled(txid: string, confirmed: boolean): Promise<void> {
    const entry = pending.value.find((p) => p.txid === txid)
    if (!entry) return
    if (!confirmed) {
      pending.value = pending.value.map((p) => (p.txid === txid ? { ...p, failed: true } : p))
      // Ждавшее за ним изменение не уйдёт: основы для правки нет.
      queued.value = queued.value.filter((q) => q.rootTxid !== entry.rootTxid)
      persist()
      return
    }
    pending.value = pending.value.filter((p) => p.txid !== txid)
    persist()
    if (owner.value) void loadAuthor(owner.value, true)
    const waiting = queued.value.find((q) => q.rootTxid === entry.rootTxid)
    if (!waiting || entry.action === 'delete') return
    queued.value = queued.value.filter((q) => q !== waiting)
    persist()
    try {
      await sendNow(waiting.rootTxid, waiting.action, waiting.draft)
    } catch (e) {
      log.warn('queued change failed', waiting.rootTxid, e)
      queued.value = [...queued.value, waiting]
      persist()
    }
  }

  return {
    owner,
    authors,
    pending,
    queued,
    attach,
    reset,
    loadAuthor,
    statusOf,
    collectionsOf,
    ofKind,
    ownCollection,
    loadCollection,
    busy,
    pendingEditsOf,
    create,
    edit,
    remove,
    toggleItem,
    dismissFailed,
    onSettled,
    EDIT_LIMIT: COLLECTION_EDIT_LIMIT,
  }
})
