// «Приватный ключ» в настройках: подтверждение → показ, «Скрыть» стирает
// секрет из памяти, у мнемоники рядом выводится hex-ключ, а любая ошибка
// чтения — тост с понятным текстом без показа.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PA' as string | null },
  loadAccountSecret: vi.fn(),
  recoverKeyPair: vi.fn(),
  copySecret: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain', () => ({ recoverKeyPair: mocks.recoverKeyPair }))
vi.mock('./load-account-secret', () => ({ loadAccountSecret: mocks.loadAccountSecret }))
vi.mock('@/helpers/common/clipboard', () => ({ copySecret: mocks.copySecret }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: mocks.toastError, success: mocks.toastSuccess },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { usePrivateKeyReveal } from './use-private-key-reveal'

const SEED = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
const HEX = '1f'.repeat(32)

describe('usePrivateKeyReveal', () => {
  beforeEach(() => {
    mocks.auth.getUserAddress = 'PA'
    mocks.loadAccountSecret.mockReset().mockResolvedValue({ format: 'mnemonic', raw: SEED })
    mocks.recoverKeyPair
      .mockReset()
      .mockReturnValue({ keyPair: { privateKey: Buffer.from(HEX, 'hex') } })
    mocks.copySecret.mockReset().mockResolvedValue(true)
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('«Показать» открывает подтверждение, «Отмена» закрывает его без чтения секрета', () => {
    const pk = usePrivateKeyReveal()
    pk.pkShowConfirm()
    expect(pk.pkConfirmVisible.value).toBe(true)
    pk.pkCancelConfirm()
    expect(pk.pkConfirmVisible.value).toBe(false)
    expect(mocks.loadAccountSecret).not.toHaveBeenCalled()
  })

  it('мнемоника: показывает слова и выведенный из них hex-ключ', async () => {
    const pk = usePrivateKeyReveal()
    pk.pkShowConfirm()
    const pending = pk.pkConfirmAndReveal()
    expect(pk.pkConfirmVisible.value).toBe(false)
    expect(pk.pkLoading.value).toBe(true)
    await pending

    expect(mocks.loadAccountSecret).toHaveBeenCalledWith('PA')
    expect(pk.pkRevealed.value).toBe(true)
    expect(pk.pkLoading.value).toBe(false)
    expect(pk.pkMnemonic.value).toBe(SEED)
    expect(pk.pkPrivateKeyHex.value).toBe(HEX)
  })

  it('мнемоника, из которой не выводится ключ: слова показываются, hex пустой', async () => {
    mocks.recoverKeyPair.mockImplementation(() => {
      throw new Error('bad checksum')
    })
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    expect(pk.pkRevealed.value).toBe(true)
    expect(pk.pkMnemonic.value).toBe(SEED)
    expect(pk.pkPrivateKeyHex.value).toBe('')
  })

  it('hex-ключ показывается как есть, без мнемоники', async () => {
    mocks.loadAccountSecret.mockResolvedValue({ format: 'hex', raw: HEX })
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    expect(pk.pkRevealed.value).toBe(true)
    expect(pk.pkMnemonic.value).toBe('')
    expect(pk.pkPrivateKeyHex.value).toBe(HEX)
    expect(mocks.recoverKeyPair).not.toHaveBeenCalled()
  })

  it('WIF переводится в hex', async () => {
    mocks.loadAccountSecret.mockResolvedValue({ format: 'wif', raw: 'Kx-wif-key' })
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    expect(mocks.recoverKeyPair).toHaveBeenCalledWith('Kx-wif-key')
    expect(pk.pkMnemonic.value).toBe('')
    expect(pk.pkPrivateKeyHex.value).toBe(HEX)
  })

  it('WIF, который не читается: тост keyReadFailed, ничего не показано', async () => {
    mocks.loadAccountSecret.mockResolvedValue({ format: 'wif', raw: 'Kx-broken' })
    mocks.recoverKeyPair.mockImplementation(() => {
      throw new Error('invalid wif')
    })
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    expect(pk.pkRevealed.value).toBe(false)
    expect(pk.pkLoading.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith({ message: 'accountMsg.keyReadFailed' })
  })

  it.each([
    ['нет активного аккаунта', () => (mocks.auth.getUserAddress = null), 'noActiveAccount'],
    [
      'секрет не расшифровался',
      () => mocks.loadAccountSecret.mockRejectedValue(new Error('unknown-format')),
      'unknownDataFormat',
    ],
    [
      'секрет не сохранён',
      () => mocks.loadAccountSecret.mockResolvedValue(null),
      'noSavedSeedOrKey',
    ],
  ])('%s: тост с понятным текстом, ключ не показан', async (_name, arrange, key) => {
    arrange()
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    expect(pk.pkRevealed.value).toBe(false)
    expect(pk.pkLoading.value).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith({ message: `accountMsg.${key}` })
  })

  it('«Скрыть» стирает секрет и возвращает в начальное состояние', async () => {
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()
    pk.pkShowConfirm()
    pk.pkHide()
    expect(pk.pkRevealed.value).toBe(false)
    expect(pk.pkConfirmVisible.value).toBe(false)
    expect(pk.pkMnemonic.value).toBe('')
    expect(pk.pkPrivateKeyHex.value).toBe('')
  })

  it('копирование: тост только после успешной записи в буфер', async () => {
    const pk = usePrivateKeyReveal()
    await pk.pkConfirmAndReveal()

    await pk.pkCopyMnemonic()
    expect(mocks.copySecret).toHaveBeenLastCalledWith(SEED)
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith({ message: 'accountMsg.seedCopied' })

    mocks.copySecret.mockResolvedValue(false)
    mocks.toastSuccess.mockReset()
    await pk.pkCopyKey()
    expect(mocks.copySecret).toHaveBeenLastCalledWith(HEX)
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('до показа копировать нечего', async () => {
    const pk = usePrivateKeyReveal()
    await pk.pkCopyMnemonic()
    await pk.pkCopyKey()
    expect(mocks.copySecret).not.toHaveBeenCalled()
  })
})
