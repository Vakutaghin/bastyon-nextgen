import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthMethods, type AuthDeps } from './auth'

// Перехватываем динамический import('@/stores/modal-store') внутри openRegistration.
const openAuthModal = vi.fn()
vi.mock('@/stores/modal-store', () => ({
  useModalStore: () => ({ openAuthModal }),
}))

type AuthState = { keyPair?: unknown; address?: string }

function makeDeps(auth: AuthState, walletAddresses: string[] = []) {
  const generateApiSignature = vi.fn(() => 'SIG')
  const getWalletAddressesList = vi.fn(() => walletAddresses)
  const deps: AuthDeps = {
    useAuthStore: (() => auth) as unknown as AuthDeps['useAuthStore'],
    generateApiSignature: generateApiSignature as unknown as AuthDeps['generateApiSignature'],
    getWalletAddressesList: getWalletAddressesList as unknown as AuthDeps['getWalletAddressesList'],
  }
  return { deps, generateApiSignature, getWalletAddressesList }
}

beforeEach(() => {
  openAuthModal.mockClear()
})

describe('signApiMessage', () => {
  it('делегирует в generateApiSignature с keyPair/address и опциями', () => {
    const { deps, generateApiSignature } = makeDeps({ keyPair: 'KP', address: 'ADDR' })
    const methods = createAuthMethods(deps)

    const result = methods.signApiMessage('payload', { expiration: 42, useOldFormat: true })

    expect(result).toBe('SIG')
    expect(generateApiSignature).toHaveBeenCalledTimes(1)
    expect(generateApiSignature).toHaveBeenCalledWith('KP', 'ADDR', {
      data: 'payload',
      expiration: 42,
      useOldFormat: true,
    })
  })

  it('options по умолчанию = {} → expiration/useOldFormat undefined', () => {
    const { deps, generateApiSignature } = makeDeps({ keyPair: 'KP', address: 'ADDR' })
    const methods = createAuthMethods(deps)

    methods.signApiMessage('payload')

    expect(generateApiSignature).toHaveBeenCalledWith('KP', 'ADDR', {
      data: 'payload',
      expiration: undefined,
      useOldFormat: undefined,
    })
  })

  it('возвращает null если keyPair отсутствует (без вызова подписи)', () => {
    const { deps, generateApiSignature } = makeDeps({ address: 'ADDR' })
    const methods = createAuthMethods(deps)

    expect(methods.signApiMessage('payload')).toBeNull()
    expect(generateApiSignature).not.toHaveBeenCalled()
  })

  it('возвращает null если address отсутствует (без вызова подписи)', () => {
    const { deps, generateApiSignature } = makeDeps({ keyPair: 'KP' })
    const methods = createAuthMethods(deps)

    expect(methods.signApiMessage('payload')).toBeNull()
    expect(generateApiSignature).not.toHaveBeenCalled()
  })

  it('читает актуальное состояние стора на каждый вызов', () => {
    const auth: AuthState = {}
    const generateApiSignature = vi.fn(() => 'SIG')
    const deps: AuthDeps = {
      useAuthStore: (() => auth) as unknown as AuthDeps['useAuthStore'],
      generateApiSignature: generateApiSignature as unknown as AuthDeps['generateApiSignature'],
      getWalletAddressesList: (() => []) as unknown as AuthDeps['getWalletAddressesList'],
    }
    const methods = createAuthMethods(deps)

    expect(methods.signApiMessage('p')).toBeNull()

    auth.keyPair = 'KP'
    auth.address = 'ADDR'
    expect(methods.signApiMessage('p')).toBe('SIG')
  })
})

describe('getCurrentAccountStatus', () => {
  it('возвращает undefined (агрегация делается отдельно)', () => {
    const { deps } = makeDeps({ keyPair: 'KP', address: 'ADDR' })
    const methods = createAuthMethods(deps)

    expect(methods.getCurrentAccountStatus()).toBeUndefined()
  })
})

describe('getUserWalletAddresses', () => {
  it('возвращает список адресов из storage для адреса пользователя', () => {
    const { deps, getWalletAddressesList } = makeDeps({ address: 'ADDR' }, ['w0', 'w1', 'w2'])
    const methods = createAuthMethods(deps)

    expect(methods.getUserWalletAddresses()).toEqual(['w0', 'w1', 'w2'])
    expect(getWalletAddressesList).toHaveBeenCalledWith('ADDR')
  })

  it('возвращает [] если пользователь не залогинен (без обращения к storage)', () => {
    const { deps, getWalletAddressesList } = makeDeps({}, ['w0'])
    const methods = createAuthMethods(deps)

    expect(methods.getUserWalletAddresses()).toEqual([])
    expect(getWalletAddressesList).not.toHaveBeenCalled()
  })
})

describe('openRegistration', () => {
  it('динамически импортирует modal-store и открывает register-модал', async () => {
    const { deps } = makeDeps({})
    const methods = createAuthMethods(deps)

    await methods.openRegistration()

    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(openAuthModal).toHaveBeenCalledWith('register')
  })
})
