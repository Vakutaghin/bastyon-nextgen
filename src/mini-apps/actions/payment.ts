/**
 * Payment handlers (этап 5.5):
 *
 * - `payment` — открыть платёжный диалог и вернуть результат
 * - `ext` — открыть закодированный платёж (sdk.ext(payment))
 *
 * Legacy эквиваленты:
 * - [index.js:494-512](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L494-L512)
 * - [index.js:245-272](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L245-L272)
 *
 * Legacy `actionHelper` ([sdk.js:111-118](../../../../___original-repos/pocketnet.gui/js/lib/apps/sdk.js#L111-L118))
 * пост-обрабатывает результат:
 * - `!transaction` → `relay = true` (отправлен в мемпул)
 * - `transaction && !completed && !rejected` → `temp = true` (ждёт подтверждения)
 *
 * Отправленный платёж приходит объектом действия (tx/app-actions), отказ и
 * отмена — отказом промиса, как у прежнего клиента.
 */

import { ActionSchemas } from './_schema'
import { LegacyRpcError } from '../core/bridge-helpers'
import { USER_WAIT_TIMEOUT_MS, type ActionDefinition, type ActionMap } from './types'

const payment: ActionDefinition<unknown, Record<string, unknown>> = {
  schema: ActionSchemas.payment,
  permissions: ['account', 'payment'],
  authorization: true,
  rateLimitClass: 'expensive',
  // Имя приложения — в модал: без него строка «Запросило: …» никогда не
  // показывалась, и пользователь не видел, кто инициировал платёж (N22).
  // Человек читает окно оплаты и решает: общих 30 секунд моста мало — по
  // истечении приложение получало тайм-аут, а окно оставалось и платило.
  timeoutMs: USER_WAIT_TIMEOUT_MS,
  handler: async ({ data, app, host, signal }) => {
    const result = await host.openPaymentDialog(data, app.manifest.name, app.manifest.id, signal)
    // Как у прежнего клиента (rejectIfError): отказ — отказом промиса, отмена —
    // строкой 'cancel'. Раньше отказ приходил успешным ответом без transaction,
    // и Barteron в безопасной сделке говорил «перевод выполнен».
    if (result.rejected) {
      const reason = typeof result.reason === 'string' ? result.reason : ''
      throw new LegacyRpcError(reason === 'user_cancelled' ? 'cancel' : reason || 'rejected')
    }
    return result
  },
}

const ext: ActionDefinition<{ ext: string }, string> = {
  schema: ActionSchemas.ext,
  // Permissions не объявлены в legacy: платёж идёт магазину из ссылки, и
  // окно оплаты показывает получателя, сумму и магазин. Без входа платить
  // нечем — окно скажет «требуется авторизация».
  rateLimitClass: 'normal',
  handler: async ({ data, app, host }) =>
    host.openExternalPayment(data.ext, app.manifest.name, app.manifest.id),
}

export const PAYMENT_ACTIONS = {
  payment,
  ext,
} as const satisfies ActionMap
