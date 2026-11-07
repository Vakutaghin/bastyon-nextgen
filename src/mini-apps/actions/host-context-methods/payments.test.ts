import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPaymentMethods } from './payments'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { _resetAppActionsForTests, appActions } from '../../tx/app-actions'
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
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    _resetAppActionsForTests()
  })
  afterEach(() => vi.unstubAllGlobals())

  const deps = { getUserAddress: () => 'PUser' }

  it('отправленный платёж — действие приложения в форме прежнего клиента', async () => {
    openPaymentModalMock.mockResolvedValueOnce({ transaction: 'txid-123', completed: true })
    const methods = createPaymentMethods(deps)

    const payment = { recievers: [{ address: 'ADDR', amount: 1 }], feemode: 'include' }
    const out = await methods.openPaymentDialog(payment as never, 'Demo app', 'demo.app')

    // Имя приложения едет в модал вместе с payload (N22).
    expect(openPaymentModalMock).toHaveBeenCalledWith(payment, 'Demo app', undefined)
    // Блока ещё нет: completed придёт событием action, как у прежнего клиента.
    expect(out).toMatchObject({
      transaction: 'txid-123',
      completed: false,
      settings: { application: 'demo.app' },
      expObject: { type: 'transaction', recievers: payment.recievers, feemode: 'include' },
    })
    expect(appActions('PUser', 'demo.app')).toHaveLength(1)
  })

  it('пробрасывает rejected-результат (отказ пользователя), действия не пишет', async () => {
    openPaymentModalMock.mockResolvedValueOnce({ rejected: true, reason: 'payment_modal_busy' })
    const methods = createPaymentMethods(deps)

    const out = await methods.openPaymentDialog({} as never, 'Demo app', 'demo.app')

    expect(out).toEqual({ rejected: true, reason: 'payment_modal_busy' })
    expect(appActions('PUser', 'demo.app')).toHaveLength(0)
  })
})

describe('openExternalPayment', () => {
  it('бросает ext_payment_not_implemented (stub)', async () => {
    const methods = createPaymentMethods({ getUserAddress: () => null })

    await expect(methods.openExternalPayment('ext-hash' as never)).rejects.toThrow(
      'ext_payment_not_implemented'
    )
  })
})
