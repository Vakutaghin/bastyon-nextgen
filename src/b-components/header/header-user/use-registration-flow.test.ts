// Флоу регистрации в шапке: V10 (pending только своего адреса), S13 («часики»
// только при своей pending-записи, отказ ноды виден), S12 (сид после перезагрузки).

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'

const mocks = vi.hoisted(() => ({
  getRegistrationStatus: vi.fn(),
  sendTx: vi.fn(),
  loadAccountMnemonic: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}))
vi.mock('@/blockchain/api/registration-status', () => ({
  getRegistrationStatus: mocks.getRegistrationStatus,
  isRegistrationInProgress: (s: string) => s.startsWith('in_progress'),
}))
vi.mock('@/blockchain/registration/user-info-tx', () => ({
  sendRegistrationUserInfoTx: mocks.sendTx,
}))
vi.mock('@/b-components/header/account-switcher/helpers/load-account-mnemonic', () => ({
  loadAccountMnemonic: mocks.loadAccountMnemonic,
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: {
    error: mocks.toastError,
    warning: mocks.toastWarning,
    success: vi.fn(),
    info: vi.fn(),
  },
}))
vi.mock('@/i18n', () => ({
  t: (k: string, p?: Record<string, unknown>) => `${k}${p ? ':' + JSON.stringify(p) : ''}`,
}))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: vi.fn() }))

import {
  savePendingRegistration,
  loadPendingRegistration,
} from '@/blockchain/storage/pending-registration'
import { setNeedShowMnemonic, shouldShowMnemonic } from '@/helpers/common/mnemonic-storage'
import {
  pendingForAddress,
  useRegistrationFlow,
  type RegistrationFlow,
} from './use-registration-flow'

const pending = { nickname: 'bob', address: 'PB', step: 2, timestamp: 1 }

describe('pendingForAddress (V10)', () => {
  it('отдаёт запись только для того же адреса', () => {
    expect(pendingForAddress(pending, 'PB')).toBe(pending)
    expect(pendingForAddress(pending, 'PC')).toBeNull()
    expect(pendingForAddress(pending, null)).toBeNull()
    expect(pendingForAddress(null, 'PB')).toBeNull()
  })
})

function makeAuth(address: string | null) {
  return {
    address,
    getUserAddress: address,
    getKeyPair: address ? { privateKey: 'k' } : null,
    restoreSession: vi.fn(async () => true),
    fetchUserState: vi.fn(async () => null),
    resetMessenger: vi.fn(async () => {}),
  }
}

const mounted: Array<{ unmount: () => void }> = []
const settle = () => new Promise((r) => setTimeout(r, 10))

function mountFlow(auth: ReturnType<typeof makeAuth>): RegistrationFlow {
  let flow!: RegistrationFlow
  const harness = defineComponent({
    setup() {
      flow = useRegistrationFlow({ authStore: auth as never, isAuthenticated: ref(!!auth.address) })
      return () => h('div')
    },
  })
  mounted.push(mount(harness))
  return flow
}

describe('useRegistrationFlow', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memStorage())
    mocks.getRegistrationStatus.mockReset().mockResolvedValue('in_progress_transaction')
    mocks.sendTx.mockReset().mockResolvedValue({ outcome: 'sent', txid: 't' })
    mocks.loadAccountMnemonic
      .mockReset()
      .mockResolvedValue({ mnemonic: 'w1 w2', privateKeyHex: 'hex' })
    mocks.toastError.mockReset()
    mocks.toastWarning.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  it('S13: без своей pending-записи статус с ноды не поллится и часиков нет', async () => {
    const flow = mountFlow(makeAuth('PA'))
    await settle()
    expect(flow.registrationPending.value).toBe(false)
    expect(mocks.getRegistrationStatus).not.toHaveBeenCalled()
  })

  it('своя pending step=2 после перезагрузки: часики, поллинг и досыл tx одним путём', async () => {
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 2, timestamp: Date.now() })
    const flow = mountFlow(makeAuth('PA'))
    await settle()
    expect(flow.registrationPending.value).toBe(true)
    expect(flow.pendingNickname.value).toBe('bob')
    expect(mocks.getRegistrationStatus).toHaveBeenCalled()
    expect(mocks.sendTx).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'PA', nickname: 'bob', waitForFunds: false })
    )
  })

  it('pending с ошибкой ноды: ни часиков, ни поллинга (S13)', async () => {
    savePendingRegistration({
      nickname: 'bob',
      address: 'PA',
      step: 2,
      timestamp: Date.now(),
      error: 'NicknameDouble',
    })
    const flow = mountFlow(makeAuth('PA'))
    await settle()
    expect(flow.registrationPending.value).toBe(false)
    expect(mocks.getRegistrationStatus).not.toHaveBeenCalled()
  })

  it('отказ ноды при отправке из модалки: часики снимаются, тост с причиной, pending остаётся', async () => {
    mocks.sendTx.mockResolvedValue({ outcome: 'fatal', message: 'NicknameDouble' })
    const auth = makeAuth('PA')
    const flow = mountFlow(auth)
    await settle()
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 2, timestamp: Date.now() })
    flow.handleRegisterValidation({
      status: 'in_progress_transaction',
      mnemonic: 'w1 w2',
      nickname: 'bob',
    })
    expect(flow.registrationPending.value).toBe(true)
    await settle()
    expect(flow.registrationPending.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith({
      message: 'accountMsg.registrationRejected:{"message":"NicknameDouble"}',
    })
    expect(loadPendingRegistration()).not.toBeNull()
  })

  it('S12: регистрация завершилась, пока приложение было закрыто — сид поднимается из хранилища', async () => {
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 3, timestamp: Date.now() })
    setNeedShowMnemonic('PA')
    mocks.getRegistrationStatus.mockResolvedValue('registered')
    const flow = mountFlow(makeAuth('PA'))
    await settle()
    expect(flow.registrationPending.value).toBe(false)
    expect(loadPendingRegistration()).toBeNull()
    expect(mocks.loadAccountMnemonic).toHaveBeenCalledWith('PA')
    expect(flow.mnemonicModalOpen.value).toBe(true)
    expect(flow.mnemonic.value).toBe('w1 w2')
    // Закрыли — флаг снят, повторно не покажем.
    flow.handleMnemonicModalClose()
    expect(shouldShowMnemonic('PA')).toBe(false)
  })

  it('S12: сид не показан ранее, регистрации нет — показ через 3 с после загрузки', async () => {
    vi.useFakeTimers()
    setNeedShowMnemonic('PA')
    const flow = mountFlow(makeAuth('PA'))
    await vi.advanceTimersByTimeAsync(50)
    expect(flow.mnemonicModalOpen.value).toBe(false)
    await vi.advanceTimersByTimeAsync(3100)
    expect(flow.mnemonicModalOpen.value).toBe(true)
    vi.useRealTimers()
  })

  it('V10: чужая pending-запись не вешает часики и не стирается', async () => {
    savePendingRegistration({ nickname: 'ann', address: 'PB', step: 2, timestamp: Date.now() })
    const flow = mountFlow(makeAuth('PA'))
    await settle()
    expect(flow.registrationPending.value).toBe(false)
    expect(loadPendingRegistration()).toMatchObject({ address: 'PB' })
  })
})
