import { ref, computed } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import { appToast } from '@/b-components/app-toast'
import { usePendingRatingsStore } from '@/stores/pending-ratings-store'
import { useEffectsStore } from '@/stores/effects-store'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import type { StarRatingProps, StarRatingEmits } from './types'
import {
  isNewUser,
  isReputationBlocked,
  isLowRatingBlocked,
} from './helpers/star-rating-validation'
import { sendUpvoteTransaction } from './helpers/star-rating-transaction'
import { classifyVoteError, handleVoteError } from './helpers/star-rating-errors'

// ── Composable ─────────────────────────────────────────────────────────

export function useStarRating(props: StarRatingProps, emit: StarRatingEmits) {
  // ── Reactive state ───────────────────────────────────────────────────
  const optimisticRating = ref<number | null>(null)
  const isSubmitting = ref(false)
  const hoveredStar = ref<number | null>(null)
  const authPopoverVisible = ref(false)

  // ── Stores ───────────────────────────────────────────────────────────
  const modalStore = useModalStore()
  const postsStore = usePostsStore()
  const effectsStore = useEffectsStore()
  const pendingStore = usePendingRatingsStore()
  pendingStore.init()

  // ── Auth helpers ─────────────────────────────────────────────────────
  const openAuthModal = () => {
    authPopoverVisible.value = false
    modalStore.openAuthModal()
  }

  // ── Confirmed post from store ────────────────────────────────────────
  const confirmedPost = computed(() => postsStore.getPostByShareId(props.shareId))

  // ── Effective values (store-first, fall back to props) ───────────────
  const effectiveUserVote = computed(() => confirmedPost.value?.myVal ?? props.userVote)
  const effectiveScoreSum = computed(() => confirmedPost.value?.scoreSum ?? props.scoreSum)
  const effectiveVotersCount = computed(() => confirmedPost.value?.scoreCnt ?? props.votersCount)

  // ── Pending / voted state ────────────────────────────────────────────
  const pendingValue = computed(() => pendingStore.getPendingValue(props.shareId))
  const hasVoted = computed(() => {
    if (pendingValue.value !== null) return true
    return effectiveUserVote.value !== undefined && effectiveUserVote.value !== null
  })

  // ── Optimistic UI calculations ───────────────────────────────────────
  const activeOptimisticRating = computed(() => optimisticRating.value ?? pendingValue.value)

  const optimisticScoreSum = computed(() => {
    if (activeOptimisticRating.value !== null) {
      const oldVote = effectiveUserVote.value || 0
      return (effectiveScoreSum.value || 0) - oldVote + activeOptimisticRating.value
    }
    return effectiveScoreSum.value || 0
  })

  const optimisticVotersCount = computed(() => {
    if (activeOptimisticRating.value !== null) {
      if (!effectiveUserVote.value) {
        return (effectiveVotersCount.value || 0) + 1
      }
    }
    return effectiveVotersCount.value || 0
  })

  const optimisticAverageRating = computed(() => {
    if (activeOptimisticRating.value !== null) {
      const sum = optimisticScoreSum.value
      const count = optimisticVotersCount.value
      if (count > 0) {
        const avg = sum / count
        return Math.max(0, Math.min(5, Math.round(avg * 10) / 10))
      }
      return 0
    }

    if (confirmedPost.value) {
      const sum = effectiveScoreSum.value || 0
      const count = effectiveVotersCount.value || 0
      if (count > 0) {
        const avg = sum / count
        return Math.max(0, Math.min(5, Math.round(avg * 10) / 10))
      }
      return 0
    }

    return props.rating
  })

  const displayRating = computed(() => {
    if (hoveredStar.value !== null) {
      return hoveredStar.value
    }
    if (optimisticRating.value !== null) {
      return optimisticRating.value
    }
    if (pendingValue.value !== null) {
      return pendingValue.value as number
    }
    if (hasVoted.value) {
      return effectiveUserVote.value!
    }
    return 0
  })

  // ── Interaction handlers ─────────────────────────────────────────────

  const handleStarHover = (starNumber: number) => {
    if (props.disabled || isSubmitting.value || hasVoted.value) return
    hoveredStar.value = starNumber
  }

  const handleStarLeave = () => {
    hoveredStar.value = null
  }

  const handleRatingClick = (event: Event) => {
    if (hasVoted.value) {
      event.stopPropagation()
    }
  }

  // ── Vote submission ──────────────────────────────────────────────────

  function resolvePostTitle(shareId: string): { title: string; usedContent: boolean } {
    return resolvePostTitleFromPost(postsStore.getPostByShareId(shareId))
  }

  const handleStarClick = async (starNumber: number, event?: Event) => {
    // Already voted - block everything and prevent popover from opening
    if (hasVoted.value) {
      if (event) event.stopPropagation()
      return
    }

    if (props.disabled || isSubmitting.value) return

    const authStore = useAuthStore()

    if (!authStore.isUserAuthenticated) {
      // Let the event bubble so the auth popover opens
      return
    }

    // Authenticated - stop propagation so the popover does not open
    if (event) {
      event.stopPropagation()
    }

    const userProfile = authStore.userProfile

    // Validation checks
    if (isNewUser(userProfile)) {
      emit('error', new Error('Voting is allowed only 24 hours after registration'))
      return
    }
    if (isReputationBlocked(userProfile)) {
      emit('error', new Error('Your reputation is too low to vote'))
      return
    }
    if (isLowRatingBlocked(starNumber, userProfile)) {
      emit('error', new Error('You need at least 100 reputation to rate 1-3 stars'))
      return
    }

    // Visual explosion effect
    if (event && event instanceof MouseEvent) {
      effectsStore.triggerExplosion(event.clientX, event.clientY)
    } else {
      const originalEvent = (event as { originalEvent?: unknown } | undefined)?.originalEvent
      if (originalEvent instanceof MouseEvent) {
        effectsStore.triggerExplosion(originalEvent.clientX, originalEvent.clientY)
      }
    }

    try {
      isSubmitting.value = true
      optimisticRating.value = starNumber

      const { title } = resolvePostTitle(props.shareId)
      pendingStore.add(props.shareId, starNumber, 10 * 60 * 1000, title)

      const txid = await sendUpvoteTransaction(
        props.shareId,
        starNumber,
        props.contentAuthorAddress
      )

      pendingStore.markSubmitted(props.shareId, txid)
      emit('rating-change', starNumber)
    } catch (error: unknown) {
      console.error('[StarRating] Vote failed:', error)
      optimisticRating.value = null
      const errorMessage = error instanceof Error ? error.message : undefined
      pendingStore.markFailed(props.shareId, errorMessage)

      const classified = classifyVoteError(error)
      handleVoteError(classified, emit)
    } finally {
      isSubmitting.value = false
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  return {
    // Reactive state
    optimisticRating,
    isSubmitting,
    hoveredStar,
    authPopoverVisible,

    // Computed
    displayRating,
    optimisticAverageRating,
    optimisticVotersCount,
    hasVoted,

    // Methods
    openAuthModal,
    handleStarHover,
    handleStarLeave,
    handleStarClick,
    handleRatingClick,
  }
}
