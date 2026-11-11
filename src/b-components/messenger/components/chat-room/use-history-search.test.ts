// Поиск глубже ленты: идёт, пока есть слова; копия на устройстве — один раз;
// история сервера — страницами до конца; «Стоп» и «Искать дальше»; сервер не
// отвечает — прерывается; чат закрыли — больше не листает.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Message } from '../../types'
import {
  SCAN_PAUSE_MS,
  SCAN_RETRIES,
  useHistorySearch,
  type HistoryPage,
} from './use-history-search'

const msg = (id: string, timestamp: number): Message => ({
  id,
  chatId: '!r',
  senderId: '@a',
  text: id,
  timestamp,
  read: true,
  status: 'sent',
})

function setup(pages: HistoryPage[], archive: Message[] = []) {
  const active = ref(false)
  const scan = vi.fn(
    async (): Promise<HistoryPage> => pages.shift() ?? { messages: [], exhausted: true }
  )
  const readArchive = vi.fn(async () => archive)
  const scope = effectScope()
  const api = scope.run(() =>
    useHistorySearch({ chatId: () => '!r', active: () => active.value, scan, readArchive })
  )!
  return { ...api, active, scan, readArchive, scope }
}

const settle = () => vi.advanceTimersByTimeAsync(SCAN_PAUSE_MS * 10)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useHistorySearch', () => {
  it('без слов поиска ничего не листает', async () => {
    const s = setup([{ messages: [msg('$a', 5)], exhausted: false }])
    await settle()
    expect(s.scan).not.toHaveBeenCalled()
    expect(s.readArchive).not.toHaveBeenCalled()
  })

  it('со словами — история страницами до конца и копия на устройстве', async () => {
    const s = setup(
      [
        { messages: [msg('$c', 30), msg('$b', 20)], exhausted: false },
        { messages: [msg('$a', 10)], exhausted: true },
      ],
      [msg('$old', 1)]
    )
    s.active.value = true
    await nextTick()
    await settle()
    expect(s.scan).toHaveBeenCalledTimes(2)
    expect(s.found.value.map((m) => m.id).sort()).toEqual(['$a', '$b', '$c', '$old'])
    expect(s.reached.value).toBe(10)
    expect(s.done.value).toBe(true)
    expect(s.scanning.value).toBe(false)
  })

  it('прочитанное держится: следующий запрос копию и историю не перечитывает', async () => {
    const s = setup([{ messages: [msg('$a', 10)], exhausted: true }], [msg('$old', 1)])
    s.active.value = true
    await nextTick()
    await settle()
    s.active.value = false
    await nextTick()
    s.active.value = true
    await nextTick()
    await settle()
    expect(s.scan).toHaveBeenCalledTimes(1)
    expect(s.readArchive).toHaveBeenCalledTimes(1)
  })

  it('поиск сбросили — листать перестаёт; снова слова — продолжает с того же места', async () => {
    const page = (id: string, ts: number): HistoryPage => ({
      messages: [msg(id, ts)],
      exhausted: false,
    })
    const s = setup([page('$3', 3), page('$2', 2), { messages: [msg('$1', 1)], exhausted: true }])
    s.active.value = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    s.active.value = false
    await settle()
    const calls = s.scan.mock.calls.length
    expect(s.done.value).toBe(false)
    s.active.value = true
    await nextTick()
    await settle()
    expect(s.scan.mock.calls.length).toBeGreaterThan(calls)
    expect(s.done.value).toBe(true)
  })

  it('«Стоп» — останавливается; «Искать дальше» — продолжает', async () => {
    const endless = Array.from({ length: 50 }, (_, i) => ({
      messages: [msg(`$${i}`, 1000 - i)],
      exhausted: false,
    }))
    const s = setup(endless)
    s.active.value = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    s.stop()
    await settle()
    const calls = s.scan.mock.calls.length
    await settle()
    expect(s.scan.mock.calls.length).toBe(calls)
    expect(s.stopped.value).toBe(true)
    s.resume()
    await vi.advanceTimersByTimeAsync(SCAN_PAUSE_MS * 3)
    expect(s.scan.mock.calls.length).toBeGreaterThan(calls)
    expect(s.stopped.value).toBe(false)
  })

  it(`${SCAN_RETRIES} страницы подряд не пришли — «сервер не отвечает», «Повторить» — заново`, async () => {
    const slow = Array.from({ length: SCAN_RETRIES }, () => ({
      messages: [],
      exhausted: false,
      slow: true,
    }))
    const s = setup([...slow, { messages: [msg('$a', 1)], exhausted: true }])
    s.active.value = true
    await nextTick()
    await settle()
    expect(s.failed.value).toBe(true)
    expect(s.scan).toHaveBeenCalledTimes(SCAN_RETRIES)
    s.resume()
    await settle()
    expect(s.failed.value).toBe(false)
    expect(s.done.value).toBe(true)
  })

  it('ошибка сервера — прерывается, а не крутится', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = setup([])
    s.scan.mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))
    s.active.value = true
    await nextTick()
    await settle()
    expect(s.failed.value).toBe(true)
    expect(s.scanning.value).toBe(false)
  })

  it('чат закрыли посреди страницы — пришедшее не берём и дальше не листаем', async () => {
    let finish: (page: HistoryPage) => void = () => {}
    const s = setup([])
    s.scan.mockImplementationOnce(() => new Promise<HistoryPage>((r) => (finish = r)))
    s.active.value = true
    await nextTick()
    s.scope.stop()
    finish({ messages: [msg('$late', 1)], exhausted: false })
    await settle()
    expect(s.found.value).toEqual([])
    expect(s.scan).toHaveBeenCalledTimes(1)
  })
})
