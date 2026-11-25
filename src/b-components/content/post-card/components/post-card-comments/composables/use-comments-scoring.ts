/**
 * Голосование за комментарии поста: общее — use-comment-voting, здесь ещё
 * последний комментарий (превью под постом в ленте).
 */

import { computed, type Ref } from 'vue'
import { haptic } from '@/helpers/common/haptics'
import type { PostForComments } from '../types'
import {
  scoresWithMyVote,
  useCommentVoting,
  type UseCommentVotingOptions,
} from './use-comment-voting'

export interface UseCommentsScoringOptions extends UseCommentVotingOptions {
  post: PostForComments | Ref<PostForComments>
}

export function useCommentsScoring(opts: UseCommentsScoringOptions) {
  const voting = useCommentVoting(opts)
  const { commentScoreSubmitting, myVote, submitScore, ensureCanScore } = voting

  const getPost = (): PostForComments => {
    const p = opts.post
    return 'value' in (p as Ref<PostForComments>)
      ? (p as Ref<PostForComments>).value
      : (p as PostForComments)
  }

  // --- Computed flags для lastComment ---
  const lastCommentUserLiked = computed(() => {
    const lc = getPost().lastComment
    return (lc?.myScore ?? 0) > 0 || myVote(lc?.id) === 1
  })
  const lastCommentUserDisliked = computed(() => {
    const lc = getPost().lastComment
    return (lc?.myScore ?? 0) < 0 || myVote(lc?.id) === -1
  })
  /** Счётчики последнего комментария со своей оценкой. */
  const lastCommentScores = computed(() => {
    const lc = getPost().lastComment
    return scoresWithMyVote(lc, myVote(lc?.id))
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

  // --- Голосование за lastComment ---
  const onLastCommentScoreUp = async (): Promise<void> => {
    if (!lastCommentCanClickLike.value || commentScoreSubmitting.value) return
    const lc = getPost().lastComment
    if (!lc?.id || !lc.address) return
    if (!(await ensureCanScore(1))) return
    haptic('small')
    commentScoreSubmitting.value = 'last'
    try {
      await submitScore({ id: lc.id, address: lc.address }, 1, 'commentsMsg.likeError')
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
    try {
      await submitScore({ id: lc.id, address: lc.address }, -1, 'commentsMsg.dislikeError')
    } finally {
      commentScoreSubmitting.value = null
    }
  }

  return {
    ...voting,
    lastCommentUserLiked,
    lastCommentUserDisliked,
    lastCommentCanClickLike,
    lastCommentCanClickDislike,
    lastCommentScores,
    onLastCommentScoreUp,
    onLastCommentScoreDown,
  }
}
