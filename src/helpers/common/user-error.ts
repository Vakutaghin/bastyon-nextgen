/**
 * Что показать человеку вместо технической ошибки.
 *
 * Тексты ошибок в коде — английские, для журнала и сведений поддержки. Раньше
 * тосты и формы показывали `e.message` как есть: без сети человек с любым
 * языком интерфейса видел «No network connection: …», а при сбое отправки —
 * «Failed to send transaction: …».
 *
 * Показываем текст ошибки, только если он уже на языке интерфейса (`UserError`
 * и классы с `forUser`). Нет сети, Bastyon не отвечает, Tor не готов — своими
 * словами, даже если это причина (`cause`) другой ошибки. Остальное — словами
 * того места, где сломалось (`fallback`).
 */

import { t } from '@/i18n'
import { isOfflineError } from '@/helpers/api/offline'
import { isUnreachableError } from '@/helpers/api/reachability'
import { isTorNotReadyError } from '@/helpers/tor/tor-gate'
import { isNetworkUnreachable } from './extract-error-message'

/** Ошибка, текст которой — для человека, на языке интерфейса. */
export class UserError extends Error {
  readonly forUser = true
}

/** Глубже причин не бывает; от петли `cause` тоже защищает. */
const MAX_CAUSES = 5

/** Уже записанные в журнал: текст в шаблоне считается при каждой отрисовке. */
const logged = new WeakSet<object>()

/** Человек увидит общие слова — сама причина остаётся в журнале и сведениях поддержки. */
function logOnce(err: unknown): void {
  if (!err) return
  if (typeof err === 'object') {
    if (logged.has(err)) return
    logged.add(err)
  }
  console.error('[ui-error]', err)
}

export function userErrorText(err: unknown, fallback: string): string {
  let e: unknown = err
  for (let i = 0; e && i < MAX_CAUSES; i++) {
    if (e instanceof Error && (e as { forUser?: unknown }).forUser === true) return e.message
    if (isOfflineError(e)) return t('common.offline')
    if (isUnreachableError(e)) return t('common.noConnection')
    if (isNetworkUnreachable(e)) return t('common.networkUnavailable')
    if (isTorNotReadyError(e)) return t('common.torNotReady')
    e = (e as { cause?: unknown }).cause
  }
  logOnce(err)
  return fallback
}
