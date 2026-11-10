import { test, expect } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Журнал синка чатов — в настоящем браузере: обёртка fetch клиента Matrix
 * отдаёт SDK ответ целиком (тело, код, заголовки), пишет размер и время, а
 * сторож обрывает зависший запрос, и обрыв доходит до сети. Сервер чатов
 * подменён (`page.route`), модуль берётся у dev-сервера.
 */

const SYNC = '/_matrix/client/v3/sync'

test('журнал синка: ответ доходит до SDK целиком, зависший запрос обрывается', async ({ page }) => {
  test.setTimeout(90_000)
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  let hung = 0
  await page.route(`**${SYNC}**`, async (route) => {
    if (route.request().url().includes('since=hang')) {
      // Не отвечаем: так висел первый синк после кэша.
      hung += 1
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'x-check': 'kept' },
      body: JSON.stringify({ next_batch: 's2', pad: 'x'.repeat(50 * 1024) }),
    })
  })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 60_000 })

  const result = await page.evaluate(async (sync) => {
    const mod = '/src/b-components/messenger/services/matrix-service/sync-journal.ts'
    const { createSyncJournal } = (await import(/* @vite-ignore */ mod)) as {
      createSyncJournal: (deps: { storage: null }) => {
        wrapFetch: (f: typeof fetch) => (input: string, init?: RequestInit) => Promise<Response>
        hungRequest: (t: number, grace: number) => { abort: () => void } | null
        report: () => { journal: Array<Record<string, unknown>> }
      }
    }
    const journal = createSyncJournal({ storage: null })
    const fetchFn = journal.wrapFetch(fetch.bind(window))

    const res = await fetchFn(`${sync}?since=s1&timeout=0`)
    const body = (await res.json()) as { next_batch: string }

    const pending = fetchFn(`${sync}?since=hang&timeout=0`)
    // Запрос дошёл до сети и висит.
    await new Promise((resolve) => setTimeout(resolve, 500))
    const victim = journal.hungRequest(Date.now() + 61_000, 60_000)
    victim?.abort()
    const outcome = await pending.then(
      () => 'answered',
      (e: Error) => e.name
    )
    return {
      status: res.status,
      header: res.headers.get('x-check'),
      nextBatch: body.next_batch,
      found: !!victim,
      outcome,
      journal: journal.report().journal,
    }
  }, SYNC)

  expect(result).toMatchObject({ status: 200, header: 'kept', nextBatch: 's2', found: true })
  expect(result.outcome).toBe('AbortError')
  expect(hung).toBe(1)
  expect(result.journal).toEqual([
    expect.objectContaining({ ev: 'request', kind: 'sync', mode: 'catch-up' }),
    expect.objectContaining({ ev: 'response', kind: 'sync', status: 200, kb: 50 }),
    expect.objectContaining({ ev: 'request', kind: 'sync', mode: 'catch-up' }),
    expect.objectContaining({ ev: 'error', kind: 'sync', byWatchdog: true }),
  ])
})
