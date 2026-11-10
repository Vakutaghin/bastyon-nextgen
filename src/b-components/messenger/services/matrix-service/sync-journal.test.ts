// Журнал синка: какие запросы пишутся, что о них известно (режим, код, размер,
// время), сколько SDK разбирал ответ, обрыв сторожем, переживает перезапуск,
// в сведениях — ни адресов, ни токенов.

import { describe, expect, it, vi } from 'vitest'

import { createSyncJournal, syncRequestKind } from './sync-journal'

const HOST = 'https://matrix.pocketnet.app/_matrix/client/v3'
const CATCH_UP = `${HOST}/sync?filter=7&since=s1_SECRET&timeout=0&access_token=TOKEN`
const POLL = `${HOST}/sync?filter=7&since=s2&timeout=30000`
const INITIAL = `${HOST}/sync?filter=%7B%7D&timeout=0`

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

function setup(storage: ReturnType<typeof memoryStorage> | null = null) {
  const clock = { t: 1_000_000 }
  const journal = createSyncJournal({ now: () => clock.t, storage })
  return { journal, clock }
}

/** fetch, который отвечает `body` через `ms` (по часам теста). */
function answering(clock: { t: number }, ms: number, body = '{"next_batch":"s2"}', status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    clock.t += ms
    return new Response(body, { status, headers: { 'content-type': 'application/json' } })
  })
}

/** fetch, который не отвечает, пока его не оборвут. */
function hanging() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const aborted = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        if (init?.signal?.aborted) aborted()
        init?.signal?.addEventListener('abort', aborted)
      })
  )
}

const events = (journal: ReturnType<typeof createSyncJournal>) =>
  journal.report().journal.map((e) => e.ev)

describe('syncRequestKind', () => {
  it('синк, push rules и фильтр — да; остальное, медиа и чужие пути — нет', () => {
    expect(syncRequestKind(CATCH_UP)).toBe('sync')
    expect(syncRequestKind(new URL(`${HOST.replace('v3', 'r0')}/sync`))).toBe('sync')
    expect(syncRequestKind(`${HOST}/pushrules/`)).toBe('pushrules')
    expect(syncRequestKind(`${HOST}/user/%40a%3Ahost/filter`)).toBe('filter')
    expect(syncRequestKind(`${HOST}/user/%40a%3Ahost/filter/12`)).toBe('filter')
    expect(syncRequestKind(`${HOST}/rooms/!r:host/messages?dir=b`)).toBeNull()
    expect(syncRequestKind('https://matrix.pocketnet.app/_matrix/client/versions')).toBeNull()
    expect(syncRequestKind(`${HOST}/sync/extra`)).toBeNull()
    expect(syncRequestKind('::bad url::')).toBeNull()
  })
})

describe('wrapFetch', () => {
  it('догоняющий /sync: запрос и ответ — режим, код, размер, время; тело доходит до SDK', async () => {
    const { journal, clock } = setup()
    const body = JSON.stringify({ next_batch: 's2', pad: 'x'.repeat(3000) })
    const fetchFn = journal.wrapFetch(answering(clock, 1500, body))
    const res = await fetchFn(CATCH_UP, { method: 'GET' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toMatchObject({ next_batch: 's2' })
    expect(journal.report().journal).toEqual([
      { ev: 'request', kind: 'sync', mode: 'catch-up', pollS: 0, at: expect.any(String) },
      { ev: 'response', kind: 'sync', status: 200, ms: 1500, kb: 3, at: expect.any(String) },
    ])
  })

  it('режимы: без since — первый, timeout>0 — долгий опрос с его длиной', async () => {
    const { journal, clock } = setup()
    const fetchFn = journal.wrapFetch(answering(clock, 10))
    await fetchFn(INITIAL)
    await fetchFn(POLL)
    const requests = journal.report().journal.filter((e) => e.ev === 'request')
    expect(requests).toEqual([
      expect.objectContaining({ mode: 'initial', pollS: 0 }),
      expect.objectContaining({ mode: 'poll', pollS: 30 }),
    ])
  })

  it('прочие запросы идут как есть, мимо журнала', async () => {
    const { journal, clock } = setup()
    const inner = answering(clock, 10)
    const init = { method: 'PUT', body: '{}' }
    await journal.wrapFetch(inner)(`${HOST}/rooms/!r:host/send/m.room.message/m1`, init)
    expect(inner).toHaveBeenCalledWith(`${HOST}/rooms/!r:host/send/m.room.message/m1`, init)
    expect(journal.report().journal).toEqual([])
  })

  it('подготовительные запросы — без режима; ответ без тела (204) не ломается', async () => {
    const { journal, clock } = setup()
    await journal.wrapFetch(answering(clock, 5, '', 200))(`${HOST}/pushrules/`)
    const res = await journal.wrapFetch(vi.fn(async () => new Response(null, { status: 204 })))(
      `${HOST}/user/%40a%3Ahost/filter/9`
    )
    expect(res.status).toBe(204)
    // Тело у 204 — null, как у настоящего ответа (браузер иначе бросит).
    expect(res.body).toBeNull()
    expect(journal.report().journal.map((e) => [e.ev, 'kind' in e ? e.kind : ''])).toEqual([
      ['request', 'pushrules'],
      ['response', 'pushrules'],
      ['request', 'filter'],
      ['response', 'filter'],
    ])
    expect(journal.report().journal[0]).not.toHaveProperty('mode')
  })

  it('сбой — запись с текстом без адресов, ошибка уходит SDK, запрос не числится в пути', async () => {
    const { journal, clock } = setup()
    const fetchFn = journal.wrapFetch(
      vi.fn(async () => {
        clock.t += 700
        throw new TypeError('connect failed: PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D')
      })
    )
    await expect(fetchFn(POLL)).rejects.toThrow('connect failed')
    const error = journal.report().journal.slice(-1)[0]!
    expect(error).toMatchObject({ ev: 'error', kind: 'sync', ms: 700 })
    expect(JSON.stringify(error)).not.toContain('PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D')
    expect(error).not.toHaveProperty('byWatchdog')
    expect(journal.hasInFlight()).toBe(false)

    // Длинный текст ошибки не раздувает журнал.
    const long = journal.wrapFetch(
      vi.fn(async () => {
        throw new Error('HTTP 502 (gateway); '.repeat(30))
      })
    )
    await expect(long(POLL)).rejects.toThrow()
    const last = journal.report().journal.slice(-1)[0] as { error: string }
    expect(last.error.length).toBe(120)
  })

  it('SDK отменил запрос сам (свой signal) — отмена доходит до сети', async () => {
    const { journal } = setup()
    const inner = hanging()
    const sdk = new AbortController()
    const pending = journal.wrapFetch(inner)(POLL, { signal: sdk.signal })
    sdk.abort()
    await expect(pending).rejects.toThrow('aborted')
    expect(journal.report().journal.slice(-1)[0]).not.toHaveProperty('byWatchdog')
    // Уже отменённый — сразу.
    const done = new AbortController()
    done.abort()
    await expect(journal.wrapFetch(hanging())(POLL, { signal: done.signal })).rejects.toThrow()
  })
})

describe('зависший запрос и сторож', () => {
  it('hungRequest — только дольше своего опроса плюс запас; самый старый', async () => {
    const { journal, clock } = setup()
    const fetchFn = journal.wrapFetch(hanging())
    void fetchFn(POLL).catch(() => {})
    clock.t += 5_000
    void fetchFn(`${HOST}/pushrules/`).catch(() => {})
    clock.t += 60_000
    // Ровно запас — ещё не завис.
    expect(journal.hungRequest(clock.t, 60_000)).toBeNull()
    clock.t += 1
    // Опрос держится до 30 с + 60 с запаса, push rules — 60 с.
    expect(journal.hungRequest(clock.t, 60_000)).toMatchObject({ kind: 'pushrules' })
    clock.t += 30_000
    expect(journal.hungRequest(clock.t, 60_000)).toMatchObject({ kind: 'sync', pollS: 30 })
  })

  it('обрыв сторожем — запись byWatchdog, SDK получает ошибку как от сети', async () => {
    const { journal, clock } = setup()
    const pending = journal.wrapFetch(hanging())(CATCH_UP)
    clock.t += 61_000
    const hung = journal.hungRequest(clock.t, 60_000)!
    journal.noteRecovery('request-hung', clock.t - hung.started, hung.kind)
    hung.abort()
    await expect(pending).rejects.toThrow()
    expect(journal.report().journal.slice(-2)).toEqual([
      expect.objectContaining({
        ev: 'recovery',
        reason: 'request-hung',
        kind: 'sync',
        waitedS: 61,
      }),
      expect.objectContaining({ ev: 'error', kind: 'sync', ms: 61_000, byWatchdog: true }),
    ])
    expect(journal.report().recoveries).toBe(1)
  })
})

describe('состояния и разбор ответа', () => {
  it('разбор: от ответа до SYNCING; пауза до следующего запроса — idleMs', async () => {
    const { journal, clock } = setup()
    const fetchFn = journal.wrapFetch(answering(clock, 200))
    journal.noteState('PREPARED', null)
    await fetchFn(CATCH_UP)
    expect(journal.processingMs(clock.t)).toBe(0)
    clock.t += 4_000
    journal.noteState('SYNCING', 'PREPARED')
    expect(journal.processingMs()).toBeNull()
    clock.t += 9_000
    await fetchFn(POLL)
    const log = journal.report().journal
    expect(log.find((e) => e.ev === 'processed')).toMatchObject({ ms: 4_000 })
    expect(log.filter((e) => e.ev === 'request').slice(-1)[0]).toMatchObject({ idleMs: 9_000 })
  })

  it('SYNCING → SYNCING — одна запись состояния; у каждого ответа свой разбор', async () => {
    const { journal, clock } = setup()
    const fetchFn = journal.wrapFetch(answering(clock, 30_000))
    for (let i = 0; i < 3; i++) {
      await fetchFn(POLL)
      journal.noteState('SYNCING', 'SYNCING')
    }
    expect(events(journal).filter((e) => e === 'state')).toHaveLength(1)
    expect(events(journal).filter((e) => e === 'processed')).toHaveLength(3)
  })

  it('ошибка синка снимает «на разборе»: следующее состояние разбором не считается', async () => {
    const { journal, clock } = setup()
    await journal.wrapFetch(answering(clock, 10))(POLL)
    journal.noteState('RECONNECTING', 'SYNCING')
    journal.noteState('SYNCING', 'RECONNECTING')
    expect(events(journal)).not.toContain('processed')
  })

  it('запуск клиента сбрасывает состояние и помечает, есть ли кэш', () => {
    const { journal, clock } = setup()
    journal.noteState('SYNCING', null)
    clock.t += 50_000
    journal.noteStart(true)
    expect(journal.state()).toBeNull()
    expect(journal.stateForMs()).toBe(0)
    expect(journal.report().journal.slice(-1)[0]).toMatchObject({ ev: 'start', cache: true })
  })
})

describe('report', () => {
  it('сейчас: состояние и сколько длится, последний синк, что ждёт ответа, что на разборе', async () => {
    const { journal, clock } = setup()
    const ok = journal.wrapFetch(answering(clock, 100))
    journal.noteState('PREPARED', null)
    await ok(POLL)
    journal.noteState('SYNCING', 'PREPARED')
    clock.t += 10_000
    void journal
      .wrapFetch(hanging())(POLL)
      .catch(() => {})
    clock.t += 25_000
    const report = journal.report()
    expect(report).toMatchObject({
      state: 'SYNCING',
      stateForS: 35,
      lastSyncAgoS: 35,
      waiting: { kind: 'sync', mode: 'poll', forS: 25 },
      recoveries: 0,
    })
    expect(report).not.toHaveProperty('processingForS')
    expect(report.journal[0]!.at).toBe(new Date(1_000_000).toISOString())
  })

  it('ответ пришёл и разбирается — processingForS; до первого состояния — none', async () => {
    const { journal, clock } = setup()
    expect(journal.report().state).toBe('none')
    await journal.wrapFetch(answering(clock, 100))(CATCH_UP)
    clock.t += 42_000
    expect(journal.report().processingForS).toBe(42)
  })

  it('в сведениях нет ни токена, ни since, ни адресов запросов', async () => {
    const { journal, clock } = setup()
    await journal.wrapFetch(answering(clock, 10))(CATCH_UP)
    const json = JSON.stringify(journal.report())
    for (const secret of ['TOKEN', 's1_SECRET', 'matrix.pocketnet.app', 'filter=7']) {
      expect(json).not.toContain(secret)
    }
  })
})

describe('хранение', () => {
  it('переживает перезапуск: новый журнал читает прежние записи', async () => {
    const storage = memoryStorage()
    const first = setup(storage)
    await first.journal.wrapFetch(answering(first.clock, 10))(CATCH_UP)
    const second = setup(storage)
    expect(second.journal.report().journal.map((e) => e.ev)).toEqual(['request', 'response'])
  })

  it('не больше 80 записей — самые новые', () => {
    const storage = memoryStorage()
    const { journal, clock } = setup(storage)
    for (let i = 0; i < 100; i++) {
      clock.t += 1000
      journal.noteState(i % 2 ? 'SYNCING' : 'RECONNECTING', null)
    }
    const log = journal.report().journal
    expect(log).toHaveLength(80)
    expect(log.slice(-1)[0]!.at).toBe(new Date(1_000_000 + 100_000).toISOString())
    expect(JSON.parse(storage.getItem('BST_DIAG_SYNC')!)).toHaveLength(80)
  })

  it('битое или недоступное хранилище — журнал работает в памяти', () => {
    const broken = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const journal = createSyncJournal({ storage: broken })
    expect(() => journal.noteState('SYNCING', null)).not.toThrow()
    expect(journal.report().journal).toHaveLength(1)
  })
})
