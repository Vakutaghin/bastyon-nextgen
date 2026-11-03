import { beforeEach, describe, expect, it, vi } from 'vitest'

// Нода — стаб: на каждый запрос ленты по дате отвечает следующим из очереди.
const mocks = vi.hoisted(() => ({
  strip: vi.fn(),
  tags: vi.fn(),
}))

vi.mock('./feed-queries', () => ({ buildHistoricalStripQuery: mocks.strip }))
vi.mock('@/helpers/api/request', () => ({ rpcCallArray: mocks.tags }))

import {
  SparseLanguageTimeout,
  fetchDatePage,
  isSparseFeed,
  resetDateFeedForTests,
} from './date-feed'
import type { FeedQueryContext } from './feed-queries'

const timeout = {
  httpStatus: 500,
  error: { message: '{"code":408,"message":"GetHistoricalFeed: sql request timeout"}' },
}
const page = (...txids: string[]) => ({ data: { contents: txids.map((txid) => ({ txid })) } })

function ctx(over: Partial<FeedQueryContext> = {}): FeedQueryContext {
  return {
    currentTxid: '',
    count: 20,
    lang: 'it',
    allTags: [],
    contentTypes: [],
    userAddress: '',
    topFirst: false,
    depth: 0,
    ...over,
  }
}

beforeEach(() => {
  localStorage.clear()
  resetDateFeedForTests()
  mocks.strip.mockReset()
  mocks.tags.mockReset()
  mocks.tags.mockResolvedValue([
    { tag: 'Politica', count: 596 },
    { tag: 'scienza', count: 292 },
  ])
})

describe('лента по дате', () => {
  it('обычный язык — страница целиком, у одной ноды', async () => {
    mocks.strip.mockResolvedValueOnce(page('a', 'b'))
    await expect(fetchDatePage(ctx({ lang: 'ru' }))).resolves.toEqual({
      response: page('a', 'b'),
      requested: 20,
    })
    // Не успела — вторую ноду не ждём: у редкого языка свой путь.
    expect(mocks.strip).toHaveBeenCalledWith(expect.objectContaining({ count: 20 }), 1)
    expect(isSparseFeed(ctx({ lang: 'ru' }))).toBe(false)
  })

  it('редкий язык: страница не собралась — по одному посту, и дальше сразу так', async () => {
    mocks.strip.mockRejectedValueOnce(timeout).mockResolvedValueOnce(page('x'))
    await expect(fetchDatePage(ctx())).resolves.toEqual({ response: page('x'), requested: 1 })
    expect(mocks.strip.mock.calls.map(([c]) => c.count)).toEqual([20, 1])
    expect(isSparseFeed(ctx())).toBe(true)

    mocks.strip.mockClear()
    mocks.strip.mockResolvedValueOnce(page('y'))
    await fetchDatePage(ctx({ currentTxid: 'x' }))
    expect(mocks.strip.mock.calls.map(([c]) => c.count)).toEqual([1])

    // После перезапуска помнит: лишних 10 секунд на пробу нет.
    resetDateFeedForTests()
    expect(isSparseFeed(ctx())).toBe(true)
  })

  it('редкость — у языка вместе с типом постов: русские видео не замедляют русскую ленту', async () => {
    mocks.strip.mockRejectedValueOnce(timeout).mockResolvedValueOnce(page('v'))
    await fetchDatePage(ctx({ lang: 'ru', contentTypes: ['video'] }))
    expect(isSparseFeed(ctx({ lang: 'ru', contentTypes: ['video'] }))).toBe(true)
    expect(isSparseFeed(ctx({ lang: 'ru' }))).toBe(false)
  })

  it('долгий перерыв: следующий пост — прыжком по ходовым тегам языка', async () => {
    mocks.strip
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(page('after-break'))
    await expect(fetchDatePage(ctx({ currentTxid: 'c' }))).resolves.toEqual({
      response: page('after-break'),
      requested: 1,
    })
    expect(mocks.tags.mock.lastCall![0].parameters).toEqual(['', '50', '', 'it'])
    expect(mocks.strip.mock.lastCall![0]).toMatchObject({
      currentTxid: 'c',
      count: 1,
      allTags: ['politica', 'scienza'],
    })
  })

  it('и прыжком не нашлось — так и говорим: «постов нет» в начале, «дальше перерыв» — после', async () => {
    mocks.strip
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(page())
    const first = await fetchDatePage(ctx()).catch((e: unknown) => e)
    expect(first).toBeInstanceOf(SparseLanguageTimeout)
    expect((first as SparseLanguageTimeout).first).toBe(true)

    mocks.strip.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout)
    const later = await fetchDatePage(ctx({ currentTxid: 'c' })).catch((e: unknown) => e)
    expect((later as SparseLanguageTimeout).first).toBe(false)
  })

  it('проверка «есть ли новое» через перерыв не прыгает: за ним старые посты', async () => {
    mocks.strip.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout)
    await expect(fetchDatePage(ctx(), { jump: false })).rejects.toBeInstanceOf(
      SparseLanguageTimeout
    )
    expect(mocks.tags).not.toHaveBeenCalled()
  })

  it('теги в фильтре нода и так ищет по индексу: прыжок их не подменяет', async () => {
    mocks.strip.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout)
    await expect(fetchDatePage(ctx({ allTags: ['caffe'] }))).rejects.toBeInstanceOf(
      SparseLanguageTimeout
    )
    expect(mocks.strip).toHaveBeenCalledTimes(2)
    expect(mocks.tags).not.toHaveBeenCalled()
  })

  it('другая ошибка — обычная ошибка ленты, язык редким не считается', async () => {
    mocks.strip.mockRejectedValueOnce(new Error('node down'))
    await expect(fetchDatePage(ctx())).rejects.toThrow('node down')
    expect(isSparseFeed(ctx())).toBe(false)
  })

  it('через неделю язык снова пробуют целой страницей', async () => {
    const week = 7 * 24 * 60 * 60 * 1000
    localStorage.setItem(
      'feed-sparse-languages',
      JSON.stringify({
        [JSON.stringify(['it', [], []])]: Date.now() - week - 1,
        [JSON.stringify(['sr', [], []])]: Date.now() - 1000,
      })
    )
    expect(isSparseFeed(ctx())).toBe(false)
    expect(isSparseFeed(ctx({ lang: 'sr' }))).toBe(true)
  })
})
