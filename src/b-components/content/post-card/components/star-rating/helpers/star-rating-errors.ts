// Классификация и обработка ошибок голосования: маппит коды RPC и подстроки сообщений
// в семантические признаки + показывает соответствующий toast.

import { appToast } from '@/b-components/app-toast'
import type { StarRatingEmits } from '../types'

export interface ClassifiedError {
  /** Уже голосовал за этот пост (RPC code 4). */
  isDoubleScore: boolean
  /** Автор поста заблокировал текущего пользователя (RPC code 32). */
  isBlocking: boolean
  /** Контент не найден / удалён (RPC code 12). */
  isNotFound: boolean
  /** Конфликт mempool (RPC code -26 или специфичные сообщения). */
  isMempoolConflict: boolean
  /** Все доступные сервера упали — сетевая проблема, не бизнес-логика. */
  isNetworkFailed: boolean
  message: string
}

export function classifyVoteError(error: any): ClassifiedError {
  const errorCode = error?.error?.code || error?.code

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
    if (errorMessage.includes('DoubleScore') || errorMessage.includes('result 4'))
      isDoubleScore = true
    if (errorMessage.includes('Blocking') || errorMessage.includes('result 32')) isBlocking = true
    if (errorMessage.includes('NotFound') || errorMessage.includes('result 12')) isNotFound = true
    if (
      errorMessage.includes('txn-mempool-conflict') ||
      errorMessage.includes('too-long-mempool-chain')
    ) {
      isMempoolConflict = true
    }
  }

  const isNetworkFailed =
    typeof error?.message === 'string' &&
    (error.message.includes('All RPC servers failed') ||
      error.message.includes('All HTTP servers failed'))

  return {
    isDoubleScore,
    isBlocking,
    isNotFound,
    isMempoolConflict,
    isNetworkFailed,
    message: error?.message || 'Failed to submit vote',
  }
}

/** Реакция на классифицированную ошибку: соответствующий toast + `emit('error')` для сети. */
export function handleVoteError(classified: ClassifiedError, emit: StarRatingEmits): void {
  if (classified.isMempoolConflict) {
    appToast.error({ message: 'Слишком частые оценки. Пожалуйста, подождите пару секунд.' })
    return
  }
  if (classified.isDoubleScore) {
    appToast.error({ message: 'Вы уже оценили этот пост' })
    return
  }
  if (classified.isBlocking) {
    appToast.error({
      message: 'Невозможно поставить оценку, так как вы были заблокированы этим аккаунтом.',
    })
    return
  }
  if (classified.isNotFound) {
    appToast.error({ message: 'Оцениваемый контент не найден или был удален.' })
    return
  }
  if (classified.isNetworkFailed) {
    appToast.error({
      message:
        'Не удалось записать вашу оценку из‑за временных технических неполадок. Попробуйте позже.',
    })
    emit('error', new Error(classified.message))
    return
  }
  emit('error', new Error(classified.message))
}
