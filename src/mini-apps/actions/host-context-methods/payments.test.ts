import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPaymentMethods } from './payments'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { _resetAppActionsForTests, appActions } from '../../tx/app-actions'
import { openPaymentModal, paymentModalBusy } from '../../ui/payment-modal-controller'

// payments.ts импортирует openPaymentModal напрямую (не через deps) — мокаем модуль.
vi.mock('../../ui/payment-modal-controller', () => ({
  openPaymentModal: vi.fn(),
  paymentModalBusy: vi.fn(() => false),
}))

const openPaymentModalMock = vi.mocked(openPaymentModal)
const busyMock = vi.mocked(paymentModalBusy)

beforeEach(() => {
  openPaymentModalMock.mockReset()
  busyMock.mockReturnValue(false)
})

/** Хэш ссылки, как его собирает SDK (`PaymentHash.makeURLHash`): JSON → hex. */
function extHash(params: Record<string, unknown>): string {
  const json = JSON.stringify(params)
  let hex = ''
  for (let i = 0; i < json.length; i++) {
    let ch = json.charCodeAt(i)
    if (ch > 0xff) ch -= 0x350
    hex += ch.toString(16).padStart(2, '0')
  }
  return '_' + hex
}

const SHOP = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'

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
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    _resetAppActionsForTests()
  })
  afterEach(() => vi.unstubAllGlobals())

  const make = (over: Partial<Parameters<typeof createPaymentMethods>[0]> = {}) => {
    const deps = {
      getUserAddress: () => 'PUser',
      openComposer: vi.fn(async () => {}),
      notifyMerchant: vi.fn(async () => 'fetch'),
      warn: vi.fn(async () => {}),
      ...over,
    }
    return { deps, methods: createPaymentMethods(deps) }
  }

  const shopLink = {
    a: 'p',
    ad: SHOP,
    i: [
      { n: 'Чай', v: 0.5, c: 2 },
      { n: 'Кружка', v: 1 },
    ],
    de: 'Заказ 42',
    st: { n: 'Лавка', s: 'shop.test' },
    c: 'https://shop.test/paid',
    e: 1,
    pl: { order: 42 },
    h: '123456',
  }

  it('окно оплаты: магазин, товары, сумма, сообщение pay_<h>; ответ — сразу', async () => {
    openPaymentModalMock.mockReturnValueOnce(new Promise(() => {}))
    const { methods } = make()
    const r = await methods.openExternalPayment(extHash(shopLink), 'Demo app', 'demo.app')
    expect(r).toBe('application:ext:opened')
    expect(openPaymentModalMock).toHaveBeenCalledWith(
      { recievers: [{ address: SHOP, amount: 2 }], feemode: 'exclude', message: 'pay_123456' },
      'Demo app',
      undefined,
      {
        description: 'Заказ 42',
        store: { name: 'Лавка', site: 'shop.test' },
        items: [
          { name: 'Чай', value: 0.5, count: 2 },
          { name: 'Кружка', value: 1, count: 1 },
        ],
        callbackHost: 'shop.test',
        sharesAccount: true,
        askEmail: true,
      }
    )
  })

  it('после перевода: действие приложения и сообщение магазину с почтой', async () => {
    let finish: (v: unknown) => void = () => {}
    openPaymentModalMock.mockReturnValueOnce(new Promise((r) => (finish = r)) as never)
    const { deps, methods } = make()
    await methods.openExternalPayment(extHash(shopLink), 'Demo app', 'demo.app')
    finish({ transaction: 'tx-1', completed: true, contacts: { email: 'a@b.c' } })
    await vi.waitFor(() => expect(deps.notifyMerchant).toHaveBeenCalled())
    expect(deps.notifyMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ address: SHOP, value: 2 }),
      'tx-1',
      { email: 'a@b.c' },
      'PUser'
    )
    expect(appActions('PUser', 'demo.app')).toHaveLength(1)
    expect(deps.warn).not.toHaveBeenCalled()
  })

  it('магазин не ответил — предупреждение, перевод уже ушёл', async () => {
    openPaymentModalMock.mockResolvedValueOnce({ transaction: 'tx-2', completed: true })
    const { deps, methods } = make({
      notifyMerchant: vi.fn(async () => {
        throw new Error('merchant_http_500')
      }),
    })
    await methods.openExternalPayment(extHash(shopLink), 'Demo app', 'demo.app')
    await vi.waitFor(() => expect(deps.warn).toHaveBeenCalled())
    expect(String((deps.warn as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain('shop.test')
  })

  it('отменили оплату — магазину ничего', async () => {
    openPaymentModalMock.mockResolvedValueOnce({ rejected: true, reason: 'user_cancelled' })
    const { deps, methods } = make()
    await methods.openExternalPayment(extHash(shopLink), 'Demo app', 'demo.app')
    await new Promise((r) => setTimeout(r, 0))
    expect(deps.notifyMerchant).not.toHaveBeenCalled()
    expect(appActions('PUser', 'demo.app')).toHaveLength(0)
  })

  const rejects = async (hash: string, code: string, message = 'application:ext:notopened') => {
    const { methods } = make()
    const err = await methods.openExternalPayment(hash, 'Demo app', 'demo.app').catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(message)
    if (message === 'application:ext:notopened') expect(err.code).toBe(code)
    expect(openPaymentModalMock).not.toHaveBeenCalled()
  }

  it('битая ссылка — application:ext:notopened с кодом', async () => {
    await rejects('_zz', 'wrong:hash')
    await rejects(extHash({ a: 'p', v: 1 }), 'missing:address')
    await rejects(extHash({ a: 'p', ad: 'nope', v: 1 }), 'wrong:address:notvalid')
  })

  it('вход по ссылке (auth) отключён, как у прежнего клиента', async () => {
    await rejects(extHash({ a: 'a', c: 'https://x.test' }), '', 'application:ext:auth:deprecated')
  })

  it('доставка (s_url) не сделана — отказ, а не оплата без доставки', async () => {
    await rejects(extHash({ ad: SHOP, v: 1, s: 'https://shop.test/ship' }), 'shipment:notsupported')
  })

  it('истёкшая ссылка — отказ', async () => {
    await rejects(extHash({ ad: SHOP, v: 1, d: Date.now() - 120_000, ex: 60 }), 'expired')
  })

  it('окно оплаты занято — отказ', async () => {
    busyMock.mockReturnValue(true)
    await rejects(extHash({ ad: SHOP, v: 1 }), 'busy')
  })

  it('share в ссылке — окно поста с текстом, ссылкой и тегами', async () => {
    const { deps, methods } = make()
    const r = await methods.openExternalPayment(
      extHash({ a: 'share', de: 'Смотрите', u: 'https://x.test/p', tg: ['news'] }),
      'Demo app',
      'demo.app'
    )
    expect(r).toBe('application:ext:opened')
    expect(deps.openComposer).toHaveBeenCalledWith({
      message: 'Смотрите\n\nhttps://x.test/p',
      images: [],
      tags: ['news', 'Demo app'],
    })
  })
})
