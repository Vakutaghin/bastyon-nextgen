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
import { isValidAddress } from '@/blockchain/core/addresses/address-validator'
import { DUST_VALUE } from '@/blockchain/constants/transactions'

const RecieverSchema = z.object({
  // Адрес проверяем по-настоящему (N22): `min(1)` пропускал любую строку, и
  // опечатка миниаппы доезжала до подписи транзакции.
  address: z
    .string()
    .min(1)
    .max(128)
    .refine((a) => isValidAddress(a), { message: 'invalid_address' }),
  // `positive()` пропускал 1e-9 — такой выход всё равно сгорел бы как пыль,
  // а пользователь видел бы платёж «почти ноль» с полной комиссией.
  amount: z.number().min(DUST_VALUE, { message: 'amount_below_dust' }),
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
  /** Почта и телефон, если магазин их просил (платёж по ссылке). */
  contacts?: { email?: string; phone?: string }
}

/**
 * Платёж по ссылке магазина (`ext`): что показать сверх получателя и суммы и
 * что спросить у покупателя.
 */
export interface PaymentDetails {
  description?: string
  store?: { name: string; site?: string }
  items?: Array<{ name: string; value: number; count: number }>
  /** Ссылка перестаёт действовать (мс): после этого платить нельзя. */
  expiresAt?: number
  /** Кому сообщат об оплате и сообщат ли адрес покупателя. */
  callbackHost?: string
  sharesAccount?: boolean
  askEmail?: boolean
  askPhone?: boolean
}

const isOpenRef = ref(false)
const currentPaymentRef = ref<PaymentPayload | null>(null)
const currentAppNameRef = ref<string>('')
const currentDetailsRef = ref<PaymentDetails | null>(null)
let currentResolve: ((r: PaymentResult) => void) | null = null

export const isPaymentModalOpen = computed(() => isOpenRef.value)
export const currentPaymentPayload = computed(() => currentPaymentRef.value)
/** Имя приложения, запросившего платёж — для строки «Запросило: …» (N22). */
export const currentPaymentAppName = computed(() => currentAppNameRef.value)
/** Сведения платежа по ссылке магазина; null — обычный платёж приложения. */
export const currentPaymentDetails = computed(() => currentDetailsRef.value)

/** Окно оплаты уже открыто: второе поверх не открывается. */
export function paymentModalBusy(): boolean {
  return isOpenRef.value
}

/**
 * Открывает модал и возвращает Promise с результатом подтверждения / отказа.
 * `signal` — запрос приложения отменён (приложение закрыли): окно закрывается,
 * иначе человек мог бы заплатить тому, кто ответа уже не ждёт.
 */
export function openPaymentModal(
  raw: unknown,
  appName = '',
  signal?: AbortSignal,
  details: PaymentDetails | null = null
): Promise<PaymentResult> {
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
  currentAppNameRef.value = appName
  currentDetailsRef.value = details
  isOpenRef.value = true
  return new Promise<PaymentResult>((resolve) => {
    currentResolve = resolve
    signal?.addEventListener(
      'abort',
      () => {
        if (currentResolve === resolve) resolvePaymentModal({ rejected: true, reason: 'aborted' })
      },
      { once: true }
    )
  })
}

/** Резолвит активный модал. Вызывается из mini-app-payment-modal.vue. */
export function resolvePaymentModal(result: PaymentResult): void {
  isOpenRef.value = false
  currentPaymentRef.value = null
  currentAppNameRef.value = ''
  currentDetailsRef.value = null
  const r = currentResolve
  currentResolve = null
  if (r) r(result)
}

/** Используется в тестах, чтобы сбросить состояние между запусками. */
export function _resetPaymentModalForTests(): void {
  isOpenRef.value = false
  currentPaymentRef.value = null
  currentAppNameRef.value = ''
  currentDetailsRef.value = null
  if (currentResolve) {
    currentResolve({ rejected: true, reason: 'reset' })
    currentResolve = null
  }
}
