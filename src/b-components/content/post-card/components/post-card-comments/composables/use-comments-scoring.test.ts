// Лайк и дизлайк комментариев: запрет (гость, лимит, репутация) — тост без
// транзакции; дизлайк при признаках накрутки — только после подтверждения;
// оценка ставится сразу (отметка и +1) и откатывается, если сеть отказала;
// одна оценка на комментарий и одна транзакция за раз. Отметка общая для всех
// мест, где виден комментарий, и держится, пока нода не отдаст её сама.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { UserState } from '@/types/rpc-responses/user-state'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastError: vi.fn(),
  haptic: vi.fn(),
  sendCommentScore: vi.fn(),
}))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))
vi.mock('@/components/icons', () => ({ ExclamationCircleOutlined: {} }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/helpers/common/haptics', () => ({ haptic: mocks.haptic }))
vi.mock('../comment-scoring', () => ({ sendCommentScore: mocks.sendCommentScore }))

import { useCommentsStore } from '@/stores/comments-store'
import { usePendingTransactionsStore } from '@/stores/pending-transactions-store'
import type { PostForComments } from '../types'
import { scoresWithMyVote, useCommentsScoring } from './use-comments-scoring'

const comment = (overrides: Partial<GetComment> = {}) =>
  ({
    id: 'c1',
    address: 'PAuthor',
    myScore: 0,
    scoreUp: 4,
    scoreDown: 1,
    ...overrides,
  }) as GetComment

function setup(
  opts: { auth?: boolean; state?: Partial<UserState> | null; post?: PostForComments } = {}
) {
  const authenticated = ref(opts.auth ?? true)
  const userState = ref<UserState | null>(
    opts.state === undefined
      ? ({ comment_score_unspent: 10 } as UserState)
      : (opts.state as UserState)
  )
  const post = ref<PostForComments>(
    opts.post ??
      ({
        id: 'post1',
        lastComment: { id: 'lc1', address: 'PLast', authorName: 'x' },
      } as PostForComments)
  )
  const scoring = useCommentsScoring({
    post,
    isUserAuthenticated: computed(() => authenticated.value),
    currentUserStateData: computed(() => userState.value),
    currentUserAddress: computed(() => 'PMe'),
  })
  return { scoring, post, authenticated, userState }
}

function deferred() {
  let resolve!: (v: string) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useCommentsScoring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.confirm.mockReset()
    mocks.toastError.mockReset()
    mocks.haptic.mockReset()
    mocks.sendCommentScore.mockReset().mockResolvedValue('tx-score')
  })

  it('лайк: отмечен, пока транзакция в пути; cScore +1 автору комментария', async () => {
    const tx = deferred()
    mocks.sendCommentScore.mockReturnValueOnce(tx.promise)
    const { scoring } = setup()
    const c = comment()
    const pending = scoring.onCommentScoreUp(c)
    await vi.waitFor(() => expect(mocks.sendCommentScore).toHaveBeenCalled())
    expect(scoring.isCommentLiked(c)).toBe(true)
    expect(scoring.commentScoreSubmitting.value).toBe('c1')
    tx.resolve('tx-score')
    await pending
    expect(mocks.sendCommentScore).toHaveBeenCalledWith('c1', 1, 'PAuthor')
    expect(scoring.commentCanClickLike(c)).toBe(false)
    expect(scoring.commentCanClickDislike(c)).toBe(false)
    expect(scoring.commentScoreSubmitting.value).toBeNull()
  })

  it('+1 к счётчику сразу, пока нода не посчитала оценку', async () => {
    const tx = deferred()
    mocks.sendCommentScore.mockReturnValueOnce(tx.promise)
    const { scoring } = setup()
    const c = comment()
    const pending = scoring.onCommentScoreUp(c)
    await vi.waitFor(() => expect(mocks.sendCommentScore).toHaveBeenCalled())
    expect(scoring.commentScores(c)).toEqual({ up: 5, down: 1 })
    tx.resolve('tx-score')
    await pending
    expect(scoring.commentScores(c)).toEqual({ up: 5, down: 1 })
    // Блок: нода отдала myScore и уже посчитала оценку — второй раз не прибавляем.
    const fromNode = comment({ myScore: 1, scoreUp: 5 } as Partial<GetComment>)
    expect(scoring.commentScores(fromNode)).toEqual({ up: 5, down: 1 })
  })

  it('отметка общая: последний комментарий в карточке и он же в списке, и после перерисовки', async () => {
    const { scoring: list } = setup()
    await list.onCommentScoreUp(comment({ id: 'lc1', address: 'PLast' }))
    // Та же карточка заново (лента перерисовала) — отметка и +1 на месте.
    const { scoring: card } = setup({
      post: {
        id: 'post1',
        lastComment: { id: 'lc1', address: 'PLast', scoreUp: 2, scoreDown: 0, myScore: 0 },
      } as unknown as PostForComments,
    })
    expect(card.lastCommentUserLiked.value).toBe(true)
    expect(card.lastCommentScores.value).toEqual({ up: 3, down: 0 })
    expect(card.lastCommentCanClickLike.value).toBe(false)
  })

  it('после перезапуска отметку берёт из ожидающих блока транзакций', () => {
    const pending = usePendingTransactionsStore()
    pending.items = [
      { txid: 't1', kind: 'commentScore', createdAt: Date.now(), commentId: 'c1', score: -1 },
    ]
    const { scoring } = setup()
    const c = comment()
    expect(scoring.isCommentDisliked(c)).toBe(true)
    expect(scoring.commentScores(c)).toEqual({ up: 4, down: 2 })
    expect(scoring.commentCanClickLike(c)).toBe(false)
  })

  it('оценка не попала в блок — отметка снимается', async () => {
    const { scoring } = setup()
    const c = comment()
    await scoring.onCommentScoreUp(c)
    expect(scoring.isCommentLiked(c)).toBe(true)
    useCommentsStore().dropVoteByTx('tx-score')
    expect(scoring.isCommentLiked(c)).toBe(false)
    expect(scoring.commentScores(c)).toEqual({ up: 4, down: 1 })
  })

  it('отказ сети снимает оценку и показывает причину', async () => {
    mocks.sendCommentScore.mockRejectedValue(new Error('Лимит оценок исчерпан'))
    const { scoring } = setup()
    const c = comment()
    await scoring.onCommentScoreDown(c)
    expect(scoring.isCommentDisliked(c)).toBe(false)
    expect(scoring.commentScores(c)).toEqual({ up: 4, down: 1 })
    expect(useCommentsStore().myVotes).toEqual({})
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'Лимит оценок исчерпан' })
  })

  it.each([
    ['гость', { auth: false }, 'commentsMsg.disableLoginToVote'],
    ['лимит оценок', { state: { comment_score_unspent: 0 } }, 'commentsMsg.disableScoreLimit'],
    ['репутация', { state: { reputation: -100 } }, 'commentsMsg.disableRepScore'],
  ])('%s: тост с причиной, транзакции нет', async (_name, opts, message) => {
    const { scoring } = setup(opts as Parameters<typeof setup>[0])
    await scoring.onCommentScoreUp(comment())
    expect(mocks.toastError).toHaveBeenCalledWith({ message })
    expect(mocks.sendCommentScore).not.toHaveBeenCalled()
  })

  it('уже оценённый с ноды (myScore) нельзя оценить ещё раз', async () => {
    const { scoring } = setup()
    const liked = comment({ myScore: 1 } as Partial<GetComment>)
    expect(scoring.isCommentLiked(liked)).toBe(true)
    await scoring.onCommentScoreDown(liked)
    await scoring.onCommentScoreUp(liked)
    expect(mocks.sendCommentScore).not.toHaveBeenCalled()
  })

  it('пока одна оценка уходит, другие клики игнорируются', async () => {
    const first = deferred()
    mocks.sendCommentScore.mockReturnValueOnce(first.promise)
    const { scoring } = setup()
    const running = scoring.onCommentScoreUp(comment())
    await Promise.resolve()
    await scoring.onCommentScoreUp(comment({ id: 'c2' }))
    expect(mocks.sendCommentScore).toHaveBeenCalledTimes(1)
    first.resolve('tx')
    await running
  })

  describe('дизлайк при признаках накрутки', () => {
    const risky = { reputation: -1, comment_spent: 9, comment_unspent: 1, comment_score_unspent: 5 }

    it('«Отмена» — оценки нет', async () => {
      mocks.confirm.mockImplementation((o: { onCancel: () => void }) => o.onCancel())
      const { scoring } = setup({ state: risky })
      await scoring.onCommentScoreDown(comment())
      expect(mocks.confirm).toHaveBeenCalledTimes(1)
      expect(mocks.sendCommentScore).not.toHaveBeenCalled()
    })

    it('«ОК» — дизлайк уходит', async () => {
      mocks.confirm.mockImplementation((o: { onOk: () => void }) => o.onOk())
      const { scoring } = setup({ state: risky })
      await scoring.onCommentScoreDown(comment())
      expect(mocks.sendCommentScore).toHaveBeenCalledWith('c1', -1, 'PAuthor')
    })

    it('лайк без подтверждения', async () => {
      const { scoring } = setup({ state: risky })
      await scoring.onCommentScoreUp(comment())
      expect(mocks.confirm).not.toHaveBeenCalled()
      expect(mocks.sendCommentScore).toHaveBeenCalledTimes(1)
    })
  })

  describe('последний комментарий в карточке поста', () => {
    it('лайк уходит его автору, после — кнопки неактивны', async () => {
      const { scoring } = setup()
      await scoring.onLastCommentScoreUp()
      expect(mocks.sendCommentScore).toHaveBeenCalledWith('lc1', 1, 'PLast')
      expect(scoring.lastCommentUserLiked.value).toBe(true)
      expect(scoring.lastCommentCanClickDislike.value).toBe(false)
    })

    it('отказ сети возвращает прежнее состояние', async () => {
      mocks.sendCommentScore.mockRejectedValue(new Error('offline'))
      const { scoring } = setup()
      await scoring.onLastCommentScoreDown()
      expect(scoring.lastCommentUserDisliked.value).toBe(false)
      expect(scoring.lastCommentScores.value).toEqual({ up: 0, down: 0 })
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'offline' })
    })

    it('без id или адреса автора — ничего не отправляется', async () => {
      const { scoring } = setup({
        post: { id: 'post1', lastComment: { id: '', address: 'PLast' } } as PostForComments,
      })
      await scoring.onLastCommentScoreUp()
      expect(mocks.sendCommentScore).not.toHaveBeenCalled()
    })

    it('оценка с ноды учитывается', () => {
      const { scoring } = setup({
        post: {
          id: 'post1',
          lastComment: { id: 'lc1', address: 'PLast', myScore: -1 },
        } as unknown as PostForComments,
      })
      expect(scoring.lastCommentUserDisliked.value).toBe(true)
      expect(scoring.lastCommentCanClickLike.value).toBe(false)
    })
  })
})

describe('scoresWithMyVote', () => {
  it('прибавляет свою оценку, только пока нода её не отдала', () => {
    expect(scoresWithMyVote({ scoreUp: 2, scoreDown: 1, myScore: 0 }, 1)).toEqual({
      up: 3,
      down: 1,
    })
    expect(scoresWithMyVote({ scoreUp: 2, scoreDown: 1 }, -1)).toEqual({ up: 2, down: 2 })
    expect(scoresWithMyVote({ scoreUp: 3, scoreDown: 1, myScore: 1 }, 1)).toEqual({
      up: 3,
      down: 1,
    })
    expect(scoresWithMyVote({ scoreUp: 2, scoreDown: 1 }, null)).toEqual({ up: 2, down: 1 })
    expect(scoresWithMyVote(undefined, 1)).toEqual({ up: 1, down: 0 })
  })
})
