import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Buffer } from 'buffer'
import {
  generateP2PKHAddress,
  generateP2WPKHAddress,
  generateP2SHAddress,
  generatePocketnetAddress,
  generateAddressFromKeyPair,
  generateWalletAddress,
  clearAddressCache,
} from './address-generator'
import { validateAddress } from './address-validator'
import { getMainAddressPath } from '../../constants/paths'
import type { KeyPair } from '../../types/keys'

// ---------------------------------------------------------------------------
// Крипто-хелперы (localHash160/toBase58Check/toBech32) реальные — проверяем
// настоящие адреса. seedToKeyPair (BIP32-деривация) мокаем, чтобы тест
// generateWalletAddress не зависел от тяжёлой деривации.
// Buffer берём из 'buffer' (= источник buffer-polyfill), иначе Buffer.isBuffer
// не признает тестовые буферы.
// ---------------------------------------------------------------------------

const _seedToKeyPair = vi.hoisted(() => vi.fn())

vi.mock('../keys/key-generator', () => ({ seedToKeyPair: _seedToKeyPair }))

const PUBKEY = Buffer.from('02' + 'ab'.repeat(32), 'hex') // 33-байтный compressed pubkey

beforeEach(() => {
  clearAddressCache()
  _seedToKeyPair.mockReset()
})

describe('generateP2PKHAddress', () => {
  it('бросает на не-Buffer', () => {
    expect(() => generateP2PKHAddress('nope' as unknown as Buffer)).toThrow(
      'Valid public key is required'
    )
  })

  it('генерирует валидный P-адрес (p2pkh), эхо publicKey', () => {
    const info = generateP2PKHAddress(PUBKEY)

    expect(info.address.startsWith('P')).toBe(true)
    expect(info.type).toBe('p2pkh')
    expect(info.publicKey).toBe(PUBKEY)
    expect(validateAddress(info.address)).toEqual({ isValid: true, type: 'p2pkh' })
  })

  it('детерминирован для одного pubkey', () => {
    clearAddressCache()
    const a = generateP2PKHAddress(PUBKEY).address
    clearAddressCache()
    const b = generateP2PKHAddress(PUBKEY).address
    expect(a).toBe(b)
  })

  it('кеширует результат (тот же объект при повторе)', () => {
    const first = generateP2PKHAddress(PUBKEY)
    const second = generateP2PKHAddress(PUBKEY)
    expect(second).toBe(first)
  })
})

describe('generateP2WPKHAddress', () => {
  it('бросает на не-Buffer', () => {
    expect(() => generateP2WPKHAddress(null as unknown as Buffer)).toThrow(
      'Valid public key is required'
    )
  })

  it('генерирует валидный bech32-адрес (p2wpkh)', () => {
    const info = generateP2WPKHAddress(PUBKEY)

    expect(info.address.startsWith('bc1')).toBe(true)
    expect(info.type).toBe('p2wpkh')
    expect(validateAddress(info.address)).toEqual({ isValid: true, type: 'p2wpkh' })
  })
})

describe('generateP2SHAddress', () => {
  it('бросает на не-Buffer', () => {
    expect(() => generateP2SHAddress(undefined as unknown as Buffer)).toThrow(
      'Valid public key is required'
    )
  })

  it('генерирует валидный P2SH-адрес (префикс Z) с redeem-скриптом', () => {
    const info = generateP2SHAddress(PUBKEY)

    // scriptHash=0x50 → адреса кошельков начинаются с 'Z'
    expect(info.address.startsWith('Z')).toBe(true)
    expect(info.type).toBe('p2sh')
    expect(validateAddress(info.address).isValid).toBe(true)

    // redeem script: 0x00 0x14 <20-байтный hash160(pubkey)>
    const redeem = info.payment.redeem!.output as Buffer
    expect(redeem.subarray(0, 2)).toEqual(Buffer.from([0x00, 0x14]))
    expect(redeem).toHaveLength(22)
  })
})

describe('generatePocketnetAddress', () => {
  it('по умолчанию p2pkh', () => {
    expect(generatePocketnetAddress(PUBKEY).type).toBe('p2pkh')
  })

  it('делегирует по типу', () => {
    expect(generatePocketnetAddress(PUBKEY, 'p2wpkh').type).toBe('p2wpkh')
    expect(generatePocketnetAddress(PUBKEY, 'p2sh').type).toBe('p2sh')
  })

  it('бросает на неподдерживаемом типе', () => {
    expect(() => generatePocketnetAddress(PUBKEY, 'taproot' as never)).toThrow(
      'Unsupported address type'
    )
  })

  it('бросает на не-Buffer', () => {
    expect(() => generatePocketnetAddress('x' as unknown as Buffer)).toThrow(
      'Valid public key is required'
    )
  })
})

describe('generateAddressFromKeyPair', () => {
  it('генерирует адрес из publicKey ключевой пары', () => {
    const kp = { publicKey: PUBKEY } as KeyPair
    const res = generateAddressFromKeyPair(kp)
    expect(res.addressInfo.type).toBe('p2pkh')
    expect(res.addressInfo.address.startsWith('P')).toBe(true)
  })
})

describe('generateWalletAddress', () => {
  const SEED = Buffer.from('11'.repeat(32), 'hex')

  beforeEach(() => {
    _seedToKeyPair.mockReturnValue({ publicKey: PUBKEY })
  })

  it('бросает при отрицательном индексе', () => {
    expect(() => generateWalletAddress(-1, SEED)).toThrow('Wallet index must be non-negative')
  })

  it('бросает при невалидном приватном ключе', () => {
    expect(() => generateWalletAddress(0, 'nope' as unknown as Buffer)).toThrow(
      'Valid private key (seed) is required'
    )
  })

  it('возвращает P2SH-адрес и derivationPath; зовёт seedToKeyPair с путём', () => {
    const res = generateWalletAddress(2, SEED)

    expect(res.addressInfo.type).toBe('p2sh')
    expect(res.addressInfo.address.startsWith('Z')).toBe(true)
    expect(res.derivationPath).toBe(getMainAddressPath(2))
    expect(_seedToKeyPair).toHaveBeenCalledWith(SEED, getMainAddressPath(2), true)
  })

  it('useCache=true: повторный вызов берёт из кеша (seedToKeyPair не вызывается снова)', () => {
    generateWalletAddress(0, SEED)
    generateWalletAddress(0, SEED)
    expect(_seedToKeyPair).toHaveBeenCalledTimes(1)
  })

  it('useCache=false: кеш не используется (деривация каждый раз)', () => {
    generateWalletAddress(0, SEED, false)
    generateWalletAddress(0, SEED, false)
    expect(_seedToKeyPair).toHaveBeenCalledTimes(2)
  })
})

describe('clearAddressCache', () => {
  it('сбрасывает кеш — после очистки возвращается новый объект', () => {
    const first = generateP2PKHAddress(PUBKEY)
    clearAddressCache()
    const second = generateP2PKHAddress(PUBKEY)
    expect(second).not.toBe(first)
    expect(second.address).toBe(first.address) // но адрес тот же
  })
})
