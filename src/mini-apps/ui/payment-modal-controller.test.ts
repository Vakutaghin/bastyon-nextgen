import { describe, it, expect, beforeEach } from 'vitest'
import {
  openPaymentModal,
  resolvePaymentModal,
  isPaymentModalOpen,
  currentPaymentPayload,
  _resetPaymentModalForTests,
} from './payment-modal-controller'

beforeEach(() => {
  _resetPaymentModalForTests()
})

describe('payment-modal-controller', () => {
  it('rejects malformed payload synchronously without opening modal', async () => {
    const result = await openPaymentModal({ recievers: 'not-an-array' })
    expect(result.rejected).toBe(true)
    expect(result.reason).toMatch(/^payment_invalid_payload:/)
    expect(isPaymentModalOpen.value).toBe(false)
  })

  it('rejects missing fields', async () => {
    const result = await openPaymentModal({ recievers: [{ address: 'Pxxx' }] })
    expect(result.rejected).toBe(true)
  })

  it('opens modal for a valid payload and exposes payment', async () => {
    const p = openPaymentModal({
      recievers: [{ address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM', amount: 0.5 }],
    })
    expect(isPaymentModalOpen.value).toBe(true)
    expect(currentPaymentPayload.value?.recievers).toHaveLength(1)

    resolvePaymentModal({ rejected: true, reason: 'user_cancelled' })
    const result = await p
    expect(result.rejected).toBe(true)
    expect(isPaymentModalOpen.value).toBe(false)
  })

  it('parallel calls are gated — second is rejected with payment_modal_busy', async () => {
    const p1 = openPaymentModal({
      recievers: [{ address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM', amount: 1 }],
    })
    const p2 = openPaymentModal({
      recievers: [{ address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM', amount: 2 }],
    })
    const r2 = await p2
    expect(r2.rejected).toBe(true)
    expect(r2.reason).toBe('payment_modal_busy')

    // p1 продолжает ждать резолва
    resolvePaymentModal({ transaction: 'txid_abc', completed: true })
    const r1 = await p1
    expect(r1.transaction).toBe('txid_abc')
  })

  it('clamps feemode to include|exclude only', async () => {
    const r = await openPaymentModal({
      recievers: [{ address: 'PQ', amount: 1 }],
      feemode: 'weird',
    })
    expect(r.rejected).toBe(true)
  })
})
