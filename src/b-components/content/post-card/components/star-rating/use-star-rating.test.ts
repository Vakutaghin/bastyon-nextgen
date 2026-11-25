// Звёзды под постом: выбранная оценка сразу пересчитывает среднее и число
// оценивших и ждёт отправки — её можно поменять или отменить; отправленная
// одна и навсегда, до подтверждения висит в pending-слое; свой пост, новичок,
// низкая репутация и 1–3 звезды без репутации 100 — отказ с понятным тостом
// (S18); гостю открывается окно входа. Сама отправка — held-ratings-store.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    getUserAddress: string | null
    isUserAuthenticated: boolean
    userProfile: { regdate?: number; reputation?: number } | null
  },
  posts: {} as Record<string, { myVal?: number; scoreSum?: number; scoreCnt?: number }>,
  pending: {} as Record<string, number>,
  held: {} as Record<string, number>,
  sent: {} as Record<string, number>,
  hold: vi.fn(),
  cancel: vi.fn(),
  openAuthModal: vi.fn(),
  triggerExplosion: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/modal-store', () => ({
  useModalStore: () => ({ openAuthModal: mocks.openAuthModal }),
}))
vi.mock('@/stores/posts-store', () => ({
  usePostsStore: () => ({ getPostByShareId: (id: string) => mocks.posts[id] }),
}))
vi.mock('@/stores/pending-ratings-store', () => ({
  usePendingRatingsStore: () => ({
    init: vi.fn(),
    getPendingValue: (id: string) => mocks.pending[id] ?? null,
  }),
}))
vi.mock('@/stores/held-ratings-store', () => ({
  useHeldRatingsStore: () => ({
    init: vi.fn(),
    heldValue: (id: string) => mocks.held[id] ?? null,
    sentValue: (id: string) => mocks.sent[id] ?? null,
    secondsLeft: (id: string) => (mocks.held[id] ? 4 : 0),
    hold: (item: { shareId: string; value: number }) => {
      mocks.hold(item)
      mocks.held[item.shareId] = item.value
    },
    cancel: (id: string) => {
      mocks.cancel(id)
      delete mocks.held[id]
    },
  }),
}))
vi.mock('@/stores/effects-store', () => ({
  useEffectsStore: () => ({ triggerExplosion: mocks.triggerExplosion }),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))
vi.mock('@/helpers/common/post-title-resolver', () => ({
  resolvePostTitleFromPost: () => ({ title: 'Поездка на море', usedContent: false }),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import type { StarRatingProps } from './types'
import { useStarRating } from './use-star-rating'

const DAY = 24 * 60 * 60

function setup(props: Partial<StarRatingProps> = {}) {
  const emit = vi.fn()
  const rating = useStarRating(
    reactive({
      rating: 4,
      votersCount: 2,
      scoreSum: 8,
      shareId: 'post1',
      contentAuthorAddress: 'PAuthor',
      ...props,
    }) as StarRatingProps,
    emit as never
  )
  return { rating, emit }
}

const click = (x = 10, y = 20) => new MouseEvent('click', { clientX: x, clientY: y })

describe('useStarRating', () => {
  beforeEach(() => {
    mocks.auth = reactive({
      getUserAddress: 'PMe',
      isUserAuthenticated: true,
      userProfile: { regdate: Math.floor(Date.now() / 1000) - 30 * DAY, reputation: 150 },
    })
    mocks.posts = {}
    mocks.pending = reactive({})
    mocks.held = reactive({})
    mocks.sent = reactive({})
    for (const fn of [
      mocks.hold,
      mocks.cancel,
      mocks.openAuthModal,
      mocks.triggerExplosion,
      mocks.toastError,
    ])
      fn.mockReset()
  })

  it('до оценки — средняя из пропсов; наведение подсвечивает звёзды', () => {
    const { rating } = setup()
    expect(rating.optimisticAverageRating.value).toBe(4)
    expect(rating.displayRating.value).toBe(0)
    rating.handleStarHover(3)
    expect(rating.displayRating.value).toBe(3)
    rating.handleStarLeave()
    expect(rating.displayRating.value).toBe(0)
  })

  it('оценка ждёт отправки: автор, заголовок, пересчёт среднего и числа оценивших', () => {
    const { rating } = setup()
    rating.handleStarHover(5)
    rating.handleStarClick(5, click())

    expect(mocks.hold).toHaveBeenCalledWith({
      shareId: 'post1',
      value: 5,
      author: 'PAuthor',
      title: 'Поездка на море',
    })
    expect(mocks.triggerExplosion).toHaveBeenCalledWith(10, 20)

    expect(rating.heldValue.value).toBe(5)
    expect(rating.holdSeconds.value).toBe(4)
    expect(rating.hasVoted.value).toBe(false)
    expect(rating.optimisticVotersCount.value).toBe(3)
    expect(rating.optimisticAverageRating.value).toBe(4.3)
    expect(rating.displayRating.value).toBe(5)
  })

  it('пока ждёт — другая звезда меняет оценку, та же ничего не делает', () => {
    const { rating } = setup()
    rating.handleStarClick(4, click())
    rating.handleStarClick(4, click())
    expect(mocks.hold).toHaveBeenCalledTimes(1)
    expect(mocks.triggerExplosion).toHaveBeenCalledTimes(1)
    rating.handleStarClick(5, click())
    expect(mocks.hold).toHaveBeenLastCalledWith(expect.objectContaining({ value: 5 }))
    expect(rating.displayRating.value).toBe(5)
  })

  it('отмена: звёзды пустые, хотя палец остался на звезде, числа прежние', () => {
    const { rating } = setup()
    rating.handleStarClick(4, click())
    rating.handleStarHover(4)
    rating.cancelHold()
    expect(mocks.cancel).toHaveBeenCalledWith('post1')
    expect(rating.displayRating.value).toBe(0)
    expect(rating.optimisticAverageRating.value).toBe(4)
    expect(rating.optimisticVotersCount.value).toBe(2)
    expect(rating.hasVoted.value).toBe(false)
  })

  it('отправленная в этом запуске видна, пока пост не обновился, и вторая не ставится', () => {
    mocks.sent.post1 = 4
    const { rating } = setup()
    expect(rating.hasVoted.value).toBe(true)
    expect(rating.submittedValue.value).toBe(4)
    expect(rating.displayRating.value).toBe(4)
    expect(rating.optimisticVotersCount.value).toBe(3)
    rating.handleStarClick(5, click())
    expect(mocks.hold).not.toHaveBeenCalled()
  })

  it('повторно оценить нельзя: клик и наведение после оценки ничего не делают', () => {
    const { rating } = setup({ userVote: 4 })
    expect(rating.hasVoted.value).toBe(true)
    expect(rating.displayRating.value).toBe(4)

    const event = click()
    const stop = vi.spyOn(event, 'stopPropagation')
    rating.handleStarClick(2, event)
    rating.handleStarHover(1)
    expect(stop).toHaveBeenCalled()
    expect(rating.displayRating.value).toBe(4)
    expect(mocks.hold).not.toHaveBeenCalled()
  })

  it('неподтверждённая оценка из pending-слоя тоже считается', () => {
    mocks.pending.post1 = 3
    const { rating } = setup()
    expect(rating.hasVoted.value).toBe(true)
    expect(rating.displayRating.value).toBe(3)
  })

  it('данные из стора постов важнее пропсов', () => {
    mocks.posts.post1 = { myVal: 2, scoreSum: 20, scoreCnt: 5 }
    const { rating } = setup()
    expect(rating.hasVoted.value).toBe(true)
    expect(rating.optimisticAverageRating.value).toBe(4)
    expect(rating.optimisticVotersCount.value).toBe(5)
  })

  it('свой пост: тост, звёзды не отправляются (S18)', () => {
    const { rating } = setup({ contentAuthorAddress: 'PMe' })
    expect(rating.isOwnPost.value).toBe(true)
    rating.handleStarClick(5, click())
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'postCard.ratingOwnPost' })
    expect(mocks.hold).not.toHaveBeenCalled()
  })

  it('гость: звёзды не закрашиваются, клик не гасится (откроется окно входа), транзакции нет', () => {
    mocks.auth.isUserAuthenticated = false
    const { rating } = setup()
    rating.handleStarHover(4)
    expect(rating.displayRating.value).toBe(0)
    const event = click()
    const stop = vi.spyOn(event, 'stopPropagation')
    rating.handleStarClick(5, event)
    expect(stop).not.toHaveBeenCalled()
    expect(mocks.hold).not.toHaveBeenCalled()

    rating.authPopoverVisible.value = true
    rating.openAuthModal()
    expect(rating.authPopoverVisible.value).toBe(false)
    expect(mocks.openAuthModal).toHaveBeenCalled()
  })

  it.each([
    [
      'аккаунту меньше суток',
      { regdate: Math.floor(Date.now() / 1000) - 3600, reputation: 500 },
      5,
      'postCard.ratingNewAccount',
    ],
    [
      'репутация -12 и ниже',
      { regdate: Math.floor(Date.now() / 1000) - 30 * DAY, reputation: -12 },
      5,
      'postCard.ratingLowReputation',
    ],
    [
      '1–3 звезды без репутации 100',
      { regdate: Math.floor(Date.now() / 1000) - 30 * DAY, reputation: 99 },
      3,
      'postCard.ratingLowStarsNeedReputation',
    ],
  ])('%s: понятный тост и событие error, транзакции нет', (_name, profile, stars, key) => {
    mocks.auth.userProfile = profile
    const { rating, emit } = setup()
    rating.handleStarClick(stars, click())
    expect(mocks.toastError).toHaveBeenCalledWith({ message: key })
    expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
    expect(mocks.hold).not.toHaveBeenCalled()
  })

  it('4 звезды без репутации 100 — можно', () => {
    mocks.auth.userProfile = { regdate: Math.floor(Date.now() / 1000) - 30 * DAY, reputation: 0 }
    const { rating } = setup()
    rating.handleStarClick(4, click())
    expect(mocks.hold).toHaveBeenCalledWith(expect.objectContaining({ value: 4 }))
  })

  it('отключённые звёзды не реагируют', () => {
    const { rating } = setup({ disabled: true })
    rating.handleStarHover(5)
    rating.handleStarClick(5, click())
    expect(rating.displayRating.value).toBe(0)
    expect(mocks.hold).not.toHaveBeenCalled()
  })
})
