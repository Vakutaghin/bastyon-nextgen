import { describe, it, expect } from 'vitest'
import { addressToHex, hexToAddress } from './address-codec'

describe('addressToHex / hexToAddress', () => {
  it('round-trip для ASCII-адреса (base58 Pocketnet)', () => {
    const addr = 'PEa7Xv9kE2bN1qS'
    expect(hexToAddress(addressToHex(addr))).toBe(addr)
  })

  it('round-trip для кириллицы (сдвиг ±0x350)', () => {
    const text = 'привет'
    expect(hexToAddress(addressToHex(text))).toBe(text)
  })

  it('кодирует ASCII по кодам символов', () => {
    expect(addressToHex('A')).toBe('41') // 0x41
    expect(addressToHex('AB')).toBe('4142')
  })

  it('дополняет нулём коды < 16', () => {
    expect(addressToHex('\x05')).toBe('05')
  })

  it('кириллица: байт сдвигается на -0x350 при кодировании', () => {
    // 'Р' = U+0420 (1056) → 1056 - 0x350(848) = 208 = 0xd0
    expect(addressToHex('Р')).toBe('d0')
    expect(hexToAddress('d0')).toBe('Р')
  })

  it('hexToAddress: пустая строка → пустая', () => {
    expect(hexToAddress('')).toBe('')
  })

  it('hexToAddress: невалидная hex-пара → пустая строка', () => {
    expect(hexToAddress('zz')).toBe('')
    expect(hexToAddress('4g')).toBe('')
  })

  it('hexToAddress декодирует известный вектор', () => {
    expect(hexToAddress('4142')).toBe('AB')
  })
})
