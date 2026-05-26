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
 * Мы возвращаем результат HostContext'а как есть — `actionHelper` живёт на стороне SDK
 * миниаппы, не нашей.
 *
 * MVP-замечание: `openPaymentDialog` сейчас возвращает `{rejected: true}` со
 * `reason: 'payment_ui_not_implemented'` — миниаппа корректно обработает это
 * как отказ от платежа, а не зависнет.
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const payment: ActionDefinition<unknown, Record<string, unknown>> = {
  schema: ActionSchemas.payment,
  permissions: ['account', 'payment'],
  authorization: true,
  rateLimitClass: 'expensive',
  handler: async ({ data, host }) => host.openPaymentDialog(data),
}

const ext: ActionDefinition<{ ext: string }, string> = {
  schema: ActionSchemas.ext,
  // Permissions не объявлены в legacy — `ext` open другую миниаппу/диалог,
  // авторизация не требуется (это вход в платёжный flow, не сам платёж).
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    await host.openExternalPayment(data.ext)
    return 'application:ext:opened'
  },
}

export const PAYMENT_ACTIONS = {
  payment,
  ext,
} as const satisfies ActionMap
