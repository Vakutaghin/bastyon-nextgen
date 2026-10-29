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
  // Действие с удалённым постом: комментарий, репост, жалоба, оценка, буст.
  51: 'contentDeleted',
  52: 'contentDeleted',
  56: 'contentDeleted',
  57: 'contentDeleted',
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

/**
 * Код и текст отказа из ответа ноды: `{code}`, `{error: {code}}` или `Error` с
 * таким `cause`.
 *
 * Обходим всё дерево, а не первый попавшийся слой: прокси заворачивает ответ
 * ноды в `{error: {code, message}, code}`, и верхний слой несёт код без текста.
 * Раньше поиск останавливался на нём, причина терялась, и человек видел голое
 * «Сеть отклонила транзакцию: -26». Поэтому берём кандидата с текстом, если
 * он есть хоть где-то в дереве.
 */
function findReject(error: unknown, depth = 0): { code: number; reason: string } | null {
  if (!error || typeof error !== 'object' || depth > 4) return null
  const shape = error as RejectShape
  const found: { code: number; reason: string }[] = []

  const code = typeof shape.code === 'string' ? Number(shape.code) : shape.code
  if (typeof code === 'number' && Number.isInteger(code)) {
    const reason = typeof shape.message === 'string' ? shape.message : ''
    found.push({ code, reason })
  }

  const nested =
    shape.error && typeof shape.error === 'object' ? findReject(shape.error, depth + 1) : null
  const deeper =
    nested ?? (error instanceof Error && error.cause ? findReject(error.cause, depth + 1) : null)
  if (deeper) found.push(deeper)

  return found.find((candidate) => candidate.reason !== '') ?? found[0] ?? null
}

/** Причина отказа mempool → ключ текста. Порядок важен: ищем по вхождению. */
const MEMPOOL_REASON_KEYS: readonly (readonly [string, string])[] = [
  ['min relay fee not met', 'feeTooLow'],
  ['mempool min fee not met', 'feeTooLow'],
  ['insufficient fee', 'feeTooLow'],
  ['fee too low', 'feeTooLow'],
  ['absurdly-high-fee', 'feeTooHigh'],
  ['dust', 'dustOutput'],
  ['non-final', 'notFinal'],
  ['tx-size', 'tooLarge'],
  ['scriptsig-size', 'malformed'],
  ['mandatory-script-verify-flag-failed', 'malformed'],
]

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
    return new NodeRejectError(code, mempoolMessage(code, reason, lower, waitable), {
      cause: error,
    })
  }
  return null
}

/**
 * Текст отказа mempool. Коды вроде -26 человеку ничего не говорят, поэтому
 * сначала пробуем узнать причину по тексту ноды, а если текста нет — честно
 * говорим об этом и называем самое вероятное.
 */
function mempoolMessage(code: number, reason: string, lower: string, waitable: boolean): string {
  if (waitable) return t('nodeReject.waitPrevious')
  const known = MEMPOOL_REASON_KEYS.find(([needle]) => lower.includes(needle))
  if (known) return t(`nodeReject.${known[1]}`)
  if (!reason) return t('nodeReject.rejectedNoReason', { code })
  return t('nodeReject.rejected', { reason })
}
