/**
 * HostContext methods: payment-диалог и ext-платежи.
 *
 * MVP — заглушки; реальный wallet UI nextgen (этап 7+) заменит на полноценные
 * реализации с подтверждением транзакции пользователем.
 */

import type { HostContext } from '../host-context'

export type PaymentMethods = Pick<HostContext, 'openPaymentDialog' | 'openExternalPayment'>

export function createPaymentMethods(): PaymentMethods {
  return {
    openPaymentDialog: async (_payment) => {
      // TODO(etap 7+): подключить wallet UI nextgen. Возвращаем «rejected» в legacy-формате,
      // чтобы миниаппа корректно отреагировала вместо повисания.
      return { rejected: true, reason: 'payment_ui_not_implemented' }
    },

    openExternalPayment: async (_extHash) => {
      throw new Error('ext_payment_not_implemented')
    },
  }
}
