import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPaymentMethods } from './payments'
import { openPaymentModal } from '../../ui/payment-modal-controller'

// payments.ts импортирует openPaymentModal напрямую (не через deps) — мокаем модуль.
vi.mock('../../ui/payment-modal-controller', () => ({
  openPaymentModal: vi.fn(),
}))

const openPaymentModalMock = vi.mocked(openPaymentModal)

beforeEach(() => {
  openPaymentModalMock.mockReset()
})

describe('openPaymentDialog', () => {
  it('делегирует payload в openPaymentModal и возвращает результат', async () => {
    const result = { transaction: 'txid-123', completed: true }
    openPaymentModalMock.mockResolvedValueOnce(result)
    const methods = createPaymentMethods()

    const payment = { recievers: [{ address: 'ADDR', amount: 1 }] }
    const out = await methods.openPaymentDialog(payment as never)

    expect(openPaymentModalMock).toHaveBeenCalledTimes(1)
    expect(openPaymentModalMock).toHaveBeenCalledWith(payment)
    expect(out).toBe(result)
  })

  it('пробрасывает rejected-результат (отказ пользователя)', async () => {
    openPaymentModalMock.mockResolvedValueOnce({ rejected: true, reason: 'payment_modal_busy' })
    const methods = createPaymentMethods()

    const out = await methods.openPaymentDialog({} as never)

    expect(out).toEqual({ rejected: true, reason: 'payment_modal_busy' })
  })
})

describe('openExternalPayment', () => {
  it('бросает ext_payment_not_implemented (stub)', async () => {
    const methods = createPaymentMethods()

    await expect(methods.openExternalPayment('ext-hash' as never)).rejects.toThrow(
      'ext_payment_not_implemented',
    )
  })
})
