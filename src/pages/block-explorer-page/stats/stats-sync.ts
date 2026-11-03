/**
 * Вся история активности сети — на устройстве, одна на приложение.
 *
 * Раньше график спрашивал ноду под каждый выбранный период: переключил
 * «30 дней» на «Год» — снова «Загружено x из y», а текущий кусок суток
 * перезапрашивался при каждом переключении. Теперь история собирается один
 * раз сразу за всё время (сутки кусками по 10 от свежих к старым, последние
 * 168 часов, аккаунты по часам) и лежит в IndexedDB; любой период и свой
 * диапазон строятся из неё без запросов. Над графиками — дата синхронизации
 * и «Обновить»: оно дозапрашивает только то, что к прошлому разу ещё не
 * закончилось (последние сутки, часы), и куски, которые тогда не пришли.
 *
 * Законченные куски — `day-chunk:k` (их же писала прежняя версия, они
 * переиспользуются), незаконченный на момент синхронизации — `day-open:k`.
 */

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useNodeInfo } from '@/composables/use-block-explorer-queries'
import { DAY_BLOCKS, type ChainAnchor } from './chain-time'
import type { Buckets } from './stats-model'
import {
  chunksFor,
  fetchAccountsByHour,
  fetchDayChunk,
  fetchHours,
  isChunkFinal,
  readHistory,
  runLimited,
  writeHistory,
} from './stats-source'

const CONCURRENCY = 4
/** Сколько пришедших кусков копить перед записью: прерванная синхронизация не теряет всё. */
const WRITE_BATCH = 20
/** Графики перерисовываются не чаще: за полную синхронизацию приходит ~300 кусков. */
const PUBLISH_MS = 400

const META_KEY = 'sync-meta'
const HOURS_KEY = 'sync-hours'
const ACCOUNTS_KEY = 'sync-accounts'
const finalKey = (k: number) => `day-chunk:${k}`
const openKey = (k: number) => `day-open:${k}`

interface SyncMeta {
  /** Когда синхронизация закончилась без пропусков. */
  at: number
}

export interface StatsProgress {
  done: number
  total: number
}

const chunks = new Map<number, Buckets>()
/** Куски, которые уже не изменятся: их последние сутки прошли к моменту запроса. */
const finalChunks = new Set<number>()

const days = shallowRef<Buckets>({})
const hours = shallowRef<Buckets | null>(null)
const accounts = shallowRef<Record<string, number> | null>(null)
const syncedAt = ref<number | null>(null)
const syncing = ref(false)
const progress = ref<StatsProgress | null>(null)
const failed = ref(0)
const error = ref<unknown>(null)

let restoring: Promise<void> | null = null
let running: Promise<void> | null = null
let publishTimer: ReturnType<typeof setTimeout> | null = null

function publishNow(): void {
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = null
  const merged: Buckets = {}
  for (const k of [...chunks.keys()].sort((a, b) => a - b)) Object.assign(merged, chunks.get(k))
  days.value = merged
}

function publishSoon(): void {
  publishTimer ??= setTimeout(publishNow, PUBLISH_MS)
}

const currentDay = (tip: ChainAnchor) => Math.floor(tip[0] / DAY_BLOCKS)

/** Что уже есть на устройстве — без сети. */
async function restore(tip: ChainAnchor): Promise<void> {
  const all = chunksFor(0, currentDay(tip))
  const stored = await readHistory<unknown>([
    META_KEY,
    HOURS_KEY,
    ACCOUNTS_KEY,
    ...all.flatMap((k) => [finalKey(k), openKey(k)]),
  ])
  for (const k of all) {
    const done = stored.get(finalKey(k)) as Buckets | undefined
    const open = stored.get(openKey(k)) as Buckets | undefined
    if (done) {
      chunks.set(k, done)
      finalChunks.add(k)
    } else if (open && !chunks.has(k)) {
      chunks.set(k, open)
    }
  }
  hours.value ??= (stored.get(HOURS_KEY) as Buckets | undefined) ?? null
  accounts.value ??= (stored.get(ACCOUNTS_KEY) as Record<string, number> | undefined) ?? null
  syncedAt.value ??= (stored.get(META_KEY) as SyncMeta | undefined)?.at ?? null
  publishNow()
}

/**
 * Дозапросить всё, чего нет или что могло измениться: незаконченные и не
 * пришедшие куски суток, часы и аккаунты. Первый раз — это вся история.
 */
export function syncStats(tip: ChainAnchor): Promise<void> {
  running ??= (async () => {
    await (restoring ??= restore(tip))
    syncing.value = true
    failed.value = 0
    error.value = null
    const today = currentDay(tip)
    const need = chunksFor(0, today).filter((k) => !finalChunks.has(k))
    const toStore = new Map<string, unknown>()
    const flush = (): void => {
      if (!toStore.size) return
      void writeHistory(new Map(toStore))
      toStore.clear()
    }

    type Task = () => Promise<void>
    const tasks: Task[] = [
      async () => {
        hours.value = await fetchHours(168)
        toStore.set(HOURS_KEY, hours.value)
      },
      async () => {
        accounts.value = await fetchAccountsByHour(168)
        toStore.set(ACCOUNTS_KEY, accounts.value)
      },
      ...need.map(
        (k): Task =>
          async () => {
            const data = await fetchDayChunk(k)
            chunks.set(k, data)
            if (isChunkFinal(k, today)) {
              finalChunks.add(k)
              toStore.set(finalKey(k), data)
            } else {
              toStore.set(openKey(k), data)
            }
            publishSoon()
            if (toStore.size >= WRITE_BATCH) flush()
          }
      ),
    ]
    progress.value = { done: 0, total: tasks.length }

    // Не пришедшее спрашиваем ещё раз в конце: нода за прокси бывает другой.
    const attempt = async (queue: Task[]): Promise<Task[]> => {
      const left: Task[] = []
      await runLimited(queue, CONCURRENCY, async (task) => {
        try {
          await task()
          if (progress.value) progress.value.done += 1
        } catch {
          left.push(task)
        }
      })
      return left
    }
    const missing = await attempt(await attempt(tasks))

    flush()
    publishNow()
    failed.value = missing.length
    if (!missing.length) {
      syncedAt.value = Date.now()
      void writeHistory(new Map([[META_KEY, { at: syncedAt.value } satisfies SyncMeta]]))
    } else if (missing.length === tasks.length) {
      error.value = new Error('the node did not answer')
    }
    progress.value = null
    syncing.value = false
  })().finally(() => {
    running = null
  })
  return running
}

/** Вершина цепочки [высота, время] — для перевода корзин во время. */
export function useChainTip(): Ref<ChainAnchor | null> {
  const { data } = useNodeInfo()
  return computed<ChainAnchor | null>(() => {
    const last = data.value?.data?.lastblock
    return last?.height && last?.time ? [last.height, last.time] : null
  })
}

/**
 * Поднять сохранённое; ни разу не синхронизировались (или прошлый раз
 * прервался) — синхронизировать. Дальше — только по «Обновить».
 */
export async function startStatsSync(tip: ChainAnchor): Promise<void> {
  await (restoring ??= restore(tip))
  if (syncedAt.value === null) await syncStats(tip)
}

/** Состояние истории — только для чтения. */
export const statsSyncState = {
  days: computed(() => days.value),
  hours: computed(() => hours.value),
  accounts: computed(() => accounts.value),
  syncedAt: computed(() => syncedAt.value),
  syncing: computed(() => syncing.value),
  progress: computed(() => progress.value),
  failed: computed(() => failed.value),
  error: computed(() => error.value),
}

/** История на устройстве для страницы: первый вызов с известной вершиной её поднимает. */
export function useStatsSync() {
  const tip = useChainTip()
  watch(
    tip,
    (anchor) => {
      if (anchor && !restoring) void startStatsSync(anchor)
    },
    { immediate: true }
  )

  function refresh(): void {
    if (tip.value) void syncStats(tip.value)
  }

  return { tip, ...statsSyncState, refresh }
}

/** Сброс модульного состояния — только для тестов. */
export function resetStatsSyncForTests(): void {
  chunks.clear()
  finalChunks.clear()
  days.value = {}
  hours.value = null
  accounts.value = null
  syncedAt.value = null
  syncing.value = false
  progress.value = null
  failed.value = 0
  error.value = null
  restoring = null
  running = null
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = null
}
