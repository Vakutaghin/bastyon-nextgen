/**
 * Singleton-контроллер платёжного модала миниапп.
 *
 * Архитектура: модуль-уровневый reactive state + Promise-based API.
 * `openPaymentModal(payload)` поднимает флажок `isOpen`, монтированный в src.vue
 * <MiniAppPaymentModal> подхватывает payload и рендерит UI. Confirm/Cancel
 * разрезолвливают Promise.
 *
 * Это даёт host-context'у синхронный async-API: `host.openPaymentDialog(data)`
 * → `await openPaymentModal(parsed)` → результат в legacy-формате (см. ниже).
 *
 * Параллельный второй вызов гасится сразу с `payment_modal_busy`, чтобы
 * злонамеренная миниаппа не открыла серию диалогов поверх друг друга.
 * См. CODE_AUDIT.md §9.1 + MINIAPPS_PLAN.md §1.3 (5.5).
 */

import { ref, computed } from 'vue'
import { z } from 'zod'

const RecieverSchema = z.object({
  address: z.string().min(1).max(128),
  amount: z.number().positive(),
  message: z.string().max(256).optional(),
})

export const PaymentPayloadSchema = z
  .object({
    recievers: z.array(RecieverSchema).min(1).max(64),
    feemode: z.enum(['include', 'exclude']).optional(),
    message: z.string().max(256).optional(),
  })
  .passthrough()

export type PaymentReciever = z.infer<typeof RecieverSchema>
export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>

/**
 * Результат в формате, который ожидает legacy SDK `actionHelper`
 * (см. mini-apps/actions/payment.ts: !transaction → relay=true, etc.).
 */
export interface PaymentResult {
  transaction?: string
  completed?: boolean
  rejected?: boolean
  reason?: string
}

const isOpenRef = ref(false)
const currentPaymentRef = ref<PaymentPayload | null>(null)
let currentResolve: ((r: PaymentResult) => void) | null = null

export const isPaymentModalOpen = computed(() => isOpenRef.value)
export const currentPaymentPayload = computed(() => currentPaymentRef.value)

/** Открывает модал и возвращает Promise с результатом подтверждения / отказа. */
export function openPaymentModal(raw: unknown): Promise<PaymentResult> {
  const parsed = PaymentPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return Promise.resolve({
      rejected: true,
      reason: `payment_invalid_payload:${parsed.error.issues[0]?.message ?? 'unknown'}`,
    })
  }
  if (isOpenRef.value) {
    return Promise.resolve({ rejected: true, reason: 'payment_modal_busy' })
  }

  currentPaymentRef.value = parsed.data
  isOpenRef.value = true
  return new Promise<PaymentResult>((resolve) => {
    currentResolve = resolve
  })
}

/** Резолвит активный модал. Вызывается из mini-app-payment-modal.vue. */
export function resolvePaymentModal(result: PaymentResult): void {
  isOpenRef.value = false
  currentPaymentRef.value = null
  const r = currentResolve
  currentResolve = null
  if (r) r(result)
}

/** Используется в тестах, чтобы сбросить состояние между запусками. */
export function _resetPaymentModalForTests(): void {
  isOpenRef.value = false
  currentPaymentRef.value = null
  if (currentResolve) {
    currentResolve({ rejected: true, reason: 'reset' })
    currentResolve = null
  }
}
