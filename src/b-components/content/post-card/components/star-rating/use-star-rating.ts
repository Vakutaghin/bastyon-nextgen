import { ref, computed } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import { appToast } from '@/b-components/app-toast'
import { usePendingRatingsStore } from '@/stores/pending-ratings-store'
import { useHeldRatingsStore } from '@/stores/held-ratings-store'
import { useEffectsStore } from '@/stores/effects-store'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import type { StarRatingProps, StarRatingEmits } from './types'
import {
  isNewUser,
  isReputationBlocked,
  isLowRatingBlocked,
  isOwnContent,
} from './helpers/star-rating-validation'
import { t } from '@/i18n'

// ── Composable ─────────────────────────────────────────────────────────

export function useStarRating(props: StarRatingProps, emit: StarRatingEmits) {
  // ── Reactive state ───────────────────────────────────────────────────
  const hoveredStar = ref<number | null>(null)
  const authPopoverVisible = ref(false)

  // ── Stores ───────────────────────────────────────────────────────────
  const modalStore = useModalStore()
  const postsStore = usePostsStore()
  const effectsStore = useEffectsStore()
  const pendingStore = usePendingRatingsStore()
  pendingStore.init()
  const heldStore = useHeldRatingsStore()
  heldStore.init()

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

  /**
   * Свой пост: нода отвергает такую оценку (код 5). Раньше звёзды оставались
   * кликабельными, транзакция уходила и ошибка не классифицировалась (S18).
   */
  const isOwnPost = computed(() =>
    isOwnContent(props.contentAuthorAddress, useAuthStore().getUserAddress)
  )

  // ── Своя оценка: ждёт отправки, отправлена, в сети ───────────────────
  /** Ещё не ушла: можно выбрать другую звезду или отменить. */
  const heldValue = computed(() => heldStore.heldValue(props.shareId))
  const holdSeconds = computed(() => heldStore.secondsLeft(props.shareId))
  /** Ушла, но пост её ещё не показывает: ждёт блока или отправлена в этом запуске. */
  const submittedValue = computed(
    () => pendingStore.getPendingValue(props.shareId) ?? heldStore.sentValue(props.shareId)
  )
  const hasVoted = computed(() => {
    if (submittedValue.value !== null) return true
    return effectiveUserVote.value !== undefined && effectiveUserVote.value !== null
  })

  // ── Optimistic UI calculations ───────────────────────────────────────
  const activeOptimisticRating = computed(() => heldValue.value ?? submittedValue.value)

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
    if (activeOptimisticRating.value !== null) {
      return activeOptimisticRating.value
    }
    if (hasVoted.value) {
      return effectiveUserVote.value!
    }
    return 0
  })

  // ── Interaction handlers ─────────────────────────────────────────────

  const handleStarHover = (starNumber: number) => {
    if (props.disabled || hasVoted.value) return
    // Гость оценить не может: закрашенные звёзды выглядели поставленной
    // оценкой, а на телефоне тап оставлял их закрашенными рядом с «Войдите».
    if (!useAuthStore().isUserAuthenticated) return
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

  const handleStarClick = (starNumber: number, event?: Event): void => {
    // Already voted - block everything and prevent popover from opening
    if (hasVoted.value) {
      if (event) event.stopPropagation()
      return
    }

    if (props.disabled) return

    const authStore = useAuthStore()

    if (isOwnPost.value) {
      if (event) event.stopPropagation()
      appToast.error({ message: t('postCard.ratingOwnPost') })
      return
    }

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
    // Каждая причина отказа теперь видна пользователю: раньше она уходила в
    // `emit('error')`, а родитель писал её только в консоль (S18).
    if (isNewUser(userProfile)) {
      appToast.error({ message: t('postCard.ratingNewAccount') })
      emit('error', new Error('Voting is allowed only 24 hours after registration'))
      return
    }
    if (isReputationBlocked(userProfile)) {
      appToast.error({ message: t('postCard.ratingLowReputation') })
      emit('error', new Error('Your reputation is too low to vote'))
      return
    }
    if (isLowRatingBlocked(starNumber, userProfile)) {
      appToast.error({ message: t('postCard.ratingLowStarsNeedReputation') })
      emit('error', new Error('You need at least 100 reputation to rate 1-3 stars'))
      return
    }

    // Та же звезда, пока оценка ждёт, — отсчёт не начинается заново.
    if (heldValue.value === starNumber) return

    // Visual explosion effect
    if (event && event instanceof MouseEvent) {
      effectsStore.triggerExplosion(event.clientX, event.clientY)
    } else {
      const originalEvent = (event as { originalEvent?: unknown } | undefined)?.originalEvent
      if (originalEvent instanceof MouseEvent) {
        effectsStore.triggerExplosion(originalEvent.clientX, originalEvent.clientY)
      }
    }

    // Наведение больше не перекрывает выбранное: палец остался на звезде.
    hoveredStar.value = null
    heldStore.hold({
      shareId: props.shareId,
      value: starNumber,
      author: props.contentAuthorAddress,
      title: resolvePostTitle(props.shareId).title,
    })
  }

  /** Передумали, пока оценка не ушла. */
  const cancelHold = (): void => {
    hoveredStar.value = null
    heldStore.cancel(props.shareId)
  }

  // ── Public API ───────────────────────────────────────────────────────
  return {
    // Reactive state
    hoveredStar,
    authPopoverVisible,

    // Computed
    displayRating,
    optimisticAverageRating,
    optimisticVotersCount,
    hasVoted,
    heldValue,
    holdSeconds,
    submittedValue,
    isOwnPost,

    // Methods
    cancelHold,
    openAuthModal,
    handleStarHover,
    handleStarLeave,
    handleStarClick,
    handleRatingClick,
  }
}
