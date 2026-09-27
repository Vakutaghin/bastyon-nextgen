/**
 * Отказ ноды принять транзакцию — с причиной, понятной человеку.
 *
 * Социальную транзакцию (пост, коммент, оценку, жалобу, подписку, профиль)
 * нода проверяет консенсусом и при отказе отвечает числовым кодом
 * (SocialConsensusResult в pocketnet.core): лимит постов за сутки, повторная
 * оценка, правка чужого поста и т. п. Раньше код терялся по дороге, и
 * человек видел «Не удалось опубликовать пост» без причины.
 *
 * Коды и их смысл — из старого клиента (pocketnet.gui js/satolist.js,
 * `self.errors`). Тексты написаны заново: в старых переводах части не было,
 * а часть говорила «Unknown Error (12)».
 */

import { t } from '@/i18n'

/** Код консенсуса → ключ текста в `nodeReject.*`. */
const REJECT_KEYS: Readonly<Record<number, string>> = {
  1: 'notRegistered',
  2: 'postLimit',
  3: 'scoreLimit',
  4: 'doubleScore',
  5: 'selfScore',
  6: 'profileEditLimit',
  7: 'notSubscribed',
  8: 'alreadySubscribed',
  9: 'selfSubscribe',
  11: 'invalidData',
  12: 'notFound',
  13: 'alreadyReported',
  14: 'selfReport',
  15: 'reportLimit',
  16: 'reportReputation',
  17: 'postTooLong',
  18: 'nameTaken',
  19: 'nameTooLong',
  20: 'selfReferrer',
  21: 'malformed',
  22: 'notBlocked',
  23: 'alreadyBlocked',
  24: 'selfBlock',
  25: 'editOncePerBlock',
  26: 'editLimit',
  27: 'editForeign',
  28: 'tooManyActions',
  29: 'commentLimit',
  30: 'commentEditLimit',
  31: 'commentScoreLimit',
  32: 'blockedByAuthor',
  33: 'tooLarge',
  34: 'parentDeleted',
  35: 'parentDeleted',
  37: 'commentEditTooSoon',
  38: 'selfCommentScore',
  39: 'commentDeleted',
  40: 'doubleCommentScore',
  41: 'malformed',
  42: 'commentDeleted',
  47: 'deleteFailed',
  48: 'waitPrevious',
  49: 'settingsLimit',
  60: 'negativeScoreReputation',
  61: 'editOncePerBlock',
  62: 'alreadyReported',
  64: 'selfReport',
  65: 'reportLimit',
  66: 'reportReputation',
  313: 'accountLocked',
}

/** Неизвестный код меньше этого — всё ещё отказ консенсуса, просто новый. */
const CONSENSUS_CODE_LIMIT = 100

/** RPC_VERIFY_REJECTED: транзакцию не пустили в mempool (политика, конфликт входов). */
const MEMPOOL_REJECTED = -26
/** RPC_VERIFY_ERROR: в том числе «входы уже потрачены / ещё не видны». */
const VERIFY_ERROR = -25

/** Причины отказа mempool, которые лечатся ожиданием подтверждения прошлой транзакции. */
const WAIT_REASONS = [
  'txn-mempool-conflict',
  'too-long-mempool-chain',
  'missingorspent',
  'missing inputs',
  'missing-inputs',
]

/**
 * Нода отклонила транзакцию. `message` — готовый текст для человека, `code` —
 * исходный код ноды: по нему вызывающие различают DoubleScore и т. п.
 */
export class NodeRejectError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'NodeRejectError'
  }
}

interface RejectShape {
  code?: unknown
  message?: unknown
  error?: unknown
}

/** Код и текст отказа из ответа ноды: `{code}`, `{error: {code}}` или `Error` с таким `cause`. */
function findReject(error: unknown, depth = 0): { code: number; reason: string } | null {
  if (!error || typeof error !== 'object' || depth > 3) return null
  const shape = error as RejectShape
  const code = typeof shape.code === 'string' ? Number(shape.code) : shape.code
  if (typeof code === 'number' && Number.isInteger(code)) {
    const reason = typeof shape.message === 'string' ? shape.message : ''
    return { code, reason }
  }
  if (shape.error && typeof shape.error === 'object') return findReject(shape.error, depth + 1)
  if (error instanceof Error && error.cause) return findReject(error.cause, depth + 1)
  return null
}

/**
 * Отказ ноды как `NodeRejectError` с текстом на языке интерфейса; `null`,
 * если это не отказ (сеть, таймаут) или отказ без понятной причины — тогда
 * вызывающий показывает свой общий текст.
 */
export function toNodeRejectError(error: unknown): NodeRejectError | null {
  if (error instanceof NodeRejectError) return error
  const reject = findReject(error)
  if (!reject) return null
  const { code, reason } = reject

  if (code > 0) {
    const key = REJECT_KEYS[code]
    // Коды консенсуса — двузначные; большие (408, 2000) шлёт прокси о своей сети.
    if (!key && code >= CONSENSUS_CODE_LIMIT) return null
    const message = key ? t(`nodeReject.${key}`) : t('nodeReject.unknownCode', { code })
    return new NodeRejectError(code, message, { cause: error })
  }

  const lower = reason.toLowerCase()
  const waitable = WAIT_REASONS.some((r) => lower.includes(r))
  if (code === MEMPOOL_REJECTED || (code === VERIFY_ERROR && waitable)) {
    const message = waitable
      ? t('nodeReject.waitPrevious')
      : t('nodeReject.rejected', { reason: reason || String(code) })
    return new NodeRejectError(code, message, { cause: error })
  }
  return null
}
