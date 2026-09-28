// Звёзды под постом: оценка ставится один раз, сразу пересчитывает среднее
// и число оценивших, висит в pending-слое до подтверждения; свой пост,
// новичок, низкая репутация и 1–3 звезды без репутации 100 — отказ с
// понятным тостом (S18); гостю открывается окно входа; отказ сети
// откатывает оценку.

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
  pendingAdd: vi.fn(),
  markSubmitted: vi.fn(),
  markFailed: vi.fn(),
  openAuthModal: vi.fn(),
  triggerExplosion: vi.fn(),
  toastError: vi.fn(),
  sendUpvote: vi.fn(),
  classify: vi.fn(),
  handleVoteError: vi.fn(),
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
    add: (...args: unknown[]) => {
      mocks.pendingAdd(...args)
      mocks.pending[args[0] as string] = args[1] as number
    },
    markSubmitted: mocks.markSubmitted,
    markFailed: (id: string, message?: string) => {
      mocks.markFailed(id, message)
      delete mocks.pending[id]
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
vi.mock('./helpers/star-rating-transaction', () => ({ sendUpvoteTransaction: mocks.sendUpvote }))
vi.mock('./helpers/star-rating-errors', () => ({
  classifyVoteError: mocks.classify,
  handleVoteError: mocks.handleVoteError,
}))

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
    for (const fn of [
      mocks.pendingAdd,
      mocks.markSubmitted,
      mocks.markFailed,
      mocks.openAuthModal,
      mocks.triggerExplosion,
      mocks.toastError,
      mocks.handleVoteError,
    ])
      fn.mockReset()
    mocks.sendUpvote.mockReset().mockResolvedValue('tx-vote')
    mocks.classify.mockReset().mockReturnValue({ kind: 'network' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

  it('оценка: pending-слой, транзакция автору, пересчёт среднего и числа оценивших', async () => {
    const { rating, emit } = setup()
    await rating.handleStarClick(5, click())

    expect(mocks.pendingAdd).toHaveBeenCalledWith('post1', 5, 10 * 60 * 1000, 'Поездка на море')
    expect(mocks.sendUpvote).toHaveBeenCalledWith('post1', 5, 'PAuthor')
    expect(mocks.markSubmitted).toHaveBeenCalledWith('post1', 'tx-vote')
    expect(emit).toHaveBeenCalledWith('rating-change', 5)
    expect(mocks.triggerExplosion).toHaveBeenCalledWith(10, 20)

    expect(rating.hasVoted.value).toBe(true)
    expect(rating.optimisticVotersCount.value).toBe(3)
    expect(rating.optimisticAverageRating.value).toBe(4.3)
    expect(rating.displayRating.value).toBe(5)
  })

  it('повторно оценить нельзя: клик и наведение после оценки ничего не делают', async () => {
    const { rating } = setup({ userVote: 4 })
    expect(rating.hasVoted.value).toBe(true)
    expect(rating.displayRating.value).toBe(4)

    const event = click()
    const stop = vi.spyOn(event, 'stopPropagation')
    await rating.handleStarClick(2, event)
    rating.handleStarHover(1)
    expect(stop).toHaveBeenCalled()
    expect(rating.displayRating.value).toBe(4)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
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

  it('свой пост: тост, звёзды не отправляются (S18)', async () => {
    const { rating } = setup({ contentAuthorAddress: 'PMe' })
    expect(rating.isOwnPost.value).toBe(true)
    await rating.handleStarClick(5, click())
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'postCard.ratingOwnPost' })
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
  })

  it('гость: клик не гасится (откроется окно входа), транзакции нет', async () => {
    mocks.auth.isUserAuthenticated = false
    const { rating } = setup()
    const event = click()
    const stop = vi.spyOn(event, 'stopPropagation')
    await rating.handleStarClick(5, event)
    expect(stop).not.toHaveBeenCalled()
    expect(mocks.sendUpvote).not.toHaveBeenCalled()

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
  ])('%s: понятный тост и событие error, транзакции нет', async (_name, profile, stars, key) => {
    mocks.auth.userProfile = profile
    const { rating, emit } = setup()
    await rating.handleStarClick(stars, click())
    expect(mocks.toastError).toHaveBeenCalledWith({ message: key })
    expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
  })

  it('4 звезды без репутации 100 — можно', async () => {
    mocks.auth.userProfile = { regdate: Math.floor(Date.now() / 1000) - 30 * DAY, reputation: 0 }
    const { rating } = setup()
    await rating.handleStarClick(4, click())
    expect(mocks.sendUpvote).toHaveBeenCalledWith('post1', 4, 'PAuthor')
  })

  it('отказ сети: оценка снята, pending помечен ошибкой, причина — через handleVoteError', async () => {
    const error = new Error('SelfScore')
    mocks.sendUpvote.mockRejectedValue(error)
    const { rating, emit } = setup()
    await rating.handleStarClick(5, click())

    expect(rating.optimisticRating.value).toBeNull()
    expect(mocks.markFailed).toHaveBeenCalledWith('post1', 'SelfScore')
    expect(mocks.classify).toHaveBeenCalledWith(error)
    expect(mocks.handleVoteError).toHaveBeenCalledWith({ kind: 'network' }, emit)
    expect(rating.hasVoted.value).toBe(false)
    expect(rating.isSubmitting.value).toBe(false)
  })

  it('отключённые звёзды не реагируют', async () => {
    const { rating } = setup({ disabled: true })
    rating.handleStarHover(5)
    await rating.handleStarClick(5, click())
    expect(rating.displayRating.value).toBe(0)
    expect(mocks.sendUpvote).not.toHaveBeenCalled()
  })
})
