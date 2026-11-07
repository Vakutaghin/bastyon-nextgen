/**
 * HostContext methods: payment-диалог и ext-платежи.
 *
 * `openPaymentDialog` поднимает singleton-модал через
 * [payment-modal-controller.ts](../../ui/payment-modal-controller.ts) и ждёт
 * подтверждения или отказа пользователя. Сам модал отрисовывается в src.vue.
 * Отправленный платёж записывается действием приложения (tx/app-actions):
 * ответ — объект действия, как `makeAction` прежнего клиента, а когда перевод
 * попадёт в блок, приложению придёт событие `action`.
 *
 * `openExternalPayment` всё ещё stub — для него нужен парсер `ext`-хеша
 * legacy-формата (см. MINIAPPS_PLAN.md §1.3). Поднимем когда понадобится
 * совместимость с конкретной миниаппой.
 */

import type { HostContext } from '../host-context'
import { openPaymentModal } from '../../ui/payment-modal-controller'
import { exportAction, recordSentAction } from '../../tx/app-actions'

export type PaymentMethods = Pick<HostContext, 'openPaymentDialog' | 'openExternalPayment'>

export interface PaymentDeps {
  getUserAddress: () => string | null
}

export function createPaymentMethods(deps: PaymentDeps): PaymentMethods {
  return {
    openPaymentDialog: async (payment, appName, appId, signal) => {
      const result = await openPaymentModal(payment, appName, signal)
      const owner = deps.getUserAddress()
      if (!result.transaction || !owner || !appId) {
        return result as unknown as Record<string, unknown>
      }
      const p = (payment ?? {}) as Record<string, unknown>
      const record = recordSentAction({
        application: appId,
        owner,
        type: 'transaction',
        expObject: {
          type: 'transaction',
          source: [owner],
          recievers: p.recievers ?? null,
          feemode: p.feemode ?? null,
          message: typeof p.message === 'string' ? p.message : '',
        },
        transaction: result.transaction,
      })
      return exportAction(record)
    },

    openExternalPayment: async (_extHash) => {
      throw new Error('ext_payment_not_implemented')
    },
  }
}
