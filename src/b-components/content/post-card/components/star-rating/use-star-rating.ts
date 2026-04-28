import { ref, computed } from 'vue'
import { Buffer } from 'buffer'

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { getUnspents, filterAvailableUnspents, selectBestUnspents, lockUTXOs } from '@/blockchain/core/transactions/unspents-manager'
import { appToast } from '@/b-components/app-toast'
import { usePendingRatingsStore } from '@/stores/pending-ratings-store'
import { useEffectsStore } from '@/stores/effects-store'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import type {
  StarRatingProps,
  StarRatingEmits,
  SendRawTransactionResponse
} from './types'


// ── Pure helper functions ──────────────────────────────────────────────

/**
 * Создает сериализованные данные для upvote транзакции
 */
function serializeUpvoteData(shareId: string, value: number): string {
  return shareId + value.toString()
}

/**
 * Проверяет, является ли пользователь "новым" (регистрация менее 24 часов назад)
 */
function isNewUser(userProfile: any): boolean {
  if (!userProfile) return false
  const regdate = userProfile.regdate
  if (!regdate) return true

  const regDateObj = new Date(regdate * 1000)
  const hours24 = 24 * 60 * 60 * 1000
  return regDateObj.getTime() + hours24 > Date.now()
}

/**
 * Проверяет блокировку по репутации
 */
function isReputationBlocked(userProfile: any): boolean {
  if (!userProfile) return false
  const reputation = userProfile.reputation || 0
  return reputation <= -12
}

/**
 * Проверяет ограничение на низкие оценки для пользователей с низкой репутацией
 */
function isLowRatingBlocked(value: number, userProfile: any): boolean {
  const reputation = userProfile.reputation || 0
  return value <= 3 && reputation < 100
}


// ── Blockchain transaction logic ───────────────────────────────────────

/**
 * Отправляет upvote транзакцию с retry логикой по доступным серверам
 */
async function sendUpvoteTransaction(
  shareId: string,
  value: number,
  contentAuthorAddress: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) {
    throw new Error('User not authenticated')
  }

  if (!contentAuthorAddress) {
    throw new Error('Content author address is required')
  }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)

  if (!unspents || unspents.length === 0) {
    throw new Error('No unspents available')
  }

  const selectedUnspents = selectBestUnspents(unspents, 0.00000001)

  if (selectedUnspents.length === 0) {
    throw new Error('No suitable unspents available for transaction')
  }

  lockUTXOs(selectedUnspents)

  const serializedData = serializeUpvoteData(shareId, value)

  const rpcData = {
    share: shareId,
    value: value.toString()
  }

  const payloadString = `${contentAuthorAddress} ${value}`
  const opReturnData = [
    Buffer.from(payloadString, 'utf8')
  ]

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'upvoteShare',
    opReturnData,
    fee: 0.00000001,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, rpcData, 'upvoteShare'],
    options: {
      auth: true
    }
  }) as SendRawTransactionResponse | string

  if (typeof response === 'string') {
    return response
  }

  if (response && typeof response === 'object') {
    if ('result' in response && response.result === 'success' && 'data' in response && typeof response.data === 'string') {
      return response.data
    }
    if ('error' in response && response.error) {
      if (typeof response.error === 'object') {
        throw response.error
      }
      throw new Error(String(response.error))
    }
  }

  throw new Error('Unexpected response format from sendrawtransactionwithmessage')
}


// ── Error classification & handling ────────────────────────────────────

interface ClassifiedError {
  isDoubleScore: boolean
  isBlocking: boolean
  isNotFound: boolean
  isMempoolConflict: boolean
  isNetworkFailed: boolean
  message: string
}

function classifyVoteError(error: any): ClassifiedError {
  const errorCode = (error?.error?.code) || (error?.code)

  let errorMessage = ''
  if (error?.message && typeof error.message === 'string') {
    errorMessage = error.message
  } else if (error?.error?.message && typeof error.error.message === 'string') {
    errorMessage = error.error.message
  } else if (typeof error?.error === 'string') {
    errorMessage = error.error
  }

  let isDoubleScore = Number(errorCode) === 4
  let isBlocking = Number(errorCode) === 32
  let isNotFound = Number(errorCode) === 12
  let isMempoolConflict = Number(errorCode) === -26

  if (errorMessage) {
    if (errorMessage.includes('DoubleScore') || errorMessage.includes('result 4')) {
      isDoubleScore = true
    }
    if (errorMessage.includes('Blocking') || errorMessage.includes('result 32')) {
      isBlocking = true
    }
    if (errorMessage.includes('NotFound') || errorMessage.includes('result 12')) {
      isNotFound = true
    }
    if (errorMessage.includes('txn-mempool-conflict') || errorMessage.includes('too-long-mempool-chain')) {
      isMempoolConflict = true
    }
  }

  const isNetworkFailed =
    typeof error?.message === 'string' &&
    (error.message.includes('All RPC servers failed') || error.message.includes('All HTTP servers failed'))

  return {
    isDoubleScore,
    isBlocking,
    isNotFound,
    isMempoolConflict,
    isNetworkFailed,
    message: error?.message || 'Failed to submit vote',
  }
}

function handleVoteError(
  classified: ClassifiedError,
  emit: StarRatingEmits,
) {
  if (classified.isMempoolConflict) {
    appToast.error({ message: 'Слишком частые оценки. Пожалуйста, подождите пару секунд.' })
    return
  }

  if (classified.isDoubleScore) {
    appToast.error({ message: 'Вы уже оценили этот пост' })
    return
  }

  if (classified.isBlocking) {
    appToast.error({ message: 'Невозможно поставить оценку, так как вы были заблокированы этим аккаунтом.' })
    return
  }

  if (classified.isNotFound) {
    appToast.error({ message: 'Оцениваемый контент не найден или был удален.' })
    return
  }

  if (classified.isNetworkFailed) {
    appToast.error({ message: 'Не удалось записать вашу оценку из‑за временных технических неполадок. Попробуйте позже.' })
    emit('error', new Error(classified.message))
    return
  }

  emit('error', new Error(classified.message))
}


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
    } else if (event && (event as any).originalEvent instanceof MouseEvent) {
      const mouseEvent = (event as any).originalEvent as MouseEvent
      effectsStore.triggerExplosion(mouseEvent.clientX, mouseEvent.clientY)
    }

    try {
      isSubmitting.value = true
      optimisticRating.value = starNumber

      const { title } = resolvePostTitle(props.shareId)
      pendingStore.add(props.shareId, starNumber, 10 * 60 * 1000, title)

      const txid = await sendUpvoteTransaction(props.shareId, starNumber, props.contentAuthorAddress)

      pendingStore.markSubmitted(props.shareId, txid)
      emit('rating-change', starNumber)
    } catch (error: any) {
      console.error('[StarRating] Vote failed:', error)
      optimisticRating.value = null
      pendingStore.markFailed(props.shareId, error?.message)

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
