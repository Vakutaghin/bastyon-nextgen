/**
 * Голосование за комментарии: лайк/дизлайк lastComment и обычных комментариев.
 * Включает гард `ensureCanScore` (лимит/репутация, scam-warning при дизлайке).
 *
 * Локальный optimistic state (`commentVotes`, `lastCommentVote`) откатывается
 * при ошибке RPC. `commentScoreSubmitting` — id текущего pending-голоса для блокировки UI.
 */

import { ref, computed, h, type Ref, type ComputedRef } from 'vue'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import { haptic } from '@/helpers/common/haptics'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { UserState } from '@/types/rpc-responses/user-state'
import { sendCommentScore } from '../comment-scoring'
import {
  getCommentScoringDisableReason,
  shouldShowScamWarningOnDislike,
  type DisableReason,
} from '../visibility'
import type { PostForComments } from '../types'

export interface UseCommentsScoringOptions {
  post: PostForComments | Ref<PostForComments>
  isUserAuthenticated: ComputedRef<boolean>
  currentUserStateData: ComputedRef<UserState | null>
}

export function useCommentsScoring(opts: UseCommentsScoringOptions) {
  const lastCommentVote = ref<'up' | 'down' | null>(null)
  const commentVotes = ref<Record<string, 'up' | 'down'>>({})
  const commentScoreSubmitting = ref<string | null>(null)

  const getPost = (): PostForComments => {
    const p = opts.post
    return 'value' in (p as Ref<PostForComments>)
      ? (p as Ref<PostForComments>).value
      : (p as PostForComments)
  }

  /** Причина запрета оценок (или null если можно) */
  const scoringDisableReason = computed<DisableReason | null>(() =>
    getCommentScoringDisableReason(opts.isUserAuthenticated.value, opts.currentUserStateData.value)
  )

  /**
   * Гард перед голосованием: проверяет лимит/репутацию и для дизлайка
   * запрашивает подтверждение если сработала эвристика scam-риска.
   */
  const ensureCanScore = async (value: 1 | -1): Promise<boolean> => {
    const reason = scoringDisableReason.value
    if (reason) {
      appToast.error({ message: reason.message })
      return false
    }
    if (value < 0 && shouldShowScamWarningOnDislike(opts.currentUserStateData.value)) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: 'Поставить дизлайк?',
          icon: h(ExclamationCircleOutlined),
          content:
            'Слишком много дизлайков может негативно сказаться на вашей репутации. Продолжить?',
          okText: 'Поставить дизлайк',
          okType: 'danger',
          cancelText: 'Отмена',
          centered: true,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return false
    }
    return true
  }

  // --- Computed flags для lastComment ---
  const lastCommentUserLiked = computed(() => {
    const lc = getPost().lastComment
    return (lc?.myScore ?? 0) > 0 || lastCommentVote.value === 'up'
  })
  const lastCommentUserDisliked = computed(() => {
    const lc = getPost().lastComment
    return (lc?.myScore ?? 0) < 0 || lastCommentVote.value === 'down'
  })
  const lastCommentCanClickLike = computed(
    () =>
      !lastCommentUserDisliked.value &&
      !lastCommentUserLiked.value &&
      commentScoreSubmitting.value !== 'last'
  )
  const lastCommentCanClickDislike = computed(
    () =>
      !lastCommentUserLiked.value &&
      !lastCommentUserDisliked.value &&
      commentScoreSubmitting.value !== 'last'
  )

  // --- Per-comment проверки ---
  const isCommentLiked = (comment: GetComment): boolean =>
    (comment.myScore ?? 0) > 0 || commentVotes.value[comment.id] === 'up'
  const isCommentDisliked = (comment: GetComment): boolean =>
    (comment.myScore ?? 0) < 0 || commentVotes.value[comment.id] === 'down'
  const commentCanClickLike = (comment: GetComment): boolean =>
    !isCommentDisliked(comment) &&
    !isCommentLiked(comment) &&
    commentScoreSubmitting.value !== comment.id
  const commentCanClickDislike = (comment: GetComment): boolean =>
    !isCommentLiked(comment) &&
    !isCommentDisliked(comment) &&
    commentScoreSubmitting.value !== comment.id

  // --- Голосование за lastComment ---
  const onLastCommentScoreUp = async (): Promise<void> => {
    if (!lastCommentCanClickLike.value || commentScoreSubmitting.value) return
    const lc = getPost().lastComment
    if (!lc?.id || !lc.address) return
    if (!(await ensureCanScore(1))) return
    haptic('small')
    commentScoreSubmitting.value = 'last'
    const prev = lastCommentVote.value
    lastCommentVote.value = 'up'
    try {
      await sendCommentScore(lc.id, 1, lc.address)
    } catch (e) {
      lastCommentVote.value = prev
      appToast.error({
        message: e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию',
      })
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  const onLastCommentScoreDown = async (): Promise<void> => {
    if (!lastCommentCanClickDislike.value || commentScoreSubmitting.value) return
    const lc = getPost().lastComment
    if (!lc?.id || !lc.address) return
    if (!(await ensureCanScore(-1))) return
    haptic('small')
    commentScoreSubmitting.value = 'last'
    const prev = lastCommentVote.value
    lastCommentVote.value = 'down'
    try {
      await sendCommentScore(lc.id, -1, lc.address)
    } catch (e) {
      lastCommentVote.value = prev
      appToast.error({
        message: e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию',
      })
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  // --- Голосование за обычные комменты ---
  const onCommentScoreUp = async (comment: GetComment): Promise<void> => {
    if (!commentCanClickLike(comment) || commentScoreSubmitting.value) return
    if (!(await ensureCanScore(1))) return
    haptic('small')
    commentScoreSubmitting.value = comment.id
    const prev = commentVotes.value[comment.id]
    commentVotes.value = { ...commentVotes.value, [comment.id]: 'up' }
    try {
      await sendCommentScore(comment.id, 1, comment.address)
    } catch (e) {
      const next = prev ? { [comment.id]: prev } : {}
      const rest = { ...commentVotes.value }
      delete rest[comment.id]
      commentVotes.value = { ...rest, ...next }
      appToast.error({
        message: e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию',
      })
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  const onCommentScoreDown = async (comment: GetComment): Promise<void> => {
    if (!commentCanClickDislike(comment) || commentScoreSubmitting.value) return
    if (!(await ensureCanScore(-1))) return
    haptic('small')
    commentScoreSubmitting.value = comment.id
    const prev = commentVotes.value[comment.id]
    commentVotes.value = { ...commentVotes.value, [comment.id]: 'down' }
    try {
      await sendCommentScore(comment.id, -1, comment.address)
    } catch (e) {
      const next = prev ? { [comment.id]: prev } : {}
      const rest = { ...commentVotes.value }
      delete rest[comment.id]
      commentVotes.value = { ...rest, ...next }
      appToast.error({
        message: e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию',
      })
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  return {
    lastCommentVote,
    commentVotes,
    commentScoreSubmitting,
    scoringDisableReason,
    ensureCanScore,
    lastCommentUserLiked,
    lastCommentUserDisliked,
    lastCommentCanClickLike,
    lastCommentCanClickDislike,
    isCommentLiked,
    isCommentDisliked,
    commentCanClickLike,
    commentCanClickDislike,
    onLastCommentScoreUp,
    onLastCommentScoreDown,
    onCommentScoreUp,
    onCommentScoreDown,
  }
}
