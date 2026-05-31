import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signRequest, createRequestSigner } from './request-signer'
import type { KeyPair } from '../types/keys'
import type { Address } from '../types/addresses'
import type { ApiSignature } from '../types/signatures'

// ---------------------------------------------------------------------------
// generateApiSignature — единственная тяжёлая (crypto) зависимость модуля.
// Мокаем её, чтобы тестировать чистую логику подписи запроса в изоляции,
// без реальной криптографии. Возвращаем предсказуемый объект подписи.
// ---------------------------------------------------------------------------

const _generateApiSignature = vi.hoisted(() => vi.fn())

vi.mock('../core/signatures', () => ({
  generateApiSignature: _generateApiSignature,
}))

const FAKE_SIGNATURE: ApiSignature = {
  nonce: 'date=2026-01-01T00:00:00.000Z,exp=360,s=706f636b65746e6574',
  signature: 'deadbeef',
  pubkey: 'cafebabe',
  address: 'PFakeAddress',
  v: 1,
}

// Минимальная валидная по форме ключевая пара — её содержимое не важно,
// т.к. generateApiSignature замокана; важна лишь truthiness.
const KEY_PAIR = { ecPair: {}, privateKey: {}, publicKey: {} } as unknown as KeyPair
const ADDRESS: Address = 'PUserAddress123'

describe('signRequest', () => {
  beforeEach(() => {
    _generateApiSignature.mockReset()
    _generateApiSignature.mockReturnValue(FAKE_SIGNATURE)
  })

  describe('когда подпись не нужна / нет ключей', () => {
    it('возвращает данные без изменений при requireSignature=false и отсутствии ключей', () => {
      const data = { method: 'getposts' }
      const result = signRequest(data, null, null, { requireSignature: false })

      expect(result).toEqual({ method: 'getposts' })
      expect(_generateApiSignature).not.toHaveBeenCalled()
    })

    it('добавляет state=1 при requireSignature=false, но наличии ключей и адреса', () => {
      const data = { method: 'getposts' }
      const result = signRequest(data, KEY_PAIR, ADDRESS, { requireSignature: false })

      expect(result).toEqual({ method: 'getposts', state: 1 })
      expect(_generateApiSignature).not.toHaveBeenCalled()
    })

    it('возвращает данные без изменений, если keyPair = null', () => {
      const data = { method: 'getposts' }
      const result = signRequest(data, null, ADDRESS)

      expect(result).toEqual({ method: 'getposts' })
      expect('state' in result).toBe(false)
      expect(_generateApiSignature).not.toHaveBeenCalled()
    })

    it('возвращает данные без изменений, если address = null', () => {
      const data = { method: 'getposts' }
      const result = signRequest(data, KEY_PAIR, null)

      expect(result).toEqual({ method: 'getposts' })
      expect('state' in result).toBe(false)
      expect(_generateApiSignature).not.toHaveBeenCalled()
    })
  })

  describe('happy path — генерация подписи', () => {
    it('добавляет подпись к данным и сохраняет исходные поля', () => {
      const data = { method: 'getposts', params: [1, 2, 3] }
      const result = signRequest(data, KEY_PAIR, ADDRESS)

      expect(result).toEqual({
        method: 'getposts',
        params: [1, 2, 3],
        signature: FAKE_SIGNATURE,
      })
      expect('state' in result).toBe(false)
    })

    it('по умолчанию подписывает с data="pocketnetproxy"', () => {
      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS)

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
        data: 'pocketnetproxy',
        session: undefined,
        expiration: undefined,
      })
    })

    it('использует options.data как данные подписи, если он задан', () => {
      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS, { data: 'customdata' })

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
        data: 'customdata',
        session: undefined,
        expiration: undefined,
      })
    })

    it('использует session как fallback для data, если options.data не задан', () => {
      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS, { session: 'sess-123' })

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
        data: 'sess-123',
        session: 'sess-123',
        expiration: undefined,
      })
    })

    it('options.data имеет приоритет над session', () => {
      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS, {
        data: 'priority-data',
        session: 'sess-123',
      })

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
        data: 'priority-data',
        session: 'sess-123',
        expiration: undefined,
      })
    })

    it('пробрасывает expiration в генератор подписи', () => {
      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS, { expiration: 600 })

      expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
        data: 'pocketnetproxy',
        session: undefined,
        expiration: 600,
      })
    })
  })

  describe('обработка ошибок генерации', () => {
    let errSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      errSpy.mockRestore()
    })

    it('возвращает данные с state=1 при ошибке генерации подписи', () => {
      _generateApiSignature.mockImplementation(() => {
        throw new Error('crypto boom')
      })

      const data = { method: 'getposts' }
      const result = signRequest(data, KEY_PAIR, ADDRESS)

      expect(result).toEqual({ method: 'getposts', state: 1 })
      expect('signature' in result).toBe(false)
    })

    it('логирует ошибку при сбое генерации', () => {
      const boom = new Error('crypto boom')
      _generateApiSignature.mockImplementation(() => {
        throw boom
      })

      signRequest({ method: 'x' }, KEY_PAIR, ADDRESS)

      expect(errSpy).toHaveBeenCalledWith('Failed to sign request:', boom)
    })
  })
})

describe('createRequestSigner', () => {
  beforeEach(() => {
    _generateApiSignature.mockReset()
    _generateApiSignature.mockReturnValue(FAKE_SIGNATURE)
  })

  it('создаёт функцию, использующую текущие keyPair и address', () => {
    const getKeyPair = vi.fn(() => KEY_PAIR)
    const getAddress = vi.fn(() => ADDRESS)
    const sign = createRequestSigner(getKeyPair, getAddress)

    const result = sign({ method: 'getposts' })

    expect(result).toEqual({ method: 'getposts', signature: FAKE_SIGNATURE })
    expect(getKeyPair).toHaveBeenCalledTimes(1)
    expect(getAddress).toHaveBeenCalledTimes(1)
  })

  it('читает ключи заново на каждый вызов (отражает logout/login)', () => {
    let keyPair: KeyPair | null = null
    let address: Address | null = null
    const sign = createRequestSigner(
      () => keyPair,
      () => address
    )

    // Пользователь не авторизован — подпись не добавляется.
    const before = sign({ method: 'x' })
    expect('signature' in before).toBe(false)
    expect(_generateApiSignature).not.toHaveBeenCalled()

    // После логина те же геттеры отдают ключи — подпись появляется.
    keyPair = KEY_PAIR
    address = ADDRESS
    const after = sign({ method: 'x' })
    expect(after).toEqual({ method: 'x', signature: FAKE_SIGNATURE })
  })

  it('пробрасывает options в signRequest', () => {
    const sign = createRequestSigner(
      () => KEY_PAIR,
      () => ADDRESS
    )

    sign({ method: 'x' }, { expiration: 120, data: 'dd' })

    expect(_generateApiSignature).toHaveBeenCalledWith(KEY_PAIR, ADDRESS, {
      data: 'dd',
      session: undefined,
      expiration: 120,
    })
  })
})
