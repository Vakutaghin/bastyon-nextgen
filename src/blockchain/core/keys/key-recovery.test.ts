import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Импортируем Buffer и bip39 ИЗ ТЕХ ЖЕ источников, что и код (buffer-polyfill /
// bip39-loader), чтобы Buffer-инстансы совпадали.
import { Buffer } from '../../utils/buffer-polyfill'
import { bip39 } from './bip39-loader'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { POCKETNET_NETWORK } from '../../constants/network'

vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

// seedToKeyPair зависит от Buffer.isBuffer(seed); bip39.mnemonicToSeedSync в
// Node-окружении отдаёт нативный Buffer, который полифилльный isBuffer не
// признаёт (в браузере полифилл делает их одним). Поэтому мокаем ТОЛЬКО
// seedToKeyPair, оставляя реальный mnemonicToSeed — именно он доказывает, что
// английская мнемоника больше не падает на детекте русского wordlist (фикс).
const FAKE_KP = {
  privateKey: Buffer.alloc(32, 1),
  publicKey: Buffer.alloc(33, 2),
  ecPair: { _fake: true },
}
const _seedToKeyPair = vi.hoisted(() => vi.fn())

vi.mock('./key-generator', async (importActual) => {
  const actual = await importActual<typeof import('./key-generator')>()
  return { ...actual, seedToKeyPair: _seedToKeyPair }
})

import {
  recoverKeyPairFromMnemonic,
  recoverKeyPairFromHex,
  recoverKeyPairFromWIF,
  recoverKeyPair,
} from './key-recovery'
import { getMainAddressPath } from '../../constants/paths'

const ECPair = ECPairFactory(ecc)

const M12 = bip39.entropyToMnemonic('00000000000000000000000000000000')
const HEX = 'a'.repeat(64)
const POCKETNET_WIF = ECPair.makeRandom({ network: POCKETNET_NETWORK }).toWIF()

let errSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  _seedToKeyPair.mockReset().mockReturnValue(FAKE_KP)
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errSpy.mockRestore())

const isBuf32 = (b: unknown) => Buffer.isBuffer(b) && (b as Buffer).length === 32
const isBuf33 = (b: unknown) => Buffer.isBuffer(b) && (b as Buffer).length === 33

describe('recoverKeyPairFromMnemonic', () => {
  it('бросает при пустой мнемонике', () => {
    expect(() => recoverKeyPairFromMnemonic('')).toThrow('Mnemonic is required')
  })

  it('бросает при невалидной мнемонике', () => {
    expect(() => recoverKeyPairFromMnemonic('foo bar baz qux')).toThrow('Invalid mnemonic phrase')
  })

  it('валидная английская мнемоника проходит до seedToKeyPair (регрессия wordlist-фикса)', () => {
    // До фикса английская M12 ошибочно детектилась как русская → mnemonicToSeed
    // бросал 'Invalid mnemonic phrase' и сюда бы не дошли.
    const kp = recoverKeyPairFromMnemonic(M12, getMainAddressPath(0))

    expect(kp).toBe(FAKE_KP)
    expect(_seedToKeyPair).toHaveBeenCalledTimes(1)
    // seedToKeyPair получает реальный 64-байтный seed и путь деривации
    const [seed, path] = _seedToKeyPair.mock.calls[0]
    expect((seed as Buffer).length).toBe(64)
    expect(path).toBe(getMainAddressPath(0))
  })
})

describe('recoverKeyPairFromHex', () => {
  it('бросает при пустом ключе', () => {
    expect(() => recoverKeyPairFromHex('')).toThrow('Hex private key is required')
  })

  it('бросает при неверном формате', () => {
    expect(() => recoverKeyPairFromHex('xyz')).toThrow('Invalid hex private key format')
  })

  it('восстанавливает пару из 64-символьного hex; privateKey соответствует входу', () => {
    const kp = recoverKeyPairFromHex(HEX)

    expect(isBuf32(kp.privateKey)).toBe(true)
    expect(isBuf33(kp.publicKey)).toBe(true)
    expect(kp.privateKey.toString('hex')).toBe(HEX)
  })
})

describe('recoverKeyPairFromWIF', () => {
  it('бросает при пустом ключе', () => {
    expect(() => recoverKeyPairFromWIF('')).toThrow('WIF private key is required')
  })

  it('восстанавливает пару из WIF сети Pocketnet (round-trip)', () => {
    const kp = recoverKeyPairFromWIF(POCKETNET_WIF)

    expect(isBuf32(kp.privateKey)).toBe(true)
    expect(isBuf33(kp.publicKey)).toBe(true)
    expect(kp.ecPair.toWIF()).toBe(POCKETNET_WIF)
  })

  it('бросает на невалидном WIF', () => {
    expect(() => recoverKeyPairFromWIF('notawif')).toThrow('Failed to recover key pair from WIF')
  })
})

describe('recoverKeyPair (авто-определение формата)', () => {
  it('бросает при пустом ключе', () => {
    expect(() => recoverKeyPair('')).toThrow('Private key is required')
  })

  it('распознаёт и восстанавливает мнемонику', () => {
    const res = recoverKeyPair(M12)
    expect(res.format).toBe('mnemonic')
    expect(res.keyPair).toBe(FAKE_KP)
    expect(res.source).toBe(M12)
  })

  it('распознаёт и восстанавливает hex', () => {
    const res = recoverKeyPair(HEX)
    expect(res.format).toBe('hex')
    expect(res.keyPair.privateKey.toString('hex')).toBe(HEX)
  })

  it('восстанавливает WIF при явно указанном format', () => {
    // Авто-детект WIF использует bitcoin-сеть (см. наблюдение в CODE_AUDIT §8),
    // поэтому для Pocketnet-WIF задаём формат явно.
    const res = recoverKeyPair(POCKETNET_WIF, { format: 'wif' })
    expect(res.format).toBe('wif')
    expect(res.keyPair.ecPair.toWIF()).toBe(POCKETNET_WIF)
  })

  it('бросает, если формат не распознан', () => {
    expect(() => recoverKeyPair('definitely-not-a-key')).toThrow('Unable to detect private key format')
  })
})
