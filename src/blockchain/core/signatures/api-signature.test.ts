import { describe, it, expect, vi } from 'vitest'
import { Buffer } from 'buffer'
import { generateApiSignature, validateApiSignature } from './api-signature'
import { sha256, hexEncode } from '../../utils/crypto-hash'
import type { KeyPair } from '../../types/keys'
import type { ApiSignature } from '../../types/signatures'

// ---------------------------------------------------------------------------
// sha256/hexEncode — чистые, уже покрыты собственными тестами, поэтому здесь
// НЕ мокаются: проверяем реальный формат nonce. Криптоподпись (ecPair.sign)
// заменяется stub'ом, возвращающим предсказуемый буфер.
// ---------------------------------------------------------------------------

function makeKeyPair(sign: (data: Buffer) => Buffer | Uint8Array): KeyPair {
  return {
    privateKey: Buffer.from('11', 'hex'),
    publicKey: Buffer.from('02aabbcc', 'hex'),
    ecPair: { sign } as unknown as KeyPair['ecPair'],
  }
}

const ADDRESS = 'PUserAddress123'

describe('generateApiSignature', () => {
  describe('валидация входа', () => {
    it('бросает, если keyPair отсутствует', () => {
      expect(() => generateApiSignature(null as unknown as KeyPair, ADDRESS)).toThrow(
        'Valid key pair is required'
      )
    })

    it('бросает, если у keyPair нет ecPair', () => {
      const kp = { publicKey: Buffer.alloc(0) } as unknown as KeyPair
      expect(() => generateApiSignature(kp, ADDRESS)).toThrow('Valid key pair is required')
    })

    it('бросает, если адрес отсутствует', () => {
      const kp = makeKeyPair(() => Buffer.from('ab', 'hex'))
      expect(() => generateApiSignature(kp, '' as unknown as string)).toThrow('Address is required')
    })
  })

  describe('новый формат (по умолчанию)', () => {
    it('формирует корректную структуру подписи', () => {
      const sign = vi.fn(() => Buffer.from('deadbeef', 'hex'))
      const kp = makeKeyPair(sign)

      const sig = generateApiSignature(kp, ADDRESS)

      expect(sig.signature).toBe('deadbeef')
      expect(sig.pubkey).toBe('02aabbcc')
      expect(sig.address).toBe(ADDRESS)
      expect(sig.v).toBe(1)
      expect(sig.nonce).toMatch(/^date=.+,exp=360,s=[0-9a-f]+$/)
    })

    it('подписывает sha256(nonce), а не сам nonce', () => {
      const sign = vi.fn((_data: Buffer) => Buffer.from('00', 'hex'))
      const kp = makeKeyPair(sign)

      const sig = generateApiSignature(kp, ADDRESS)

      // sign вызван ровно один раз с хешем итогового nonce.
      expect(sign).toHaveBeenCalledTimes(1)
      const passed = sign.mock.calls[0][0] as Buffer
      expect(Buffer.from(passed).toString('hex')).toBe(sha256(sig.nonce).toString('hex'))
    })

    it('кодирует data в nonce (s=hex(data)) и пробрасывает expiration', () => {
      const kp = makeKeyPair(() => Buffer.from('00', 'hex'))

      const sig = generateApiSignature(kp, ADDRESS, { data: 'hello', expiration: 600 })

      expect(sig.nonce).toContain('exp=600')
      expect(sig.nonce).toContain(`s=${hexEncode('hello')}`)
    })

    it('session имеет приоритет над data в содержимом nonce', () => {
      const kp = makeKeyPair(() => Buffer.from('00', 'hex'))

      const sig = generateApiSignature(kp, ADDRESS, { data: 'ignored', session: 'sess-xyz' })

      expect(sig.nonce).toContain(`s=${hexEncode('sess-xyz')}`)
      expect(sig.nonce).not.toContain(hexEncode('ignored'))
    })

    it('сериализует подпись из Uint8Array в hex', () => {
      const kp = makeKeyPair(() => new Uint8Array([0xde, 0xad]))

      const sig = generateApiSignature(kp, ADDRESS)

      expect(sig.signature).toBe('dead')
    })
  })

  describe('старый формат (useOldFormat)', () => {
    it('подписывает сам nonce (Buffer), nonce — 32+ цифр, поле v отсутствует', () => {
      const sign = vi.fn((_data: Buffer) => Buffer.from('cafe', 'hex'))
      const kp = makeKeyPair(sign)

      const sig = generateApiSignature(kp, ADDRESS, { useOldFormat: true })

      expect(sig.signature).toBe('cafe')
      expect('v' in sig).toBe(false)
      expect(sig.nonce).toMatch(/^\d{32,}$/)

      // В старом формате подписывается Buffer.from(nonce), без sha256.
      const passed = sign.mock.calls[0][0] as Buffer
      expect(passed.toString()).toBe(sig.nonce)
    })
  })
})

describe('validateApiSignature', () => {
  const futureNonce = (expSeconds = 360) =>
    `date=${new Date(Date.now() + 3_600_000).toISOString()},exp=${expSeconds},s=abcd`
  const pastNonce = (expSeconds = 360) =>
    `date=${new Date(Date.now() - 3_600_000).toISOString()},exp=${expSeconds},s=abcd`

  const base = (nonce: string): ApiSignature => ({
    nonce,
    signature: 'deadbeef',
    pubkey: '02aabbcc',
    address: ADDRESS,
    v: 1,
  })

  it('невалидна, если подпись не передана', () => {
    const res = validateApiSignature(null as unknown as ApiSignature)
    expect(res.isValid).toBe(false)
    expect(res.error).toBe('Signature is required')
  })

  it('невалидна при неполном формате (нет pubkey)', () => {
    const sig = { ...base(futureNonce()), pubkey: '' }
    const res = validateApiSignature(sig)
    expect(res.isValid).toBe(false)
    expect(res.error).toBe('Invalid signature format')
  })

  it('валидна и не истекла для свежего nonce', () => {
    const res = validateApiSignature(base(futureNonce()))
    expect(res.isValid).toBe(true)
    expect(res.isExpired).toBe(false)
    expect(res.expirationTime).toBeInstanceOf(Date)
  })

  it('помечает истёкшую подпись', () => {
    const res = validateApiSignature(base(pastNonce()))
    expect(res.isValid).toBe(false)
    expect(res.isExpired).toBe(true)
    expect(res.error).toBe('Signature has expired')
  })

  it('старый формат (без exp в nonce) считается валидным по формату', () => {
    const sig = base('12345678901234567890123456789012')
    delete (sig as Partial<ApiSignature>).v
    const res = validateApiSignature(sig as ApiSignature)
    expect(res.isValid).toBe(true)
  })
})
