import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import { localHash256, localHash160, toBase58Check, toBech32 } from './address-hash-utils'
import { validateAddress } from './address-validator'

// ---------------------------------------------------------------------------
// Чистые крипто-утилиты — проверяем против общеизвестных Bitcoin-векторов
// (double-SHA256 и hash160 пустого ввода) и через round-trip с валидатором.
// ---------------------------------------------------------------------------

describe('localHash256 (double SHA-256)', () => {
  it('совпадает с известным вектором для пустого ввода', () => {
    // SHA256(SHA256("")) — каноничный Bitcoin-вектор.
    expect(localHash256(Buffer.alloc(0)).toString('hex')).toBe(
      '5df6e0e2761359d30a8275058e299fcc0381534545f55cf43e41983f5d4c9456'
    )
  })

  it('возвращает 32 байта и детерминирован', () => {
    const a = localHash256(Buffer.from('abc'))
    const b = localHash256(Buffer.from('abc'))
    expect(a).toHaveLength(32)
    expect(a.toString('hex')).toBe(b.toString('hex'))
  })
})

describe('localHash160 (RIPEMD160 ∘ SHA-256)', () => {
  it('совпадает с известным вектором для пустого ввода', () => {
    // RIPEMD160(SHA256("")) — каноничный hash160 вектор.
    expect(localHash160(Buffer.alloc(0)).toString('hex')).toBe(
      'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb'
    )
  })

  it('возвращает 20 байт', () => {
    expect(localHash160(Buffer.from('public-key-bytes'))).toHaveLength(20)
  })
})

describe('toBase58Check', () => {
  it('кодирует так, что результат проходит валидацию адреса', () => {
    const hash = localHash160(Buffer.from('02', 'hex'))
    const address = toBase58Check(hash, 0x37) // версия Pocketnet P2PKH → 'P'

    expect(address.startsWith('P')).toBe(true)
    expect(validateAddress(address)).toEqual({ isValid: true, type: 'p2pkh' })
  })

  it('версия задаёт префикс (5 → 3, p2sh)', () => {
    const address = toBase58Check(Buffer.alloc(20, 0x02), 0x05)
    expect(address.startsWith('3')).toBe(true)
    expect(validateAddress(address)).toEqual({ isValid: true, type: 'p2sh' })
  })
})

describe('toBech32 (регрессия на сломанный импорт bech32)', () => {
  it('не падает и порождает валидный bech32-адрес', () => {
    const hash = localHash160(Buffer.from('02', 'hex'))
    const address = toBech32(hash, 0, 'bc')

    expect(address.startsWith('bc1')).toBe(true)
    // Валидатор использует bech32.decode — адрес должен распознаться как p2wpkh.
    expect(validateAddress(address)).toEqual({ isValid: true, type: 'p2wpkh' })
  })
})
