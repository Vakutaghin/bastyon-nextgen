import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { PAYMENT_ACTIONS } from './payment'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'
import { LegacyRpcError, normalizeError } from '../core/bridge-helpers'

function setup(hostOverrides = {}, resolverOpts = {}) {
  const host = makeMockHost(hostOverrides)
  const resolver = makeResolver(resolverOpts)
  const reg = new ActionRegistry({ host, resolver, actions: PAYMENT_ACTIONS })
  return { reg, host, resolver }
}

describe('payment action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  const PAYMENT = { recievers: [{ address: 'addr', amount: 1 }], feemode: 'fast' }

  it('отправленный платёж — объект действия от хоста; хост знает приложение', async () => {
    const action = { id: 'act', transaction: 'f'.repeat(64), completed: false }
    const openPaymentDialog = vi.fn(async () => action)
    const { reg } = setup({ openPaymentDialog })
    const r = await reg.execute('payment', TEST_APP, PAYMENT, new AbortController().signal)
    expect(r).toEqual(action)
    expect(openPaymentDialog).toHaveBeenCalledWith(
      expect.objectContaining({ feemode: 'fast' }),
      TEST_APP.manifest.name,
      TEST_APP.manifest.id,
      expect.any(AbortSignal)
    )
  })

  it('отмена — отказ строкой "cancel", как у прежнего клиента (Barteron ждёт error === "cancel")', async () => {
    const { reg } = setup({
      openPaymentDialog: vi.fn(async () => ({ rejected: true, reason: 'user_cancelled' })),
    })
    const err = await reg
      .execute('payment', TEST_APP, PAYMENT, new AbortController().signal)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LegacyRpcError)
    expect(normalizeError(err, new AbortController().signal)).toBe('cancel')
  })

  it('другой отказ — его причина строкой, не успешный ответ', async () => {
    const { reg } = setup({
      openPaymentDialog: vi.fn(async () => ({ rejected: true, reason: 'payment_modal_busy' })),
    })
    await expect(
      reg.execute('payment', TEST_APP, PAYMENT, new AbortController().signal)
    ).rejects.toThrow('payment_modal_busy')
  })

  it('requires authorization', async () => {
    const { reg } = setup({ isUserAuthenticated: () => false })
    await expect(
      reg.execute('payment', TEST_APP, { recievers: [] }, new AbortController().signal)
    ).rejects.toThrow(/required_authorization/)
  })

  it('requires account+payment permissions', async () => {
    const { reg } = setup({}, { auto: false })
    await expect(
      reg.execute('payment', TEST_APP, { recievers: [] }, new AbortController().signal)
    ).rejects.toThrow(/permission_denied/)
  })

  it('rejects missing recievers (legacy spelling)', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('payment', TEST_APP, { feemode: 'fast' }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })
})

describe('ext action', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  it('платёж по ссылке — хосту с именем и id приложения', async () => {
    const openExternalPayment = vi.fn(async () => 'application:ext:opened')
    const { reg } = setup({ openExternalPayment })
    const r = await reg.execute('ext', TEST_APP, { ext: '_aabbcc' }, new AbortController().signal)
    expect(r).toBe('application:ext:opened')
    expect(openExternalPayment).toHaveBeenCalledWith(
      '_aabbcc',
      TEST_APP.manifest.name,
      TEST_APP.manifest.id
    )
  })

  it('плохая ссылка — отказ хоста доходит до приложения', async () => {
    const { reg } = setup({
      openExternalPayment: vi.fn(async () => {
        throw new Error('application:ext:notopened')
      }),
    })
    await expect(
      reg.execute('ext', TEST_APP, { ext: '_x' }, new AbortController().signal)
    ).rejects.toThrow(/application:ext:notopened/)
  })

  it('rejects empty ext string', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('ext', TEST_APP, { ext: '' }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })
})
