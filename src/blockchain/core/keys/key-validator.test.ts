import { describe, it, expect, vi } from 'vitest'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import * as bip39mod from 'bip39'
import {
  validateMnemonic,
  detectPrivateKeyFormat,
  validatePrivateKey,
  detectMnemonicWordlist,
  normalizeMnemonic,
} from './key-validator'

// Только logger глушим — bip39 используем настоящий, чтобы проверять реальные
// контрольные суммы мнемоник.
vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

const bip39 = (bip39mod as { default?: typeof bip39mod }).default || bip39mod
const ECPair = ECPairFactory(ecc)

// Валидные значения с корректными контрольными суммами — генерируем реальными либами.
const M12 = bip39.entropyToMnemonic('00000000000000000000000000000000') // 16 байт → 12 слов
const M24 = bip39.entropyToMnemonic(
  '0000000000000000000000000000000000000000000000000000000000000000'
) // 32 байта → 24 слова
const WIF = ECPair.makeRandom().toWIF()
const HEX64 = 'a'.repeat(64)

describe('validateMnemonic', () => {
  it('принимает валидную 12-словную фразу', () => {
    expect(validateMnemonic(M12)).toBe(true)
  })

  it('принимает валидную 24-словную фразу', () => {
    expect(validateMnemonic(M24)).toBe(true)
  })

  it('отвергает фразу с битой контрольной суммой', () => {
    const broken = M12.split(' ').slice(0, 11).concat('abandon').join(' ')
    expect(validateMnemonic(broken)).toBe(false)
  })

  it('нормализует регистр и пробелы', () => {
    const messy = `  ${M12.toUpperCase().replace(/ /g, '   ')}  `
    expect(validateMnemonic(messy)).toBe(true)
  })

  it('отвергает пустой/не-строковый ввод', () => {
    expect(validateMnemonic('')).toBe(false)
    expect(validateMnemonic(null as unknown as string)).toBe(false)
  })
})

describe('detectPrivateKeyFormat', () => {
  it('распознаёт мнемонику', () => {
    expect(detectPrivateKeyFormat(M12)).toBe('mnemonic')
  })

  it('распознаёт WIF', () => {
    expect(detectPrivateKeyFormat(WIF)).toBe('wif')
  })

  it('распознаёт WIF с заглавными буквами (регрессия: не ломать lowercase-ом)', () => {
    // Сжатые WIF начинаются с K/L — детектор не должен ронять их toLowerCase-ом.
    expect(WIF[0]).toMatch(/[KL5]/)
    expect(detectPrivateKeyFormat(WIF)).toBe('wif')
  })

  it('распознаёт hex (64 символа)', () => {
    expect(detectPrivateKeyFormat(HEX64)).toBe('hex')
  })

  it('возвращает null для мусора и не-строки', () => {
    expect(detectPrivateKeyFormat('just some words here')).toBeNull()
    expect(detectPrivateKeyFormat(42 as unknown as string)).toBeNull()
  })

  it('возвращает null для 12 слов с битой контрольной суммой', () => {
    const broken = M12.split(' ').slice(0, 11).concat('abandon').join(' ')
    expect(detectPrivateKeyFormat(broken)).toBeNull()
  })
})

describe('validatePrivateKey', () => {
  it('true для валидной мнемоники / WIF / hex', () => {
    expect(validatePrivateKey(M12)).toBe(true)
    expect(validatePrivateKey(WIF)).toBe(true)
    expect(validatePrivateKey(HEX64)).toBe(true)
  })

  it('false для мусора и не-строки', () => {
    expect(validatePrivateKey('nope')).toBe(false)
    expect(validatePrivateKey('')).toBe(false)
    expect(validatePrivateKey(null as unknown as string)).toBe(false)
  })

  it('false для hex неверной длины', () => {
    expect(validatePrivateKey('abcdef')).toBe(false)
  })
})

describe('detectMnemonicWordlist', () => {
  it('возвращает английский wordlist для английской фразы (регрессия: не русский)', () => {
    // Регрессия: ранее английская мнемоника ошибочно детектилась как русская
    // (bip39Russian.validateMnemonic валидирует по английскому wordlist).
    const wl = detectMnemonicWordlist(M12)
    expect(Array.isArray(wl)).toBe(true)
    expect(wl).toContain('abandon')
    expect(wl).toContain('about')
  })

  it('возвращает null для невалидной фразы', () => {
    expect(detectMnemonicWordlist('not a real mnemonic phrase at all here ok')).toBeNull()
    expect(detectMnemonicWordlist('')).toBeNull()
  })
})

describe('normalizeMnemonic', () => {
  it('приводит к нижнему регистру и схлопывает пробелы', () => {
    expect(normalizeMnemonic('  ABANDON   About  ')).toBe('abandon about')
  })

  it('возвращает пустую строку для falsy', () => {
    expect(normalizeMnemonic('')).toBe('')
    expect(normalizeMnemonic(null as unknown as string)).toBe('')
  })
})
