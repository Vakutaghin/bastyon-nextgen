/**
 * HostContext methods: payment-диалог и ext-платежи.
 *
 * `openPaymentDialog` поднимает singleton-модал через
 * [payment-modal-controller.ts](../../ui/payment-modal-controller.ts) и ждёт
 * подтверждения или отказа пользователя. Сам модал отрисовывается в src.vue.
 *
 * `openExternalPayment` всё ещё stub — для него нужен парсер `ext`-хеша
 * legacy-формата (см. MINIAPPS_PLAN.md §1.3). Поднимем когда понадобится
 * совместимость с конкретной миниаппой.
 */

import type { HostContext } from '../host-context'
import { openPaymentModal } from '../../ui/payment-modal-controller'

export type PaymentMethods = Pick<HostContext, 'openPaymentDialog' | 'openExternalPayment'>

export function createPaymentMethods(): PaymentMethods {
  return {
    openPaymentDialog: async (payment) => {
      const result = await openPaymentModal(payment)
      // Возвращаем как Record — формат совместим с legacy SDK actionHelper:
      //   transaction (txid) → relay=true (после post-process)
      //   rejected=true → миниаппа покажет ошибку
      return result as unknown as Record<string, unknown>
    },

    openExternalPayment: async (_extHash) => {
      throw new Error('ext_payment_not_implemented')
    },
  }
}
