// Оценка ждёт пять секунд, прежде чем уйти в сеть: её можно поменять или
// отменить. Сворачивание мобильного приложения, закрытое окно, другая вкладка
// и смена аккаунта её не теряют и не отправляют дважды.

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  address: 'PMe' as string | null,
  sendUpvote: vi.fn(),
  add: vi.fn(),
  markSubmitted: vi.fn(),
  markFailed: vi.fn(),
  classify: vi.fn(),
  handleVoteError: vi.fn(),
  native: false,
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({
    get getUserAddress() {
      return mocks.address
    },
  }),
}))
vi.mock('@/stores/pending-ratings-store', () => ({
  usePendingRatingsStore: () => ({
    add: mocks.add,
    markSubmitted: mocks.markSubmitted,
    markFailed: mocks.markFailed,
  }),
}))
vi.mock(
  '@/b-components/content/post-card/components/star-rating/helpers/star-rating-transaction',
  () => ({ sendUpvoteTransaction: mocks.sendUpvote })
)
vi.mock(
  '@/b-components/content/post-card/components/star-rating/helpers/star-rating-errors',
  () => ({ classifyVoteError: mocks.classify, handleVoteError: mocks.handleVoteError })
)

import { HELD_RATINGS_PREFIX } from '@/blockchain/constants/storage'
import { resetAppForegroundForTests, setAppActiveForTests } from '@/helpers/common/app-foreground'
import { RATING_HOLD_MS, useHeldRatingsStore } from './held-ratings-store'

const KEY = `${HELD_RATINGS_PREFIX}PMe`
const NOW = new Date('2026-11-25T12:00:00Z')
const stored = (): Array<{ shareId: string; value: number; sendingAt?: number }> =>
  JSON.parse(localStorage.getItem(KEY) ?? '[]')

const rating = (value: number, shareId = 'post1') => ({
  shareId,
  value,
  author: 'PAuthor',
  title: 'Поездка на море',
})

/** Новый запуск приложения: память чистая, записанное на устройстве на месте. */
function restart() {
  setActivePinia(createPinia())
  return useHeldRatingsStore()
}

describe('held-ratings-store', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW })
    localStorage.clear()
    mocks.address = 'PMe'
    mocks.native = false
    for (const fn of [mocks.add, mocks.markSubmitted, mocks.markFailed, mocks.handleVoteError])
      fn.mockReset()
    mocks.sendUpvote.mockReset().mockResolvedValue('tx-vote')
    mocks.classify.mockReset().mockReturnValue({ isNetworkFailed: false })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setActivePinia(createPinia())
  })
  afterEach(() => {
    useHeldRatingsStore().reset()
    resetAppForegroundForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('уходит через пять секунд, до того — отсчёт и ничего в сети', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    expect(store.heldValue('post1')).toBe(4)
    expect(store.secondsLeft('post1')).toBe(5)
    await vi.advanceTimersByTimeAsync(3_500)
    expect(store.secondsLeft('post1')).toBe(2)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_500)
    expect(mocks.add).toHaveBeenCalledWith('post1', 4, 10 * 60 * 1000, 'Поездка на море')
    expect(mocks.sendUpvote).toHaveBeenCalledWith('post1', 4, 'PAuthor')
    expect(mocks.markSubmitted).toHaveBeenCalledWith('post1', 'tx-vote')
    expect(store.heldValue('post1')).toBeNull()
    expect(store.sentValue('post1')).toBe(4)
    expect(store.secondsLeft('post1')).toBe(0)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('другая звезда меняет оценку и начинает отсчёт заново — уходит одна', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    await vi.advanceTimersByTimeAsync(4_000)
    store.hold(rating(5))
    expect(store.secondsLeft('post1')).toBe(5)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(mocks.sendUpvote.mock.calls).toEqual([['post1', 5, 'PAuthor']])
  })

  it('отмена: в сеть ничего, на устройстве ничего', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(1))
    store.cancel('post1')
    expect(store.heldValue('post1')).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
  })

  it('оценки разных постов ждут каждая своё', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(4, 'post1'))
    await vi.advanceTimersByTimeAsync(2_000)
    store.hold(rating(5, 'post2'))
    store.cancel('post1')
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote.mock.calls).toEqual([['post2', 5, 'PAuthor']])
  })

  it('отказ ноды: оценка снята, причина показана', async () => {
    const error = new Error('SelfScore')
    mocks.sendUpvote.mockRejectedValue(error)
    const reason = { isNetworkFailed: false, isSelfScore: true }
    mocks.classify.mockReturnValue(reason)
    const store = useHeldRatingsStore()
    store.hold(rating(5))
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(store.sentValue('post1')).toBeNull()
    expect(mocks.markFailed).toHaveBeenCalledWith('post1', 'SelfScore')
    expect(mocks.handleVoteError).toHaveBeenCalledWith(reason, expect.any(Function))
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('нет сети, а человек у звёзд — говорим и не копим', async () => {
    mocks.sendUpvote.mockRejectedValue(new Error('All RPC servers failed'))
    mocks.classify.mockReturnValue({ isNetworkFailed: true })
    const store = useHeldRatingsStore()
    store.hold(rating(5))
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.handleVoteError).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('мобильное приложение свернули — уходит сразу; без сети догонит при возвращении', async () => {
    mocks.native = true
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    mocks.sendUpvote.mockRejectedValueOnce(new Error('network'))
    mocks.classify.mockReturnValue({ isNetworkFailed: true })
    setAppActiveForTests(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
    expect(mocks.handleVoteError).not.toHaveBeenCalled()
    expect(stored()).toMatchObject([{ shareId: 'post1', value: 4 }])
    expect(stored()[0]!.sendingAt).toBeUndefined()

    await vi.advanceTimersByTimeAsync(60_000)
    setAppActiveForTests(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(2)
    expect(store.sentValue('post1')).toBe(4)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('на компьютере скрытое окно отсчёт не обрывает', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    setAppActiveForTests(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    expect(store.heldValue('post1')).toBe(4)
  })

  it('окно закрыли и сразу открыли — отсчёт продолжается', async () => {
    const before = useHeldRatingsStore()
    before.hold(rating(4))
    await vi.advanceTimersByTimeAsync(2_000)
    before.reset()
    const after = restart()
    after.init()
    expect(after.heldValue('post1')).toBe(4)
    expect(after.secondsLeft('post1')).toBe(3)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('открыли позже — уходит при запуске; отказ ноды молчит', async () => {
    const before = useHeldRatingsStore()
    before.hold(rating(4))
    before.reset()
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    mocks.sendUpvote.mockRejectedValue(new Error('DoubleScore'))
    restart().init()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sendUpvote).toHaveBeenCalledWith('post1', 4, 'PAuthor')
    expect(mocks.handleVoteError).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('прошло больше трёх суток — забываем', async () => {
    const before = useHeldRatingsStore()
    before.hold(rating(4))
    before.reset()
    await vi.advanceTimersByTimeAsync(4 * 24 * 60 * 60_000)
    const after = restart()
    after.init()
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('часы перевели назад — дольше обычного не ждёт', async () => {
    const before = useHeldRatingsStore()
    before.hold(rating(4))
    before.reset()
    vi.setSystemTime(NOW.getTime() - 60 * 60_000)
    const after = restart()
    after.init()
    expect(after.secondsLeft('post1')).toBe(5)
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('другая вкладка: оценка уходит один раз, отменённая там — не уходит', async () => {
    const one = useHeldRatingsStore()
    one.hold(rating(4, 'post1'))
    one.hold(rating(5, 'post2'))
    const two = restart()
    two.init()
    expect(two.heldValue('post1')).toBe(4)
    two.cancel('post2')
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote.mock.calls).toEqual([['post1', 4, 'PAuthor']])
    one.reset()
  })

  it('другая вкладка уже отправляет — вторая не начинает', async () => {
    mocks.sendUpvote.mockReturnValue(new Promise(() => {}))
    const one = useHeldRatingsStore()
    one.hold(rating(4))
    const two = restart()
    two.init()
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
    one.reset()
  })

  it('свернули, оценка ещё уходит, вернулись — отменить её уже не предлагаем', async () => {
    mocks.native = true
    mocks.sendUpvote.mockReturnValue(new Promise(() => {}))
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    setAppActiveForTests(false)
    await vi.advanceTimersByTimeAsync(500)
    setAppActiveForTests(true)
    expect(store.heldValue('post1')).toBeNull()
    expect(store.sentValue('post1')).toBe(4)
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('отправку начали и не закончили — повторяется через две минуты, не раньше', async () => {
    mocks.sendUpvote.mockReturnValue(new Promise(() => {}))
    const before = useHeldRatingsStore()
    before.hold(rating(4))
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(stored()[0]!.sendingAt).toBeTypeOf('number')
    before.reset()

    mocks.sendUpvote.mockReset().mockResolvedValue('tx-vote')
    restart().init()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    restart().init()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('аккаунт сменили — чужими ключами не уходит, ждёт своего', async () => {
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    mocks.address = 'POther'
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    expect(stored()).toMatchObject([{ shareId: 'post1', value: 4 }])

    store.reset()
    store.init()
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
    mocks.address = 'PMe'
    store.reset()
    store.init()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('испорченная запись на устройстве не мешает', () => {
    for (const raw of ['не json', '{}', '[null,{"shareId":1},{"shareId":"a","value":9}]']) {
      localStorage.setItem(KEY, raw)
      const store = restart()
      store.init()
      expect(store.items.size).toBe(0)
    }
  })

  it('хранилище недоступно — оценка всё равно уходит', async () => {
    const denied = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied, removeItem: denied })
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    await vi.advanceTimersByTimeAsync(RATING_HOLD_MS)
    vi.unstubAllGlobals()
    expect(mocks.sendUpvote).toHaveBeenCalledTimes(1)
  })

  it('гость: нечего ставить', () => {
    mocks.address = null
    const store = useHeldRatingsStore()
    store.hold(rating(4))
    store.init()
    expect(store.heldValue('post1')).toBeNull()
  })
})
