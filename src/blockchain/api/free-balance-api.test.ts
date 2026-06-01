import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { setI18nLocale } from '@/i18n'
import { requestUnspents } from './free-balance-api'

// Ошибки регистрации резолвятся через i18n; фиксируем 'ru' под русские ассерты.
beforeAll(() => setI18nLocale('ru'))

// ---------------------------------------------------------------------------
// Оркестратор с множеством зависимостей — мокаем все внешние шаги.
// ---------------------------------------------------------------------------

const {
  _getProxy,
  _getHex,
  _getCaptcha,
  _showModal,
  _fetchHttp,
  _isCaptchaError,
  _isRegBlocking,
  mockAuth,
} = vi.hoisted(() => ({
  _getProxy: vi.fn(),
  _getHex: vi.fn(),
  _getCaptcha: vi.fn(),
  _showModal: vi.fn(),
  _fetchHttp: vi.fn(),
  _isCaptchaError: vi.fn(),
  _isRegBlocking: vi.fn(),
  mockAuth: { getKeyPair: {} as unknown, getUserAddress: '' as string | null },
}))

vi.mock('./proxy-with-wallet', () => ({ getProxyWithWalletCached: _getProxy }))
vi.mock('./captcha-api', () => ({ captchaAPI: { getHex: _getHex, get: _getCaptcha } }))
vi.mock('@/components/captcha', () => ({ showCaptchaModal: _showModal }))
vi.mock('@/helpers/api/request', () => ({ fetchHttp: _fetchHttp }))
vi.mock('@/helpers/api/error-codes', () => ({
  isCaptchaError: _isCaptchaError,
  isRegistrationBlockingError: _isRegBlocking,
}))
vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ debug: vi.fn(), error: vi.fn() }) },
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mockAuth }))

const PARAMS = { reason: 'registration' }

beforeEach(() => {
  _getProxy.mockReset().mockResolvedValue({ host: 'proxy', port: 8899 })
  _getHex.mockReset().mockResolvedValue({ id: 'cap1', done: true })
  _getCaptcha.mockReset().mockResolvedValue({ id: 'cap1', done: true })
  _showModal.mockReset().mockResolvedValue({ id: 'cap1', done: true })
  _fetchHttp.mockReset().mockResolvedValue({ action: 'action-1' })
  _isCaptchaError.mockReset().mockReturnValue(false)
  _isRegBlocking.mockReset().mockReturnValue(false)
  mockAuth.getKeyPair = { ecPair: {} }
  mockAuth.getUserAddress = 'PUserAddr'
})

describe('requestUnspents', () => {
  it('бросает, если прокси с кошельком не найден', async () => {
    _getProxy.mockResolvedValue(null)
    await expect(requestUnspents('PAddr', PARAMS)).rejects.toThrow('прокси с регистрационным кошельком')
  })

  it('бросает, если нет ключей', async () => {
    mockAuth.getKeyPair = null
    await expect(requestUnspents('PAddr', PARAMS)).rejects.toThrow('Ключи не найдены')
  })

  it('happy path: getHex решает капчу, free/balance возвращает action + proxy', async () => {
    const res = await requestUnspents('PAddr', PARAMS)

    expect(res).toEqual({ action: 'action-1', proxy: { host: 'proxy', port: 8899 } })
    expect(_fetchHttp).toHaveBeenCalledWith({
      path: 'free/balance',
      data: { address: 'PAddr', captcha: 'cap1', key: 'registration' },
      options: { auth: true, host: 'proxy', port: 8899 },
    })
    // get не понадобился, т.к. getHex уже done
    expect(_getCaptcha).not.toHaveBeenCalled()
  })

  it('если getHex не решил — пробует get', async () => {
    _getHex.mockResolvedValue({ id: 'cap1', done: false })
    _getCaptcha.mockResolvedValue({ id: 'cap2', done: true })

    const res = await requestUnspents('PAddr', PARAMS)

    expect(_getCaptcha).toHaveBeenCalled()
    expect(res.action).toBe('action-1')
    expect(_fetchHttp.mock.calls[0][0].data.captcha).toBe('cap2')
  })

  it('если авто-решение не сработало — зовёт onCaptchaRequired', async () => {
    _getHex.mockResolvedValue({ id: 'cap1', done: false })
    _getCaptcha.mockResolvedValue({ id: 'cap1', done: false })
    const onCaptcha = vi.fn().mockResolvedValue({ id: 'cap-manual', done: true })

    const res = await requestUnspents('PAddr', PARAMS, onCaptcha)

    expect(onCaptcha).toHaveBeenCalled()
    expect(_showModal).not.toHaveBeenCalled()
    expect(res.action).toBe('action-1')
    expect(_fetchHttp.mock.calls[0][0].data.captcha).toBe('cap-manual')
  })

  it('без onCaptchaRequired показывает модалку капчи', async () => {
    _getHex.mockResolvedValue({ id: 'cap1', done: false })
    _getCaptcha.mockResolvedValue({ id: 'cap1', done: false })
    _showModal.mockResolvedValue({ id: 'cap-modal', done: true })

    const res = await requestUnspents('PAddr', PARAMS)

    expect(_showModal).toHaveBeenCalled()
    expect(_fetchHttp.mock.calls[0][0].data.captcha).toBe('cap-modal')
    expect(res.action).toBe('action-1')
  })

  it('после MAX_CAPTCHA_RETRIES нерешённой капчи бросает понятную ошибку', async () => {
    _getHex.mockResolvedValue({ id: 'cap1', done: false })
    _getCaptcha.mockResolvedValue({ id: 'cap1', done: false })
    _showModal.mockRejectedValue(new Error('user closed')) // → captcha_cancelled → retry

    await expect(requestUnspents('PAddr', PARAMS)).rejects.toThrow('Не удалось решить капчу')
    // 1 первичный + 3 ретрая = 4 попытки найти прокси
    expect(_getProxy).toHaveBeenCalledTimes(4)
  })

  it('captcha-ошибка от free/balance вызывает ретрай, затем успех', async () => {
    _isCaptchaError.mockReturnValue(true)
    _fetchHttp.mockRejectedValueOnce(new Error('captcha invalid')).mockResolvedValue({ action: 'ok-2' })

    const res = await requestUnspents('PAddr', PARAMS)

    expect(res.action).toBe('ok-2')
    expect(_fetchHttp).toHaveBeenCalledTimes(2)
  })

  it('registration-blocking ошибка → понятное сообщение', async () => {
    _isRegBlocking.mockReturnValue(true)
    _fetchHttp.mockRejectedValue(new Error('reg blocked'))

    await expect(requestUnspents('PAddr', PARAMS)).rejects.toThrow('Ошибка регистрации: reg blocked')
  })

  it('прочая ошибка free/balance пробрасывается как есть', async () => {
    _fetchHttp.mockRejectedValue(new Error('boom unknown'))

    await expect(requestUnspents('PAddr', PARAMS)).rejects.toThrow('boom unknown')
  })
})
