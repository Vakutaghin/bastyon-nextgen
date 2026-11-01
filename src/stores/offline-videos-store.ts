/**
 * Скачанные ролики для просмотра без сети, как в приложении YouTube.
 *
 * Список ведёт бэкенд платформы (services/offline-video): Rust на компьютере,
 * служба на Android, воркер в вебе. Стор читает его один раз и дальше живёт
 * событиями: `changed` — ролик целиком, `progress` — только байты. Ход загрузки
 * лежит в отдельной реактивной Map: карточка читает своё поле, список на
 * каждый байт не перерисовывается.
 *
 * Скачанное принадлежит аккаунтам: один файл на устройстве, в `meta.accounts`
 * все, кто его скачал. Страница «Скачанное» показывает свои; удалить у себя —
 * убрать свой адрес, последний адрес — удалить файл. Выход из всех аккаунтов
 * стирает всё.
 *
 * Ролик, который автор удалил, остаётся — с пометкой (решение пользователя).
 * Сроков и привязок, как у YouTube, нет.
 */

import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowReactive, shallowRef, watch } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { getPeerTubeCaptions, getPeerTubeVideoInfo } from '@/helpers/api/peertube-api'
import { PeerTubeFetchError, parsePeerTubeUrl } from '@/helpers/api/peertube-url'
import type { PeerTubeVideoInfo } from '@/helpers/api/peertube-url'
import { offlineBackend } from '@/services/offline-video/backend'
import { batchRows, mapLimit, type OfflineBatchRow } from '@/services/offline-video/offline-batch'
import {
  AUTO_DEFAULT_HEIGHT,
  AUTO_FIRST_WINDOW_MS,
  AUTO_MAX_ITEMS,
  AUTO_MIN_FREE_BYTES,
  AUTO_PER_CHECK,
  autoCandidates,
  autoItems,
  expiredAuto,
} from '@/services/offline-video/offline-auto'
import { onAppForeground } from '@/helpers/common/app-foreground'
import {
  buildOfflineJob,
  isProcessing,
  offlineQualities,
  pickQuality,
  type OfflineQuality,
  type OfflineSource,
} from '@/services/offline-video/offline-job'
import {
  offlineVideoKey,
  rememberOfflineItem,
  rememberOfflineItems,
} from '@/services/offline-video/offline-lookup'
import type {
  OfflineBackend,
  OfflineChanged,
  OfflineItem,
  OfflineLocation,
  OfflineMeta,
  OfflineMoving,
  OfflineProgress,
  OfflineUsage,
} from '@/services/offline-video/types'
import { logger } from '@/services/logger'

const log = logger.scope('[offline-videos]')

/** Качество по умолчанию: «Спрашивать» или высота. */
export type OfflineQualityPref = 'ask' | number
export const OFFLINE_QUALITY_CHOICES: readonly OfflineQualityPref[] = [
  'ask',
  144,
  240,
  360,
  480,
  720,
  1080,
]

const QUALITY_KEY = 'offline:quality'
const WIFI_ONLY_KEY = 'offline:wifi-only'
const AUTO_KEY = 'offline:auto-subs'
/** До какого поста подписок уже смотрели (мс) — у каждого аккаунта своё. */
const autoSinceKey = (account: string): string => `offline:auto-since:${account}`
/** Первая проверка подписок — когда запуск прошёл, потом раз в час. */
const FIRST_AUTO_AFTER_MS = 90_000
const AUTO_EVERY_MS = 60 * 60 * 1000
/** Проверка «не удалил ли автор» — не чаще раза в сутки на ролик. */
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000
/** Первая проверка — когда запуск уже прошёл. */
const FIRST_CHECK_AFTER_MS = 60_000

/** Сбои, которые проходят сами: сеть вернулась, Tor поднялся. */
const RETRY_ON_ONLINE = new Set(['network'])

function readQualityPref(): OfflineQualityPref {
  try {
    const raw = localStorage.getItem(QUALITY_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : 'ask'
  } catch {
    return 'ask'
  }
}

function readWifiOnly(): boolean {
  try {
    return localStorage.getItem(WIFI_ONLY_KEY) !== '0'
  } catch {
    return true
  }
}

function readAutoSubs(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === '1'
  } catch {
    return false
  }
}

function readNumber(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Безлимитная ли сеть: на Android знает служба, иначе — `navigator.connection`. */
async function unmeteredNetwork(backend: OfflineBackend): Promise<boolean> {
  if (backend.unmetered) return backend.unmetered().catch(() => false)
  const connection =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection
      : undefined
  return !(connection?.saveData || connection?.type === 'cellular')
}

function persist(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* настройка — по возможности */
  }
}

/** Что показать в листе выбора качества. */
export interface OfflineChoice {
  source: OfflineSource
  info: PeerTubeVideoInfo
  qualities: OfflineQuality[]
  /** Свободно на диске, байт; null — не узнать. */
  free: number | null
}

/** Пачка роликов (коллекция, плейлист) для листа выбора качества. */
export interface OfflineBatch {
  choices: OfflineChoice[]
  rows: OfflineBatchRow[]
  /** Свободно на диске, байт; null — не узнать. */
  free: number | null
  /** Уже были на устройстве у другого аккаунта — дописали себя. */
  claimed: number
  /** Ещё обрабатываются или сервер не ответил. */
  skipped: number
}

/** Сколько описаний пачки разом спрашивать у серверов. */
const BATCH_INFO_PARALLEL = 4

export type OfflinePrepareResult =
  | { kind: 'ready'; choice: OfflineChoice }
  | { kind: 'processing' }
  | { kind: 'unavailable' }

export const useOfflineVideosStore = defineStore('offline-videos', () => {
  const auth = useAuthStore()

  /** На этой платформе можно скачивать. */
  const available = ref(false)
  /** Список прочитан. */
  const ready = ref(false)
  const items = shallowReactive(new Map<string, OfflineItem>())
  /** Ход загрузки по id — читают карточки. */
  const progress = reactive(new Map<string, { received: number; total: number }>())
  const usage = ref<OfflineUsage | null>(null)
  const qualityPref = ref<OfflineQualityPref>(readQualityPref())
  const wifiOnly = ref<boolean>(readWifiOnly())
  /** Новые ролики подписок качаются сами. */
  const autoSubs = ref<boolean>(readAutoSubs())
  /** Где лежит скачанное; null — ещё не спрашивали или выбрать нельзя. */
  const location = ref<OfflineLocation | null>(null)
  /** Идёт перенос: сколько роликов уже на новом месте. */
  const moving = ref<OfflineMoving | null>(null)
  /** На этой платформе можно выбрать, где хранить. */
  const canChooseLocation = ref(false)

  /** Лист выбора качества: что качать. */
  const sheet = shallowRef<OfflineChoice | null>(null)
  /** Тот же лист для пачки роликов. */
  const batchSheet = shallowRef<OfflineBatch | null>(null)
  /** Окно скачанного ролика. */
  const openedId = ref<string | null>(null)
  const opened = computed<OfflineItem | null>(() =>
    openedId.value ? (items.get(openedId.value) ?? null) : null
  )

  let backendRef: OfflineBackend | null = null
  let hydrating: Promise<void> | null = null

  const account = computed<string | null>(() => auth.getUserAddress ?? null)

  /** Скачанное текущим аккаунтом, свежее сверху. */
  const mine = computed<OfflineItem[]>(() => {
    const me = account.value
    if (!me) return []
    return [...items.values()]
      .filter((i) => i.meta.accounts?.includes(me))
      .sort((a, b) => (b.meta.createdAt ?? 0) - (a.meta.createdAt ?? 0))
  })

  const mineUsed = computed<number>(() =>
    mine.value.reduce(
      (sum, i) => sum + (i.state.status === 'done' ? i.state.total : i.state.received),
      0
    )
  )

  function put(item: OfflineItem | null, id: string): void {
    if (item) items.set(id, item)
    else items.delete(id)
    if (!item || item.state.status === 'done') progress.delete(id)
    else progress.set(id, { received: item.state.received, total: item.state.total })
    rememberOfflineItem(id, item)
  }

  function onChanged(e: OfflineChanged): void {
    put(e.item, e.id)
  }

  function onProgress(p: OfflineProgress): void {
    const entry = progress.get(p.id)
    if (entry) {
      entry.received = p.received
      entry.total = p.total
    } else {
      progress.set(p.id, { received: p.received, total: p.total })
    }
  }

  /** Ролик по ссылке поста — у любого аккаунта (файл один на устройстве). */
  function itemFor(peertubeUrl: string | undefined | null): OfflineItem | null {
    const key = offlineVideoKey(peertubeUrl)
    if (!key) return null
    for (const item of items.values()) {
      if (offlineVideoKey(item.meta.peertubeUrl) === key || item.meta.uuid?.toLowerCase() === key) {
        return item
      }
    }
    return null
  }

  /** Ролик по ссылке — если его скачал текущий аккаунт. */
  function mineFor(peertubeUrl: string | undefined | null): OfflineItem | null {
    const item = itemFor(peertubeUrl)
    const me = account.value
    return item && me && item.meta.accounts?.includes(me) ? item : null
  }

  async function retryWhere(test: (item: OfflineItem) => boolean): Promise<void> {
    const backend = backendRef
    if (!backend) return
    for (const item of items.values()) {
      if (test(item)) await backend.resume(item.id).catch(() => {})
    }
  }

  function startTimers(): void {
    if (typeof window === 'undefined') return
    // Сеть вернулась — продолжить то, что упало из-за неё.
    window.addEventListener('online', () => {
      void retryWhere(
        (i) => i.state.status === 'failed' && RETRY_ON_ONLINE.has(String(i.state.error))
      )
      void checkDeletedAll()
    })
    setTimeout(() => void checkDeletedAll(), FIRST_CHECK_AFTER_MS)
    setInterval(() => void checkDeletedAll(), CHECK_EVERY_MS)
    // Новые ролики подписок: после запуска, раз в час, с вернувшейся сетью и
    // при возвращении в приложение.
    window.addEventListener('online', () => void runAuto())
    setTimeout(() => void runAuto(), FIRST_AUTO_AFTER_MS)
    setInterval(() => void runAuto(), AUTO_EVERY_MS)
    onAppForeground(() => void runAuto())
    // Tor поднялся — продолжить то, что его ждало.
    void import('@/stores/tor-store')
      .then(({ useTorStore }) => {
        const tor = useTorStore()
        watch(
          () => tor.shouldTorify,
          (isReady) => {
            if (isReady) void retryWhere((i) => i.state.error === 'tor_not_ready')
          },
          { immediate: true }
        )
      })
      .catch(() => {})
  }

  /** Прочитать список и подписаться на события. Один раз. */
  function hydrate(): Promise<void> {
    hydrating ??= (async () => {
      const backend = await offlineBackend()
      if (!backend) {
        ready.value = true
        return
      }
      backendRef = backend
      available.value = true
      await backend.onChanged(onChanged)
      await backend.onProgress(onProgress)
      canChooseLocation.value = !!backend.location && !!backend.moveTo
      if (backend.onMoving)
        await backend.onMoving((p) => {
          if (moving.value) moving.value = p
        })
      const list = await backend.list().catch((e: unknown) => {
        log.warn('list failed', e)
        return [] as OfflineItem[]
      })
      items.clear()
      for (const item of list) put(item, item.id)
      rememberOfflineItems(list)
      if (backend.setWifiOnly) void backend.setWifiOnly(wifiOnly.value).catch(() => {})
      ready.value = true
      startTimers()
    })()
    return hydrating
  }

  async function backend(): Promise<OfflineBackend> {
    await hydrate()
    if (!backendRef) throw new Error('offline_unavailable')
    return backendRef
  }

  /** Описание ролика и качества — для листа выбора. */
  async function prepare(source: OfflineSource): Promise<OfflinePrepareResult> {
    const parsed = parsePeerTubeUrl(source.peertubeUrl)
    if (!parsed) return { kind: 'unavailable' }
    let info: PeerTubeVideoInfo
    try {
      info = await getPeerTubeVideoInfo(parsed.host, parsed.videoId)
    } catch (e) {
      log.warn('no info', source.peertubeUrl, e)
      return { kind: 'unavailable' }
    }
    if (isProcessing(info)) return { kind: 'processing' }
    const b = await backend()
    const free = await b
      .usage()
      .then((u) => {
        usage.value = u
        return u.free
      })
      .catch(() => null)
    return { kind: 'ready', choice: { source, info, qualities: offlineQualities(info), free } }
  }

  /** Качество без вопроса: у аудио — самое маленькое, иначе — запомненное. */
  function autoQuality(choice: OfflineChoice): OfflineQuality | null {
    if (choice.source.kind === 'audio') return choice.qualities[0] ?? null
    const pref = qualityPref.value
    return pref === 'ask' ? null : pickQuality(choice.qualities, pref)
  }

  /** Поставить в очередь выбранное качество; `extra` — поля meta сверх обычных (`auto`). */
  async function start(
    choice: OfflineChoice,
    quality: OfflineQuality,
    extra: Pick<OfflineMeta, 'auto'> = {}
  ): Promise<OfflineItem> {
    const me = account.value
    if (!me) throw new Error('offline_needs_account')
    const b = await backend()
    // Файл уже на устройстве (скачал другой аккаунт) — просто дописать себя.
    const existing = itemFor(choice.source.peertubeUrl)
    if (existing) return claim(existing)
    const parsed = parsePeerTubeUrl(choice.source.peertubeUrl)
    const captions = parsed
      ? await getPeerTubeCaptions(parsed.host, parsed.videoId).catch(() => [])
      : []
    const { job, meta } = buildOfflineJob({
      source: choice.source,
      info: choice.info,
      quality,
      captions,
      account: me,
      withPlaylist: b.kind === 'android',
    })
    const item = await b.enqueue(job, { ...meta, ...extra })
    put(item, item.id)
    return item.meta.accounts?.includes(me) ? item : claim(item)
  }

  /**
   * Пачка роликов: своё скачанное — мимо, скачанное другим аккаунтом — дописать
   * себя, остальное — описания с серверов, по BATCH_INFO_PARALLEL разом.
   */
  async function prepareMany(
    sources: readonly OfflineSource[],
    onProgress?: (done: number, total: number) => void
  ): Promise<OfflineBatch> {
    const b = await backend()
    const seen = new Set<string>()
    const todo: OfflineSource[] = []
    let claimed = 0
    for (const source of sources) {
      const key = offlineVideoKey(source.peertubeUrl)
      if (!key || seen.has(key)) continue
      seen.add(key)
      if (mineFor(source.peertubeUrl)) continue
      const existing = itemFor(source.peertubeUrl)
      if (existing) {
        await claim(existing).then(
          () => claimed++,
          (e: unknown) => log.warn('batch claim failed', existing.id, e)
        )
        continue
      }
      todo.push(source)
    }
    let done = 0
    onProgress?.(0, todo.length)
    const free = todo.length
      ? await b
          .usage()
          .then((u) => {
            usage.value = u
            return u.free
          })
          .catch(() => null)
      : null
    const prepared = await mapLimit(todo, BATCH_INFO_PARALLEL, async (source) => {
      const parsed = parsePeerTubeUrl(source.peertubeUrl)
      const info = parsed
        ? await getPeerTubeVideoInfo(parsed.host, parsed.videoId).catch(() => null)
        : null
      onProgress?.(++done, todo.length)
      if (!info || isProcessing(info)) return null
      const qualities = offlineQualities(info)
      return qualities.length ? { source, info, qualities, free } : null
    })
    const choices = prepared.filter((c): c is OfflineChoice => !!c)
    return {
      choices,
      rows: batchRows(choices.map((c) => c.qualities)),
      free,
      claimed,
      skipped: todo.length - choices.length,
    }
  }

  /** Качество ролика пачки: у аудио — самое маленькое, иначе — ближайшее не выше. */
  function batchQuality(choice: OfflineChoice, height: number): OfflineQuality | null {
    return choice.source.kind === 'audio'
      ? (choice.qualities[0] ?? null)
      : pickQuality(choice.qualities, height)
  }

  /** Сколько займёт пачка в этом качестве, байт. */
  function batchSize(batch: OfflineBatch, height: number): number {
    return batch.choices.reduce((sum, c) => sum + (batchQuality(c, height)?.size ?? 0), 0)
  }

  /** Поставить пачку в очередь по одному; сколько встало и сколько нет. */
  async function startMany(
    batch: OfflineBatch,
    height: number
  ): Promise<{ started: number; failed: number }> {
    let started = 0
    let failed = 0
    for (const choice of batch.choices) {
      const quality = batchQuality(choice, height)
      try {
        if (!quality) throw new Error('offline_no_quality')
        await start(choice, quality)
        started++
      } catch (e) {
        log.warn('batch start failed', choice.source.peertubeUrl, e)
        failed++
      }
    }
    return { started, failed }
  }

  async function claim(item: OfflineItem): Promise<OfflineItem> {
    const me = account.value
    if (!me || item.meta.accounts?.includes(me)) return item
    const b = await backend()
    const updated = await b.patchMeta(item.id, { accounts: [...(item.meta.accounts ?? []), me] })
    put(updated, updated.id)
    return updated
  }

  async function pause(id: string): Promise<void> {
    await (await backend()).pause(id)
  }

  async function resume(id: string): Promise<void> {
    await (await backend()).resume(id)
  }

  /**
   * Удалить у себя: убрать свой адрес; файл стирается, когда адресов не
   * осталось. Без аккаунта (страница настроек гостя) — стирается сразу.
   */
  async function remove(id: string): Promise<void> {
    const b = await backend()
    const item = items.get(id)
    const me = account.value
    const others = (item?.meta.accounts ?? []).filter((a) => a !== me)
    if (item && me && others.length) {
      put(await b.patchMeta(id, { accounts: others }), id)
      return
    }
    await b.remove(id)
    put(null, id)
  }

  /** «Удалить всё» на странице «Скачанное» — своё. */
  async function removeMine(): Promise<void> {
    for (const item of [...mine.value]) await remove(item.id).catch(() => {})
  }

  /** Аккаунт удалён с устройства — его адрес уходит из скачанного. */
  async function forgetAccount(address: string): Promise<void> {
    await hydrate()
    const b = backendRef
    if (!b) return
    for (const item of [...items.values()]) {
      const accounts = item.meta.accounts ?? []
      if (!accounts.includes(address)) continue
      const rest = accounts.filter((a) => a !== address)
      try {
        if (rest.length) put(await b.patchMeta(item.id, { accounts: rest }), item.id)
        else {
          await b.remove(item.id)
          put(null, item.id)
        }
      } catch (e) {
        log.warn('forget failed', item.id, e)
      }
    }
  }

  /** Стереть всё скачанное на устройстве. */
  async function clearAll(): Promise<void> {
    await hydrate()
    const b = backendRef
    if (!b) return
    await b.clear()
    for (const id of [...items.keys()]) put(null, id)
    usage.value = null
  }

  async function refreshUsage(): Promise<void> {
    const b = backendRef ?? (await hydrate(), backendRef)
    if (!b) return
    usage.value = await b.usage().catch(() => usage.value)
  }

  async function refreshLocation(): Promise<void> {
    const b = backendRef ?? (await hydrate(), backendRef)
    if (!b?.location) return
    location.value = await b.location().catch(() => location.value)
  }

  /**
   * Перенести скачанное (компьютер — папка или null, Android — 'internal' или
   * 'sd'). Загрузки встают и продолжаются на новом месте. Ошибка — код бэкенда
   * в `Error.message`.
   */
  async function moveTo(target: string | null): Promise<void> {
    const b = await backend()
    if (!b.moveTo || moving.value) return
    moving.value = { done: 0, total: 0 }
    try {
      location.value = await b.moveTo(target)
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : 'io', {
        cause: e,
      })
    } finally {
      moving.value = null
      // Список и место — заново: папки те же, но лежат теперь в другом месте.
      const list = await b.list().catch(() => null)
      if (list) {
        for (const id of [...items.keys()]) if (!list.some((i) => i.id === id)) put(null, id)
        for (const item of list) put(item, item.id)
      }
      await refreshUsage()
    }
  }

  /** Скачанное само — оставить насовсем: неделя больше не считается. */
  async function keep(id: string): Promise<void> {
    put(await (await backend()).patchMeta(id, { auto: null }), id)
  }

  async function setAutoSubs(on: boolean): Promise<void> {
    autoSubs.value = on
    persist(AUTO_KEY, on ? '1' : null)
    if (on) await runAuto()
  }

  let autoRunning: Promise<void> | null = null

  /** Проверка подписок; идущая не запускается второй раз. */
  function runAuto(now: number = Date.now()): Promise<void> {
    autoRunning ??= autoCheck(now)
      .catch((e: unknown) => log.warn('auto check failed', e))
      .finally(() => {
        autoRunning = null
      })
    return autoRunning
  }

  /**
   * Убрать скачанное само, которому неделя (даже если загрузку подписок уже
   * выключили), и поставить свежие ролики подписок: на безлимитной сети, в
   * качестве по умолчанию (при «Спрашивать» — AUTO_DEFAULT_HEIGHT), не больше
   * AUTO_PER_CHECK за раз и AUTO_MAX_ITEMS всего, пока свободно больше
   * AUTO_MIN_FREE_BYTES. Ролик ещё в обработке — посмотрим в следующий раз.
   */
  async function autoCheck(now: number): Promise<void> {
    await hydrate()
    const b = backendRef
    const me = account.value
    if (!b || !me) return
    for (const item of expiredAuto(items.values(), me, now)) {
      await remove(item.id).catch((e: unknown) => log.warn('auto expire failed', item.id, e))
    }
    if (!autoSubs.value) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const room = Math.min(AUTO_PER_CHECK, AUTO_MAX_ITEMS - autoItems(items.values(), me).length)
    if (room <= 0 || !(await unmeteredNetwork(b))) return

    const sinceKey = autoSinceKey(me)
    const since = readNumber(sinceKey) ?? now - AUTO_FIRST_WINDOW_MS
    const { fetchSubscriptionVideos } = await import('@/services/offline-video/subscription-videos')
    const videos = await fetchSubscriptionVideos(me)
    const picked = autoCandidates(videos, {
      since,
      have: (url) => !!itemFor(url),
      limit: room,
    })
    let next = Math.max(since, ...videos.map((v) => v.time))
    const pref = qualityPref.value
    for (const video of picked) {
      const result = await prepare(video.source)
      if (result.kind === 'processing') {
        next = Math.min(next, video.time - 1)
        continue
      }
      if (result.kind !== 'ready') continue
      const quality = pickQuality(
        result.choice.qualities,
        pref === 'ask' ? AUTO_DEFAULT_HEIGHT : pref
      )
      if (!quality) continue
      const free = result.choice.free
      if (free !== null && free < quality.size + AUTO_MIN_FREE_BYTES) break
      await start(result.choice, quality, { auto: now }).catch((e: unknown) =>
        log.warn('auto start failed', video.source.peertubeUrl, e)
      )
    }
    persist(sinceKey, String(next))
  }

  function setQualityPref(pref: OfflineQualityPref): void {
    qualityPref.value = pref
    persist(QUALITY_KEY, pref === 'ask' ? null : String(pref))
  }

  async function setWifiOnly(on: boolean): Promise<void> {
    wifiOnly.value = on
    persist(WIFI_ONLY_KEY, on ? null : '0')
    await backendRef?.setWifiOnly?.(on)
  }

  /**
   * Не удалил ли автор: ролика нет ни на одной ноде, в архиве и у прокси
   * (`not-found` описания). Файл остаётся, на карточке — пометка.
   */
  async function checkDeleted(item: OfflineItem, now: number = Date.now()): Promise<void> {
    const b = backendRef
    if (!b || item.meta.authorDeleted) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const parsed = parsePeerTubeUrl(item.meta.peertubeUrl)
    if (!parsed) return
    let deleted = false
    try {
      await getPeerTubeVideoInfo(parsed.host, parsed.videoId)
    } catch (e) {
      // Сеть или нода молчит — не значит «удалён».
      if (!(e instanceof PeerTubeFetchError && e.code === 'not-found')) return
      deleted = true
    }
    const patch = deleted ? { authorDeleted: now, checkedAt: now } : { checkedAt: now }
    put(await b.patchMeta(item.id, patch).catch(() => item), item.id)
  }

  async function checkDeletedAll(now: number = Date.now()): Promise<void> {
    for (const item of [...items.values()]) {
      if (item.state.status !== 'done' || item.meta.authorDeleted) continue
      if (now - (item.meta.checkedAt ?? 0) < CHECK_EVERY_MS) continue
      await checkDeleted(item, now)
    }
  }

  /** Открыли ролик с сетью — заодно проверить его. */
  function noteOpened(peertubeUrl: string): void {
    const item = itemFor(peertubeUrl)
    if (item && Date.now() - (item.meta.checkedAt ?? 0) >= CHECK_EVERY_MS) void checkDeleted(item)
  }

  function openSheet(choice: OfflineChoice): void {
    sheet.value = choice
  }

  function closeSheet(): void {
    sheet.value = null
  }

  function openBatchSheet(batch: OfflineBatch): void {
    batchSheet.value = batch
  }

  function closeBatchSheet(): void {
    batchSheet.value = null
  }

  function openPlayer(id: string): void {
    openedId.value = id
  }

  function closePlayer(): void {
    openedId.value = null
  }

  return {
    available,
    sheet,
    batchSheet,
    opened,
    openSheet,
    closeSheet,
    openBatchSheet,
    closeBatchSheet,
    openPlayer,
    closePlayer,
    ready,
    items,
    progress,
    usage,
    qualityPref,
    wifiOnly,
    autoSubs,
    location,
    moving,
    canChooseLocation,
    refreshLocation,
    moveTo,
    mine,
    mineUsed,
    hydrate,
    itemFor,
    mineFor,
    prepare,
    autoQuality,
    start,
    prepareMany,
    batchQuality,
    batchSize,
    startMany,
    pause,
    resume,
    claim,
    remove,
    removeMine,
    forgetAccount,
    clearAll,
    refreshUsage,
    setQualityPref,
    setWifiOnly,
    setAutoSubs,
    keep,
    runAuto,
    checkDeleted,
    checkDeletedAll,
    noteOpened,
  }
})
