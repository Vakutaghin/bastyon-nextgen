/**
 * Лайк и дизлайк комментария — без привязки к посту: так оценивают и под
 * постом (use-comments-scoring), и прямо в списке уведомлений.
 * Гард `ensureCanScore` — лимит и репутация, предупреждение при дизлайке.
 *
 * Своя оценка видна сразу: отметка и +1 к счётчику. Нода отдаёт её (myScore,
 * scoreUp/scoreDown) только после блока, а до того её держат общие сторы —
 * comments-store на сессию и pending-transactions после перезапуска. Поэтому
 * отметка одна и та же в карточке поста, в списке, в окне поста и в
 * уведомлениях и не пропадает, когда карточку перерисовали. Ошибка отправки
 * отметку снимает. `commentScoreSubmitting` — id текущего pending-голоса для
 * блокировки UI.
 */

import { ref, computed, h, type ComputedRef } from 'vue'
import Modal from '@/components/modal'
import { ExclamationCircleOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { haptic } from '@/helpers/common/haptics'
import type { UserState } from '@/types/rpc-responses/user-state'
import { useCommentsStore } from '@/stores/comments-store'
import { usePendingTransactionsStore } from '@/stores/pending-transactions-store'
import { sendCommentScore } from '../comment-scoring'
import {
  getCommentScoringDisableReason,
  shouldShowScamWarningOnDislike,
  type DisableReason,
} from '../visibility'

export interface UseCommentVotingOptions {
  isUserAuthenticated: ComputedRef<boolean>
  currentUserStateData: ComputedRef<UserState | null>
  currentUserAddress: ComputedRef<string>
}

/** Что нужно знать о комментарии, чтобы его оценить. */
export interface VotableComment {
  id: string
  address: string
  myScore?: number
  scoreUp?: number
  scoreDown?: number
}

/**
 * Счётчики с учётом своей оценки, которую нода ещё не посчитала: пока myScore
 * пуст, её нет и в scoreUp/scoreDown.
 */
export function scoresWithMyVote(
  comment: { myScore?: number; scoreUp?: number; scoreDown?: number } | null | undefined,
  vote: 1 | -1 | null
): { up: number; down: number } {
  const up = Number(comment?.scoreUp) || 0
  const down = Number(comment?.scoreDown) || 0
  if (!vote || (comment?.myScore ?? 0) !== 0) return { up, down }
  return vote > 0 ? { up: up + 1, down } : { up, down: down + 1 }
}

export function useCommentVoting(opts: UseCommentVotingOptions) {
  const commentsStore = useCommentsStore()
  const pendingTransactions = usePendingTransactionsStore()
  const commentScoreSubmitting = ref<string | null>(null)

  /** Своя оценка, которую нода ещё могла не отдать: эта сессия, затем ожидание блока. */
  const myVote = (commentId: string | undefined): 1 | -1 | null => {
    if (!commentId) return null
    const address = opts.currentUserAddress.value
    return (
      (address ? commentsStore.myVoteOf(address, commentId) : null) ??
      pendingTransactions.commentScoreOf(commentId)
    )
  }

  /** Оценка видна сразу; ошибка отправки её снимает. */
  const submitScore = async (
    target: { id: string; address: string },
    value: 1 | -1,
    errorKey: string
  ): Promise<void> => {
    const address = opts.currentUserAddress.value
    if (address) commentsStore.setMyVote(address, target.id, value)
    try {
      const txid = await sendCommentScore(target.id, value, target.address)
      if (address) commentsStore.setMyVote(address, target.id, value, txid)
    } catch (e) {
      if (address) commentsStore.clearMyVote(address, target.id)
      appToast.error({ message: e instanceof Error ? e.message : t(errorKey) })
    }
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
          title: t('commentsMsg.dislikeConfirmTitle'),
          icon: h(ExclamationCircleOutlined),
          content: t('commentsMsg.dislikeConfirmContent'),
          okText: t('commentsMsg.dislikeConfirmOk'),
          danger: true,
          cancelText: t('commentsMsg.cancel'),
          centered: true,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return false
    }
    return true
  }

  // --- Per-comment проверки ---
  const isCommentLiked = (comment: VotableComment): boolean =>
    (comment.myScore ?? 0) > 0 || myVote(comment.id) === 1
  const isCommentDisliked = (comment: VotableComment): boolean =>
    (comment.myScore ?? 0) < 0 || myVote(comment.id) === -1
  /** Счётчики комментария со своей оценкой. */
  const commentScores = (comment: VotableComment): { up: number; down: number } =>
    scoresWithMyVote(comment, myVote(comment.id))
  const commentCanClickLike = (comment: VotableComment): boolean =>
    !isCommentDisliked(comment) &&
    !isCommentLiked(comment) &&
    commentScoreSubmitting.value !== comment.id
  const commentCanClickDislike = (comment: VotableComment): boolean =>
    !isCommentLiked(comment) &&
    !isCommentDisliked(comment) &&
    commentScoreSubmitting.value !== comment.id

  // --- Голосование ---
  const onCommentScoreUp = async (comment: VotableComment): Promise<void> => {
    if (!commentCanClickLike(comment) || commentScoreSubmitting.value) return
    if (!(await ensureCanScore(1))) return
    haptic('small')
    commentScoreSubmitting.value = comment.id
    try {
      await submitScore(comment, 1, 'commentsMsg.likeError')
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  const onCommentScoreDown = async (comment: VotableComment): Promise<void> => {
    if (!commentCanClickDislike(comment) || commentScoreSubmitting.value) return
    if (!(await ensureCanScore(-1))) return
    haptic('small')
    commentScoreSubmitting.value = comment.id
    try {
      await submitScore(comment, -1, 'commentsMsg.dislikeError')
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  return {
    commentScoreSubmitting,
    myVote,
    submitScore,
    scoringDisableReason,
    ensureCanScore,
    isCommentLiked,
    isCommentDisliked,
    commentScores,
    commentCanClickLike,
    commentCanClickDislike,
    onCommentScoreUp,
    onCommentScoreDown,
  }
}
