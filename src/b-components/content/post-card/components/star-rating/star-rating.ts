import { defineComponent, ref, computed } from 'vue'
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
import type {
  StarRatingProps,
  StarRatingEmits,
  SendRawTransactionResponse
} from './types'


/**
 * Создает сериализованные данные для upvote транзакции
 */
function serializeUpvoteData(shareId: string, value: number): string {
  // Формат сериализации для upvote: shareId + value
  // В старом приложении: self.share.v + self.value.v
  return shareId + value.toString()
}

/**
 * Проверяет, является ли пользователь "новым" (регистрация менее 24 часов назад)
 */
function isNewUser(userProfile: any): boolean {
  if (!userProfile) return false
  const regdate = userProfile.regdate
  if (!regdate) return true // Если нет даты регистрации, считаем новым/непроверенным

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
  // Базовая проверка: репутация ниже порога (-12 по умолчанию в legacy)
  return reputation <= -12
}

/**
 * Проверяет ограничение на низкие оценки для пользователей с низкой репутацией
 */
function isLowRatingBlocked(value: number, userProfile: any): boolean {
  const reputation = userProfile.reputation || 0
  // Если оценка <= 3 и репутация < 100, блокируем
  return value <= 3 && reputation < 100
}

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

  // Получаем unspents для создания транзакции
  // Используем готовый модуль для работы с unspents
  let unspents = await getUnspents(address, 1, 9999999)

  // Фильтруем доступные unspents
  unspents = filterAvailableUnspents(unspents, false)

  if (!unspents || unspents.length === 0) {
    throw new Error('No unspents available')
  }

  // Выбираем лучшие unspents для транзакции (минимальная сумма для комиссии)
  // Для upvote нужна минимальная сумма, так как это OP_RETURN транзакция
  const selectedUnspents = selectBestUnspents(unspents, 0.00000001)

  if (selectedUnspents.length === 0) {
    throw new Error('No suitable unspents available for transaction')
  }

  // Lock selected unspents to prevent reuse in rapid transactions
  lockUTXOs(selectedUnspents)

  // Сериализуем данные для upvote (shareId + value)
  // Эта строка используется для создания хеша в OP_RETURN
  const serializedData = serializeUpvoteData(shareId, value)

  // Объект данных для RPC запроса (sendrawtransactionwithmessage)
  // В старом приложении: obj.export() -> { share: ..., value: ... }
  const rpcData = {
    share: shareId,
    value: value.toString()
  }

  // Данные для OP_RETURN: ContentAuthorAddress + " " + Value
  // В старом приложении: opReturnPayloadData = *lastContent->GetString1() + " " + to_string(*ptx->GetValue())
  // Backend ожидает: vasm[3] == HexStr(ContentAuthorAddress + " " + Value)
  // Поэтому мы должны передать это как ОДИН буфер, чтобы он попал в vasm[3]
  // (vasm[0]=OP_RETURN, vasm[1]=Type, vasm[2]=Hash, vasm[3]=Payload)
  const payloadString = `${contentAuthorAddress} ${value}`
  const opReturnData = [
    Buffer.from(payloadString, 'utf8')
  ]

  // Собираем транзакцию
  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData, // Строка для хеширования (shareId + value)
    operationType: 'upvoteShare',
    opReturnData, // Передаем дополнительные данные (payload)
    fee: 0.00000001, // Минимальная комиссия
  })

  // Отправляем транзакцию через getByPRCWithAuth
  // Встроенная retry логика автоматически пробует все доступные серверы по кругу
  // messageData должен быть объектом, который нода сериализует и сверяет с хешем в транзакции
  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, rpcData, 'upvoteShare'],
    options: {
      auth: true
    }
  }) as SendRawTransactionResponse | string

  // Проверяем успешность ответа
  // Если ответ - строка (txid), возвращаем сразу
  if (typeof response === 'string') {
    return response
  }

  // Если ответ - объект
  if (response && typeof response === 'object') {
    if ('result' in response && response.result === 'success' && 'data' in response && typeof response.data === 'string') {
      return response.data // txid
    }
    if ('error' in response && response.error) {
      // Если ошибка - объект, выбрасываем его как есть, чтобы сохранить структуру (код, сообщение)
      if (typeof response.error === 'object') {
        throw response.error
      }
      throw new Error(String(response.error))
    }
  }

  throw new Error('Unexpected response format from sendrawtransactionwithmessage')
}

export const starRatingOptions = defineComponent({
  name: 'StarRating',
  props: {
    rating: {
      type: Number,
      required: true,
      validator: (value: number) => value >= 0 && value <= 5
    },
    votersCount: {
      type: Number,
      default: 0
    },
    shareId: {
      type: String,
      required: true
    },
    contentAuthorAddress: {
      type: String,
      required: true
    },
    userVote: {
      type: Number,
      default: undefined
    },
    scoreSum: {
      type: Number,
      default: 0
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['rating-change', 'error'],
  setup(
    p: StarRatingProps,
    { emit }: { emit: StarRatingEmits },
  ) {
    // Optimistic UI: локальное состояние рейтинга
    const optimisticRating = ref<number | null>(null)
    const isSubmitting = ref(false)
    const hoveredStar = ref<number | null>(null)
    const authPopoverVisible = ref(false)
    const modalStore = useModalStore()
    const postsStore = usePostsStore()
    const effectsStore = useEffectsStore()
    const pendingStore = usePendingRatingsStore()
    pendingStore.init()

    const openAuthModal = () => {
      authPopoverVisible.value = false
      modalStore.openAuthModal()
    }

    const confirmedPost = computed(() => postsStore.getPostByShareId(p.shareId))

    const effectiveUserVote = computed(() => confirmedPost.value?.myVal ?? p.userVote)
    const effectiveScoreSum = computed(() => confirmedPost.value?.scoreSum ?? p.scoreSum)
    const effectiveVotersCount = computed(() => confirmedPost.value?.scoreCnt ?? p.votersCount)

    const pendingValue = computed(() => pendingStore.getPendingValue(p.shareId))
    const hasVoted = computed(() => {
      if (pendingValue.value !== null) return true
      return effectiveUserVote.value !== undefined && effectiveUserVote.value !== null
    })

    // Optimistic UI: Вычисление оптимистичных значений для суммы и количества голосов
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
        // Если пользователь еще не голосовал (или userVote 0/undefined), увеличиваем счетчик
        if (!effectiveUserVote.value) {
          return (effectiveVotersCount.value || 0) + 1
        }
      }
      return effectiveVotersCount.value || 0
    })

    const optimisticAverageRating = computed(() => {
      // Если есть активное оптимистичное значение, вычисляем новый средний рейтинг
      if (activeOptimisticRating.value !== null) {
        const sum = optimisticScoreSum.value
        const count = optimisticVotersCount.value
        if (count > 0) {
          const avg = sum / count
          return Math.max(0, Math.min(5, Math.round(avg * 10) / 10))
        }
        return 0 // Если голосов нет, рейтинг 0
      }

      // Если есть подтвержденные данные в сторе, используем их
      if (confirmedPost.value) {
        const sum = effectiveScoreSum.value || 0
        const count = effectiveVotersCount.value || 0
        if (count > 0) {
          const avg = sum / count
          return Math.max(0, Math.min(5, Math.round(avg * 10) / 10))
        }
        return 0
      }

      // Иначе возвращаем оригинальный рейтинг из пропсов
      return p.rating
    })

    // Вычисляем отображаемый рейтинг
    // Если наведено - показываем hover
    // Если есть оптимистичный рейтинг - показываем его
    // Если есть оценка пользователя - показываем её
    // Иначе показываем 0 (пустые звезды)
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

    // Обработчик наведения на звезду
    const handleStarHover = (starNumber: number) => {
      if (p.disabled || isSubmitting.value || hasVoted.value) return
      hoveredStar.value = starNumber
    }

    // Обработчик ухода с звезды
    const handleStarLeave = () => {
      hoveredStar.value = null
    }

    // Обработчик клика по звезде (голосование)
    const handleStarClick = async (starNumber: number, event?: Event) => {
      // Если уже проголосовали, блокируем любые действия и всплытие (чтобы не открылся popover)
      if (hasVoted.value) {
        if (event) event.stopPropagation()
        return
      }

      if (p.disabled || isSubmitting.value) return

      // Проверки репутации и правил
      const authStore = useAuthStore()

      if (!authStore.isUserAuthenticated) {
        // Если не авторизован, позволяем событию всплыть, чтобы открыть popover
        // (popover trigger="click")
        return
      }

      // Если авторизован, останавливаем всплытие, чтобы popover не открылся
      if (event) {
        event.stopPropagation()
      }

      const userProfile = authStore.userProfile

      // 1. Проверка на нового пользователя (24 часа)
      if (isNewUser(userProfile)) {
        emit('error', new Error('Voting is allowed only 24 hours after registration'))
        return
      }

      // 2. Проверка на низкую репутацию
      if (isReputationBlocked(userProfile)) {
        emit('error', new Error('Your reputation is too low to vote'))
        return
      }

      // 3. Проверка на низкую оценку при низкой репутации
      if (isLowRatingBlocked(starNumber, userProfile)) {
        emit('error', new Error('You need at least 100 reputation to rate 1-3 stars'))
        return
      }

      // Visual effect
      if (event && event instanceof MouseEvent) {
        effectsStore.triggerExplosion(event.clientX, event.clientY)
      } else if (event && (event as any).originalEvent instanceof MouseEvent) {
         // Fallback for some framework wrappers if needed
         const mouseEvent = (event as any).originalEvent as MouseEvent
         effectsStore.triggerExplosion(mouseEvent.clientX, mouseEvent.clientY)
      }

      try {
        isSubmitting.value = true
        optimisticRating.value = starNumber

        // Try to get title from posts store
        const post = postsStore.getPostByShareId(p.shareId)

        let postTitle = post?.title || ''
        const usedContent = !postTitle && !!post?.content

        // If title is empty, try to use content (description)
        if (usedContent) {
          const content = post!.content
          // Check if content is JSON (Editor.js)
          if (typeof content === 'string' && content.trim().startsWith('{')) {
             try {
               const json = JSON.parse(content)
               // Extract text from first block
               if (json?.blocks && Array.isArray(json.blocks) && json.blocks.length > 0) {
                 postTitle = json.blocks[0].text || ''
               }
             } catch (e) {
               // If parse fails, treat as plain text
               postTitle = content
             }
          } else {
             postTitle = content
          }
        }

        // Decode URL encoded title if needed
        if (postTitle) {
          try {
            if (/%[0-9A-Fa-f]{2}/.test(postTitle)) {
               postTitle = decodeURIComponent(postTitle)
            }
          } catch (e) {
            // ignore decoding errors
          }
        }

        // Truncate content if it exceeds 200 characters
        if (usedContent && postTitle.length > 200) {
           postTitle = postTitle.substring(0, 200) + '...'
        }

        // If still empty, use a fallback based on type if possible, or leave empty
        if (!postTitle && post?.type === 'video') {
           postTitle = 'Видео'
        }

        pendingStore.add(p.shareId, starNumber, 10 * 60 * 1000, postTitle)

        const txid = await sendUpvoteTransaction(p.shareId, starNumber, p.contentAuthorAddress)

        pendingStore.markSubmitted(p.shareId, txid)
        emit('rating-change', starNumber)
      } catch (error: any) {
        console.error('[StarRating] Vote failed:', error)
        optimisticRating.value = null // Revert optimistic update
        pendingStore.markFailed(p.shareId, error?.message)

        // Обработка ошибки DoubleScore (код 4)
        // Структура ошибки может быть вложенной: error.error.code === 4 или error.code === 4
        const errorCode = (error && error.error && error.error.code) || (error && error.code)

        // Извлекаем сообщение об ошибке из разных мест
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

        // Дополнительная проверка по тексту ошибки
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

        if (isMempoolConflict) {
          appToast.error({
            message: 'Слишком частые оценки. Пожалуйста, подождите пару секунд.',
          })
          return
        }

        if (isDoubleScore) {
          appToast.error({
            message: 'Вы уже оценили этот пост',
          })
          return
        }

        // Обработка ошибки Blocking
        if (isBlocking) {
          appToast.error({
            message: 'Невозможно поставить оценку, так как вы были заблокированы этим аккаунтом.',
          })
          return
        }

        // Обработка ошибки NotFound
        if (isNotFound) {
          appToast.error({
            message: 'Оцениваемый контент не найден или был удален.',
          })
          return
        }

        const networkFailed =
          typeof error?.message === 'string' &&
          (error.message.includes('All RPC servers failed') || error.message.includes('All HTTP servers failed'))
        if (networkFailed) {
          appToast.error({
            message: 'Не удалось записать вашу оценку из‑за временных технических неполадок. Попробуйте позже.'
          })
          emit('error', new Error(error.message))
          return
        }

        emit('error', new Error(error.message || 'Failed to submit vote'))
      } finally {
        isSubmitting.value = false
      }
    }

    // Обработчик клика по контейнеру (для перехвата кликов в промежутках)
    const handleRatingClick = (event: Event) => {
      if (hasVoted.value) {
        event.stopPropagation()
      }
    }

    return {
      displayRating,
      optimisticAverageRating,
      optimisticVotersCount,
      hoveredStar,
      isSubmitting,
      authPopoverVisible,
      openAuthModal,
      handleStarHover,
      handleStarLeave,
      handleStarClick,
      handleRatingClick,
      hasVoted
    }
  }
})
