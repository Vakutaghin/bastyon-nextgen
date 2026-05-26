import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionRegistry } from './registry'
import { PAYMENT_ACTIONS } from './payment'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

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

  it('delegates to host.openPaymentDialog and returns its result', async () => {
    const openPaymentDialog = vi.fn(async () => ({ rejected: true, reason: 'user' }))
    const { reg } = setup({ openPaymentDialog })
    const r = await reg.execute(
      'payment',
      TEST_APP,
      { recievers: [{ address: 'addr', amount: 1 }], feemode: 'fast' },
      new AbortController().signal
    )

    expect(r).toEqual({ rejected: true, reason: 'user' })
    expect(openPaymentDialog).toHaveBeenCalledOnce()
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

  it('opens external payment by hash', async () => {
    const openExternalPayment = vi.fn(async () => {})
    const { reg } = setup({ openExternalPayment })
    const r = await reg.execute('ext', TEST_APP, { ext: '_aabbcc' }, new AbortController().signal)
    expect(r).toBe('application:ext:opened')
    expect(openExternalPayment).toHaveBeenCalledWith('_aabbcc')
  })

  it('propagates host error when not implemented', async () => {
    const { reg } = setup({
      openExternalPayment: vi.fn(async () => {
        throw new Error('ext_payment_not_implemented')
      }),
    })
    await expect(
      reg.execute('ext', TEST_APP, { ext: '_x' }, new AbortController().signal)
    ).rejects.toThrow(/ext_payment_not_implemented/)
  })

  it('rejects empty ext string', async () => {
    const { reg } = setup()
    await expect(
      reg.execute('ext', TEST_APP, { ext: '' }, new AbortController().signal)
    ).rejects.toThrow(/invalid_params/)
  })
})
