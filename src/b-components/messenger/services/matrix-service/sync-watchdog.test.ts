// Сторож синка: зависший запрос обрывается (и RECONNECTING повторяется сразу),
// «Обновляю…» дольше минуты без запросов в пути — SDK будят. В фоне, без сети,
// без клиента, при ответе на разборе и чаще раза в минуту — ничего.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSyncJournal } from './sync-journal'
import {
  CHECK_MS,
  HUNG_GRACE_MS,
  RECOVERY_GAP_MS,
  RECOVERY_RETRY_WINDOW_MS,
  STUCK_MS,
  createSyncWatchdog,
} from './sync-watchdog'

const POLL = 'https://h/_matrix/client/v3/sync?since=s1&timeout=30000'
const CATCH_UP = 'https://h/_matrix/client/v3/sync?since=s1&timeout=0'

function hanging() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      })
  )
}

function setup() {
  const clock = { t: 5_000_000 }
  const journal = createSyncJournal({ now: () => clock.t, storage: null })
  const env = { hidden: false, offline: false }
  const client = { retryImmediately: vi.fn(() => true) }
  const watchdog = createSyncWatchdog({
    journal,
    client: () => client,
    hidden: () => env.hidden,
    offline: () => env.offline,
    now: () => clock.t,
  })
  const hang = (url = CATCH_UP) => {
    const pending = journal.wrapFetch(hanging())(url)
    pending.catch(() => {})
    return pending
  }
  return { clock, journal, env, client, watchdog, hang }
}

afterEach(() => vi.useRealTimers())

describe('зависший запрос', () => {
  it('догоняющий /sync дольше минуты — обрыв, запись, повтор RECONNECTING сразу', async () => {
    const { clock, journal, watchdog, hang } = setup()
    const pending = hang()
    clock.t += HUNG_GRACE_MS
    expect(watchdog.check()).toBe('none')
    clock.t += 1
    expect(watchdog.check()).toBe('aborted')
    await expect(pending).rejects.toThrow()
    expect(journal.report().journal.map((e) => e.ev)).toEqual(['request', 'recovery', 'error'])
    expect(watchdog.recovering()).toBe(true)
    clock.t += RECOVERY_RETRY_WINDOW_MS
    expect(watchdog.recovering()).toBe(false)
  })

  it('долгий опрос держится свои 30 с и ещё запас', () => {
    const { clock, watchdog, hang } = setup()
    hang(POLL)
    clock.t += 30_000 + HUNG_GRACE_MS
    expect(watchdog.check()).toBe('none')
    clock.t += 1
    expect(watchdog.check()).toBe('aborted')
  })

  it('в фоне, без сети или без клиента — не трогаем', () => {
    const { clock, env, watchdog, hang } = setup()
    hang()
    clock.t += HUNG_GRACE_MS * 2
    env.hidden = true
    expect(watchdog.check()).toBe('none')
    env.hidden = false
    env.offline = true
    expect(watchdog.check()).toBe('none')
    env.offline = false
    const bare = createSyncWatchdog({
      journal: setup().journal,
      client: () => null,
      hidden: () => false,
      offline: () => false,
    })
    expect(bare.check()).toBe('none')
    expect(watchdog.check()).toBe('aborted')
  })

  it('не чаще раза в минуту: второй зависший ждёт паузы', () => {
    const { clock, watchdog, hang } = setup()
    hang()
    hang()
    clock.t += HUNG_GRACE_MS + 1
    expect(watchdog.check()).toBe('aborted')
    expect(watchdog.check()).toBe('none')
    clock.t += RECOVERY_GAP_MS - 1
    expect(watchdog.check()).toBe('none')
    clock.t += 1
    expect(watchdog.check()).toBe('aborted')
  })
})

describe('«Обновляю…» без запросов в пути', () => {
  it('PREPARED дольше минуты — будим SDK', () => {
    const { clock, journal, client, watchdog } = setup()
    journal.noteState('PREPARED', null)
    clock.t += STUCK_MS
    expect(watchdog.check()).toBe('none')
    clock.t += 1
    expect(watchdog.check()).toBe('nudged')
    expect(client.retryImmediately).toHaveBeenCalledTimes(1)
    expect(journal.report().journal.slice(-1)[0]).toMatchObject({
      ev: 'recovery',
      reason: 'stuck',
      waitedS: 60,
    })
    // Будить — не значит перезапускать запрос: окно повтора не открывается.
    expect(watchdog.recovering()).toBe(false)
  })

  it('CATCHUP так же; SYNCING и RECONNECTING — нет (там свои механизмы)', () => {
    for (const [state, action] of [
      ['CATCHUP', 'nudged'],
      ['SYNCING', 'none'],
      ['RECONNECTING', 'none'],
    ] as const) {
      const { clock, journal, watchdog } = setup()
      journal.noteState(state, null)
      clock.t += STUCK_MS + 1
      expect(watchdog.check()).toBe(action)
    }
  })

  it('запрос в пути (ещё не завис) или ответ на разборе — ждём', async () => {
    const { clock, journal, watchdog, hang } = setup()
    journal.noteState('PREPARED', null)
    clock.t += STUCK_MS - 10_000
    hang()
    clock.t += 20_000
    expect(watchdog.check()).toBe('none')

    const busy = setup()
    busy.journal.noteState('PREPARED', null)
    await busy.journal.wrapFetch(vi.fn(async () => new Response('{}')))(CATCH_UP)
    busy.clock.t += STUCK_MS * 3
    expect(busy.watchdog.check()).toBe('none')
  })
})

describe('таймер', () => {
  it('start проверяет раз в CHECK_MS, stop останавливает; повторный start — один таймер', () => {
    vi.useFakeTimers()
    const { clock, journal, client, watchdog } = setup()
    journal.noteState('PREPARED', null)
    clock.t += STUCK_MS + 1
    watchdog.start()
    watchdog.start()
    vi.advanceTimersByTime(CHECK_MS)
    expect(client.retryImmediately).toHaveBeenCalledTimes(1)
    watchdog.stop()
    clock.t += RECOVERY_GAP_MS * 2
    vi.advanceTimersByTime(CHECK_MS * 3)
    expect(client.retryImmediately).toHaveBeenCalledTimes(1)
  })
})
