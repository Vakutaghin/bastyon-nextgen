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

/** Узкая форма ошибки голосования: RPC-обёртка с возможным вложенным `error`. */
interface VoteErrorShape {
  code?: number | string
  message?: string
  error?: string | { code?: number | string; message?: string }
}

function asVoteError(error: unknown): VoteErrorShape {
  return typeof error === 'object' && error !== null ? (error as VoteErrorShape) : {}
}

export function classifyVoteError(error: unknown): ClassifiedError {
  const e = asVoteError(error)
  const nestedError = typeof e.error === 'object' && e.error !== null ? e.error : undefined
  const errorCode = nestedError?.code ?? e.code

  let errorMessage = ''
  if (typeof e.message === 'string') {
    errorMessage = e.message
  } else if (nestedError?.message && typeof nestedError.message === 'string') {
    errorMessage = nestedError.message
  } else if (typeof e.error === 'string') {
    errorMessage = e.error
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
    typeof e.message === 'string' &&
    (e.message.includes('All RPC servers failed') ||
      e.message.includes('All HTTP servers failed'))

  return {
    isDoubleScore,
    isBlocking,
    isNotFound,
    isMempoolConflict,
    isNetworkFailed,
    message: e.message || 'Failed to submit vote',
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
