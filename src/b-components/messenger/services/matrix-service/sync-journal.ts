// Журнал синка Matrix — для «Сведений о приложении» (support-report).
//
// Жалоба с Android: список чатов встаёт из кэша, а первый ответ сервера
// минутами не приходит или не успевает обработаться — висит «Обновляю…».
// Без телефона не видно, где стоит. Журнал пишет путь синка по шагам:
//   - подготовительные запросы SDK перед первым /sync (push rules, фильтр);
//   - запрос /sync: первый, догоняющий после кэша или обычный долгий опрос;
//   - ответ: код, размер, сколько шёл;
//   - сколько SDK разбирал ответ до следующего состояния (SYNCING);
//   - смены состояния и перезапуски сторожа (sync-watchdog).
// Пауза между разбором и следующим запросом (SDK пишет кэш в IndexedDB) —
// поле `idleMs` у запроса.
//
// Только времена, коды и размеры: ни адресов, ни токенов, ни содержимого.
// Хранится в localStorage: после зависания приложение обычно перезапускают, а
// сведения отправляют потом.

import { scrubForReport } from '@/helpers/diagnostics/recent-errors'

export type SyncRequestKind = 'sync' | 'pushrules' | 'filter'
/** Первый синк без кэша, догоняющий (timeout=0) или обычный долгий опрос. */
export type SyncMode = 'initial' | 'catch-up' | 'poll'

type EntryBody =
  | { ev: 'start'; cache: boolean }
  | { ev: 'request'; kind: SyncRequestKind; mode?: SyncMode; pollS?: number; idleMs?: number }
  | { ev: 'response'; kind: SyncRequestKind; status: number; ms: number; kb: number }
  | { ev: 'error'; kind: SyncRequestKind; ms: number; error: string; byWatchdog?: true }
  | { ev: 'processed'; ms: number }
  | { ev: 'state'; state: string; prev?: string }
  | { ev: 'recovery'; reason: 'request-hung' | 'stuck'; kind?: SyncRequestKind; waitedS: number }

/** Запись в хранилище: время — числом. */
type StoredEntry = EntryBody & { t: number }
/** Запись в сведениях: время — ISO. */
export type SyncJournalEntry = EntryBody & { at: string }

export interface SyncJournalReport {
  /** Состояние синка SDK и сколько оно длится. */
  state: string
  stateForS: number
  /** Сколько назад SDK закончил разбирать ответ сервера. */
  lastSyncAgoS?: number
  /** Запрос, который ждёт ответа сейчас (самый старый). */
  waiting?: { kind: SyncRequestKind; mode?: SyncMode; forS: number }
  /** Ответ пришёл, а SDK его ещё разбирает. */
  processingForS?: number
  /** Перезапусков сторожа за этот запуск. */
  recoveries: number
  journal: SyncJournalEntry[]
}

/** Запрос в пути: сторож может его оборвать. */
export interface InFlightRequest {
  kind: SyncRequestKind
  mode?: SyncMode
  started: number
  /** Сколько сервер может держать долгий опрос, с. */
  pollS: number
  abort: () => void
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const STORAGE_KEY = 'BST_DIAG_SYNC'
/** ~10 минут обычного опроса (три записи на цикл) — и то, что было до перезапуска. */
const MAX_ENTRIES = 80
const NULL_BODY_STATUS = new Set([101, 204, 205, 304])

const SYNC_PATH = /\/_matrix\/client\/(?:v3|r0)\/sync$/
const PUSHRULES_PATH = /\/_matrix\/client\/(?:v3|r0)\/pushrules(?:\/|$)/
const FILTER_PATH = /\/_matrix\/client\/(?:v3|r0)\/user\/[^/]+\/filter(?:\/[^/]+)?$/

function requestUrl(input: RequestInfo | URL): URL | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  try {
    return new URL(raw, 'http://local')
  } catch {
    return null
  }
}

/** Какой это запрос синка; остальные журнал не трогает. */
export function syncRequestKind(input: RequestInfo | URL): SyncRequestKind | null {
  const path = requestUrl(input)?.pathname ?? ''
  if (SYNC_PATH.test(path)) return 'sync'
  if (PUSHRULES_PATH.test(path)) return 'pushrules'
  if (FILTER_PATH.test(path)) return 'filter'
  return null
}

function syncMode(url: URL | null): { mode: SyncMode; pollS: number } {
  const timeout = Number(url?.searchParams.get('timeout') ?? 0)
  const pollS = Number.isFinite(timeout) && timeout > 0 ? Math.round(timeout / 1000) : 0
  if (!url?.searchParams.get('since')) return { mode: 'initial', pollS }
  return { mode: pollS === 0 ? 'catch-up' : 'poll', pollS }
}

function errorText(e: unknown): string {
  const { name, message } = (e ?? {}) as { name?: unknown; message?: unknown }
  const text = [name, message].filter((x) => typeof x === 'string' && x).join(': ')
  return scrubForReport(text || String(e)).slice(0, 120)
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export interface SyncJournalDeps {
  now?: () => number
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

export function createSyncJournal(deps: SyncJournalDeps = {}) {
  const now = deps.now ?? (() => Date.now())
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage

  const load = (): StoredEntry[] => {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]') as unknown
      return Array.isArray(parsed) ? (parsed as StoredEntry[]).slice(-MAX_ENTRIES) : []
    } catch {
      return []
    }
  }

  let entries = load()
  const inFlight = new Map<number, InFlightRequest>()
  let seq = 0
  let state: string | null = null
  let stateSince = now()
  /** Когда пришёл ответ /sync, который SDK ещё разбирает. */
  let awaitingSince: number | null = null
  let lastProcessedAt: number | null = null
  let recoveries = 0

  function push(body: EntryBody, t = now()): void {
    entries.push({ ...body, t } as StoredEntry)
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      /* место кончилось или хранилище закрыто — журнал best-effort */
    }
  }

  /**
   * Обёртка fetch клиента Matrix: запросы синка — в журнал, со своим
   * AbortController (сторож обрывает зависший), ответ читается целиком —
   * размер и время до последнего байта. Прочие запросы идут как есть.
   */
  function wrapFetch(fetchFn: FetchFn): FetchFn {
    return async (input, init) => {
      const kind = syncRequestKind(input)
      if (!kind) return fetchFn(input, init)

      const { mode, pollS } =
        kind === 'sync' ? syncMode(requestUrl(input)) : { mode: undefined, pollS: 0 }
      const controller = new AbortController()
      let byWatchdog = false
      const outer = init?.signal
      if (outer?.aborted) controller.abort(outer.reason)
      else outer?.addEventListener('abort', () => controller.abort(outer.reason), { once: true })

      const id = ++seq
      const started = now()
      inFlight.set(id, {
        kind,
        mode,
        started,
        pollS,
        abort: () => {
          byWatchdog = true
          controller.abort()
        },
      })
      push(
        {
          ev: 'request',
          kind,
          ...(mode ? { mode, pollS } : {}),
          ...(kind === 'sync' && lastProcessedAt !== null
            ? { idleMs: started - lastProcessedAt }
            : {}),
        },
        started
      )
      try {
        const res = await fetchFn(input, { ...init, signal: controller.signal })
        const body = NULL_BODY_STATUS.has(res.status) ? null : await res.arrayBuffer()
        const done = now()
        push(
          {
            ev: 'response',
            kind,
            status: res.status,
            ms: done - started,
            kb: Math.round((body?.byteLength ?? 0) / 1024),
          },
          done
        )
        if (kind === 'sync' && res.ok) awaitingSince = done
        return new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        })
      } catch (e) {
        push({
          ev: 'error',
          kind,
          ms: now() - started,
          error: errorText(e),
          ...(byWatchdog ? { byWatchdog: true as const } : {}),
        })
        throw e
      } finally {
        inFlight.delete(id)
      }
    }
  }

  return {
    wrapFetch,

    /** Клиент запущен; `cache` — список встанет из сохранённого синка. */
    noteStart(cache: boolean): void {
      state = null
      stateSince = now()
      awaitingSince = null
      lastProcessedAt = null
      push({ ev: 'start', cache })
    },

    /** Событие `sync` SDK. */
    noteState(next: string, prev?: string | null): void {
      const t = now()
      if (
        awaitingSince !== null &&
        (next === 'SYNCING' || next === 'PREPARED' || next === 'CATCHUP')
      ) {
        push({ ev: 'processed', ms: t - awaitingSince }, t)
        awaitingSince = null
        lastProcessedAt = t
      }
      if (next === 'ERROR' || next === 'RECONNECTING' || next === 'STOPPED') awaitingSince = null
      if (next !== state) {
        const before = state ?? prev ?? undefined
        push({ ev: 'state', state: next, ...(before ? { prev: before } : {}) }, t)
        state = next
        stateSince = t
      }
    },

    noteRecovery(reason: 'request-hung' | 'stuck', waitedMs: number, kind?: SyncRequestKind): void {
      recoveries += 1
      push({
        ev: 'recovery',
        reason,
        ...(kind ? { kind } : {}),
        waitedS: Math.round(waitedMs / 1000),
      })
    },

    state: (): string | null => state,
    stateForMs: (t = now()): number => t - stateSince,
    /** Ответ /sync у SDK на разборе: сколько уже, null — не на разборе. */
    processingMs: (t = now()): number | null => (awaitingSince === null ? null : t - awaitingSince),
    hasInFlight: (): boolean => inFlight.size > 0,

    /**
     * Самый старый запрос, который ждёт дольше, чем сервер может его держать
     * (долгий опрос), ещё на `graceMs`.
     */
    hungRequest(t: number, graceMs: number): InFlightRequest | null {
      let oldest: InFlightRequest | null = null
      for (const req of inFlight.values()) {
        if (t - req.started <= req.pollS * 1000 + graceMs) continue
        if (!oldest || req.started < oldest.started) oldest = req
      }
      return oldest
    },

    report(t = now()): SyncJournalReport {
      const waiting = [...inFlight.values()].sort((a, b) => a.started - b.started)[0]
      const seconds = (ms: number) => Math.round(ms / 1000)
      return {
        state: state ?? 'none',
        stateForS: seconds(t - stateSince),
        ...(lastProcessedAt !== null ? { lastSyncAgoS: seconds(t - lastProcessedAt) } : {}),
        ...(waiting
          ? {
              waiting: {
                kind: waiting.kind,
                ...(waiting.mode ? { mode: waiting.mode } : {}),
                forS: seconds(t - waiting.started),
              },
            }
          : {}),
        ...(awaitingSince !== null ? { processingForS: seconds(t - awaitingSince) } : {}),
        recoveries,
        journal: entries.map(({ t: at, ...body }) => ({
          ...body,
          at: new Date(at).toISOString(),
        })) as SyncJournalEntry[],
      }
    },
  }
}

export type SyncJournal = ReturnType<typeof createSyncJournal>

export const syncJournal = createSyncJournal()
