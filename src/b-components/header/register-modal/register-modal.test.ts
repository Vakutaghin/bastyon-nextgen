// Регистрация: занятое имя ловится до капчи, а повтор после отказа ноды идёт с
// теми же ключами и без второго запроса монет (иначе сервер раздачи отвечал
// iplimit). Корень бага — ответ getuseraddress приходит конвертом { result, data }.

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  rpcCallArray: vi.fn(),
  requestUnspents: vi.fn(),
  auth: {
    getUserAddress: null as string | null,
    isUserAuthenticated: false,
    register: vi.fn(),
    discardRegistration: vi.fn(),
    resetAuthOnRegistrationError: vi.fn(),
  },
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/request', () => ({ rpcCallArray: mocks.rpcCallArray }))
vi.mock('@/blockchain/api/free-balance-api', () => ({ requestUnspents: mocks.requestUnspents }))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: vi.fn() }))
vi.mock('@/components/modal/modal.vue', () => ({
  default: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.default?.(), slots.footer?.()]),
  }),
}))
vi.mock('@/components/button/button.vue', () => ({
  default: defineComponent({
    props: { disabled: Boolean, loading: Boolean, type: String },
    emits: ['click'],
    setup:
      (props, { slots, emit }) =>
      () =>
        h(
          'button',
          { 'data-type': props.type, disabled: props.disabled, onClick: () => emit('click') },
          slots.default?.()
        ),
  }),
}))

import {
  loadPendingRegistration,
  savePendingRegistration,
} from '@/blockchain/storage/pending-registration'
import RegisterModal from './register-modal.vue'

const NAME_TAKEN = 'Это имя уже занято'

function mountModal() {
  return mount(RegisterModal, { props: { open: false }, global: { plugins: [i18n] } })
}

async function open(w: ReturnType<typeof mountModal>): Promise<void> {
  await w.setProps({ open: true })
}

function registerButton(w: ReturnType<typeof mountModal>) {
  return w.find('button[data-type="primary"]')
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  mocks.rpcCallArray.mockReset().mockResolvedValue([])
  mocks.requestUnspents.mockReset().mockResolvedValue({ action: 'a' })
  mocks.auth.getUserAddress = null
  mocks.auth.isUserAuthenticated = false
  mocks.auth.register.mockReset().mockImplementation(async () => {
    mocks.auth.getUserAddress = 'PNEW'
    return { address: 'PNEW' }
  })
  mocks.auth.discardRegistration.mockReset()
  mocks.auth.resetAuthOnRegistrationError.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('register-modal', () => {
  it('занятое имя — ошибка до ключей и капчи, сессия не тронута', async () => {
    mocks.rpcCallArray.mockResolvedValue([{ name: 'bob', address: 'POTHER' }])
    const w = mountModal()
    await open(w)
    await w.find('#register-nickname').setValue('bob')
    await registerButton(w).trigger('click')
    await flushPromises()

    expect(mocks.rpcCallArray).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'getuseraddress', parameters: ['bob'] })
    )
    // Одно сообщение — подсказка под полем, без дубля в плашке.
    expect(w.text().split(NAME_TAKEN).length - 1).toBe(1)
    expect(mocks.auth.register).not.toHaveBeenCalled()
    expect(mocks.requestUnspents).not.toHaveBeenCalled()
    expect(mocks.auth.resetAuthOnRegistrationError).not.toHaveBeenCalled()
  })

  it('занятость видна, пока имя набирают: подсказка и кнопка выключена', async () => {
    vi.useFakeTimers()
    mocks.rpcCallArray.mockResolvedValue([{ name: 'bob', address: 'POTHER' }])
    const w = mountModal()
    await open(w)
    await w.find('#register-nickname').setValue('bob')
    await vi.advanceTimersByTimeAsync(600)

    expect(w.text()).toContain(NAME_TAKEN)
    expect(registerButton(w).attributes('disabled')).toBeDefined()
  })

  it('свободное имя: новые ключи, запрос монет, validation', async () => {
    const w = mountModal()
    await open(w)
    await w.find('#register-nickname').setValue('alice')
    await registerButton(w).trigger('click')
    await flushPromises()

    expect(mocks.auth.register).toHaveBeenCalledOnce()
    expect(mocks.requestUnspents).toHaveBeenCalledWith('PNEW', { reason: 'registration' })
    expect(w.emitted('validation')?.[0]).toEqual([
      { status: 'in_progress_transaction', nickname: 'alice' },
    ])
    expect(loadPendingRegistration()).toMatchObject({ address: 'PNEW', step: 2 })
  })

  it('повтор после отказа ноды: те же ключи, монеты второй раз не просит', async () => {
    mocks.auth.getUserAddress = 'PA'
    mocks.auth.isUserAuthenticated = true
    savePendingRegistration({
      nickname: 'bob',
      address: 'PA',
      step: 2,
      timestamp: Date.now(),
      error: '{"code":18}',
    })
    const w = mountModal()
    await open(w)
    // Причина прошлого отказа — словами, а не кодом ноды.
    expect(w.text()).toContain('это имя уже занято')

    await w.find('#register-nickname').setValue('alice')
    await registerButton(w).trigger('click')
    await flushPromises()

    expect(mocks.auth.register).not.toHaveBeenCalled()
    expect(mocks.auth.discardRegistration).not.toHaveBeenCalled()
    expect(mocks.requestUnspents).not.toHaveBeenCalled()
    expect(w.emitted('validation')?.[0]).toEqual([
      { status: 'in_progress_transaction', nickname: 'alice' },
    ])
    const pending = loadPendingRegistration()
    expect(pending).toMatchObject({ address: 'PA', nickname: 'alice', step: 2 })
    expect(pending?.error).toBeUndefined()
  })

  it('отмена повтора во время проверки имени не теряет ключи с монетами', async () => {
    mocks.auth.getUserAddress = 'PA'
    mocks.auth.isUserAuthenticated = true
    savePendingRegistration({
      nickname: 'bob',
      address: 'PA',
      step: 2,
      timestamp: Date.now(),
      error: 'NicknameDouble',
    })
    let answer!: (v: unknown[]) => void
    mocks.rpcCallArray.mockImplementation(() => new Promise((r) => (answer = r)))
    const w = mountModal()
    await open(w)
    await w.find('#register-nickname').setValue('alice')
    await registerButton(w).trigger('click')
    await flushPromises()
    expect(answer).toBeTypeOf('function')
    // «Отмена», пока нода отвечает на проверку имени.
    await w.find('button[data-type="default"]').trigger('click')
    answer([])
    await flushPromises()

    expect(w.emitted('cancel')).toBeTruthy()
    expect(mocks.auth.discardRegistration).not.toHaveBeenCalled()
    expect(loadPendingRegistration()).toMatchObject({ address: 'PA', step: 2 })
  })

  it('повтор после ошибки запроса монет (step 1): те же ключи, монеты просит снова', async () => {
    mocks.auth.getUserAddress = 'PA'
    mocks.auth.isUserAuthenticated = true
    savePendingRegistration({ nickname: 'bob', address: 'PA', step: 1, timestamp: Date.now() })
    const w = mountModal()
    await open(w)
    await w.find('#register-nickname').setValue('carol')
    await registerButton(w).trigger('click')
    await flushPromises()

    expect(mocks.auth.register).not.toHaveBeenCalled()
    expect(mocks.requestUnspents).toHaveBeenCalledWith('PA', { reason: 'registration' })
    expect(loadPendingRegistration()).toMatchObject({ address: 'PA', nickname: 'carol', step: 2 })
  })
})
