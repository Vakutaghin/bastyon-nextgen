// Лайк и дизлайк комментариев: запрет (гость, лимит, репутация) — тост без
// транзакции; дизлайк при признаках накрутки — только после подтверждения;
// оценка ставится сразу и откатывается, если сеть отказала; одна оценка
// на комментарий и одна транзакция за раз.

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

import type { PostForComments } from '../types'
import { useCommentsScoring } from './use-comments-scoring'

const comment = (overrides: Partial<GetComment> = {}) =>
  ({ id: 'c1', address: 'PAuthor', myScore: 0, ...overrides }) as GetComment

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

  it('отказ сети снимает оценку и показывает причину', async () => {
    mocks.sendCommentScore.mockRejectedValue(new Error('Лимит оценок исчерпан'))
    const { scoring } = setup()
    const c = comment()
    await scoring.onCommentScoreDown(c)
    expect(scoring.isCommentDisliked(c)).toBe(false)
    expect(scoring.commentVotes.value).toEqual({})
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
      expect(scoring.lastCommentVote.value).toBeNull()
      expect(scoring.lastCommentUserDisliked.value).toBe(false)
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
