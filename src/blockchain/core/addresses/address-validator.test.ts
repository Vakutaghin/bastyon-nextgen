import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import {
  detectAddressType,
  validateAddress,
  isValidAddress,
  getAddressType,
  normalizeAddress,
} from './address-validator'
import { toBase58Check } from './address-hash-utils'

// ---------------------------------------------------------------------------
// Адреса генерируем реальным toBase58Check (детерминированный, с корректной
// checksum), чтобы валидатор проверял настоящую double-SHA256-сумму, а не
// захардкоженную строку. bech32 берём из общеизвестного mainnet-вектора.
// ---------------------------------------------------------------------------

const HASH = Buffer.alloc(20, 0x01)
const P2PKH = toBase58Check(HASH, 0x37) // версия 0x37 → префикс 'P'
const P2SH3 = toBase58Check(HASH, 0x05) // версия 5 → префикс '3' (как Bitcoin P2SH)
const ZWALLET = toBase58Check(HASH, 0x50) // версия 0x50 → префикс 'Z' (кошелёк Pocketnet)
const BECH32 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

describe('detectAddressType', () => {
  it('классифицирует P-адрес как p2pkh', () => {
    expect(detectAddressType(P2PKH)).toBe('p2pkh')
  })

  it('классифицирует 3-адрес как p2sh', () => {
    expect(detectAddressType(P2SH3)).toBe('p2sh')
  })

  it('классифицирует bech32-адрес как p2wpkh', () => {
    expect(detectAddressType(BECH32)).toBe('p2wpkh')
  })

  it('возвращает null для валидного base58 без префикса P/3 (Z-кошелёк)', () => {
    // По дизайну detectAddressType отдаёт тип только по префиксу; base58-ветка
    // намеренно возвращает null (тип «определяется через валидацию»).
    expect(detectAddressType(ZWALLET)).toBeNull()
  })

  it('возвращает null для пустого/не-строкового/мусорного входа', () => {
    expect(detectAddressType('')).toBeNull()
    expect(detectAddressType(null as unknown as string)).toBeNull()
    expect(detectAddressType(123 as unknown as string)).toBeNull()
    expect(detectAddressType('!!!not-an-address')).toBeNull()
  })
})

describe('validateAddress', () => {
  it('валиден P2PKH с типом p2pkh', () => {
    expect(validateAddress(P2PKH)).toEqual({ isValid: true, type: 'p2pkh' })
  })

  it('валиден P2SH (3-префикс) с типом p2sh', () => {
    expect(validateAddress(P2SH3)).toEqual({ isValid: true, type: 'p2sh' })
  })

  it('валиден bech32 с типом p2wpkh', () => {
    expect(validateAddress(BECH32)).toEqual({ isValid: true, type: 'p2wpkh' })
  })

  it('квирк: Z-кошелёк валиден, но тип по умолчанию p2pkh (не распознан префикс)', () => {
    expect(validateAddress(ZWALLET)).toEqual({ isValid: true, type: 'p2pkh' })
  })

  it('игнорирует обрамляющие пробелы', () => {
    expect(validateAddress(`  ${P2PKH}  `)).toEqual({ isValid: true, type: 'p2pkh' })
  })

  it('отвергает null / не-строку', () => {
    expect(validateAddress(null as unknown as string)).toEqual({
      isValid: false,
      error: 'Address is required and must be a string',
    })
    expect(validateAddress(42 as unknown as string).isValid).toBe(false)
  })

  it('отвергает строку из одних пробелов', () => {
    expect(validateAddress('    ')).toEqual({
      isValid: false,
      error: 'Address cannot be empty',
    })
  })

  it('отвергает адрес с битой контрольной суммой', () => {
    // Меняем символ в середине — checksum перестаёт сходиться.
    const tampered = P2PKH.slice(0, 5) + (P2PKH[5] === 'a' ? 'b' : 'a') + P2PKH.slice(6)
    const res = validateAddress(tampered)
    expect(res.isValid).toBe(false)
    expect(res.error).toBe('Invalid address format')
  })

  it('отвергает явный мусор', () => {
    expect(validateAddress('definitely-not-valid').isValid).toBe(false)
  })
})

describe('isValidAddress', () => {
  it('true для валидного адреса', () => {
    expect(isValidAddress(P2PKH)).toBe(true)
  })

  it('false для мусора', () => {
    expect(isValidAddress('nope')).toBe(false)
  })
})

describe('getAddressType', () => {
  it('возвращает тип для валидного адреса', () => {
    expect(getAddressType(P2PKH)).toBe('p2pkh')
    expect(getAddressType(BECH32)).toBe('p2wpkh')
  })

  it('возвращает null для невалидного адреса', () => {
    expect(getAddressType('nope')).toBeNull()
  })
})

describe('normalizeAddress', () => {
  it('обрезает пробелы', () => {
    expect(normalizeAddress(`  ${P2PKH}  `)).toBe(P2PKH)
  })

  it('возвращает пустую строку для falsy-входа', () => {
    expect(normalizeAddress('')).toBe('')
    expect(normalizeAddress(null as unknown as string)).toBe('')
  })
})
