import { describe, it, expect, vi } from 'vitest'
// ВАЖНО: используем глобальный Buffer (как и сам transaction-signature.ts),
// а не npm-пакет 'buffer'. Иначе Buffer.isBuffer() из исходника не признаёт
// буферы теста, когда другой тест-файл подменяет globalThis.Buffer.
import {
  signTransactionInput,
  getAddressTypeForSigning,
  signTransactionForAddress,
  createTransactionSignature,
} from './transaction-signature'
import type { KeyPair } from '../../types/keys'
import type { TransactionBuilder } from '../../types/btc17-types'

// ---------------------------------------------------------------------------
// Заглушки: TransactionBuilder с шпионом sign() и keyPair с stub ecPair.
// ---------------------------------------------------------------------------

function makeBuilder() {
  return { sign: vi.fn() } as unknown as TransactionBuilder & { sign: ReturnType<typeof vi.fn> }
}

function makeKeyPair(sign: (data: Buffer) => Buffer | Uint8Array = () => Buffer.from('ab', 'hex')) {
  return {
    privateKey: Buffer.from('11', 'hex'),
    publicKey: Buffer.from('02aabbcc', 'hex'),
    ecPair: { sign } as unknown as KeyPair['ecPair'],
  } as KeyPair
}

describe('signTransactionInput', () => {
  it('бросает, если нет transactionBuilder', () => {
    expect(() =>
      signTransactionInput(null as unknown as TransactionBuilder, 0, makeKeyPair())
    ).toThrow('Transaction builder is required')
  })

  it('бросает, если keyPair невалиден', () => {
    expect(() =>
      signTransactionInput(makeBuilder(), 0, { publicKey: Buffer.alloc(0) } as unknown as KeyPair)
    ).toThrow('Valid key pair is required')
  })

  it('обычная подпись: builder.sign(index, ecPair) и возврат pubkey', () => {
    const builder = makeBuilder()
    const kp = makeKeyPair()

    const res = signTransactionInput(builder, 2, kp, { inputIndex: 2 })

    expect(builder.sign).toHaveBeenCalledWith(2, kp.ecPair)
    expect(res).toEqual({ signature: '', pubkey: '02aabbcc', address: '' })
  })

  it('options.inputIndex имеет приоритет над позиционным inputIndex', () => {
    const builder = makeBuilder()
    const kp = makeKeyPair()

    signTransactionInput(builder, 0, kp, { inputIndex: 5 })

    expect(builder.sign).toHaveBeenCalledWith(5, kp.ecPair)
  })

  it('квирк: без options inputIndex берётся из дефолта {inputIndex:0}, позиционный игнорируется', () => {
    // index = optIndex ?? inputIndex; дефолт options = {inputIndex:0} ⇒ optIndex=0,
    // поэтому позиционный inputIndex (2) не используется.
    const builder = makeBuilder()
    const kp = makeKeyPair()

    signTransactionInput(builder, 2, kp)

    expect(builder.sign).toHaveBeenCalledWith(0, kp.ecPair)
  })

  it('специальный тип: prevOutScript+prevOutScriptType → объектная форма sign()', () => {
    const builder = makeBuilder()
    const kp = makeKeyPair()
    const script = Buffer.from('beef', 'hex')

    signTransactionInput(builder, 1, kp, {
      inputIndex: 1,
      prevOutScript: script,
      prevOutScriptType: 'htlc',
    })

    expect(builder.sign).toHaveBeenCalledWith({
      prevOutScript: script,
      prevOutScriptType: 'htlc',
      vin: 1,
      keyPair: kp.ecPair,
    })
  })

  it('оборачивает ошибку builder.sign', () => {
    const builder = makeBuilder()
    builder.sign.mockImplementation(() => {
      throw new Error('bad input')
    })

    expect(() => signTransactionInput(builder, 0, makeKeyPair())).toThrow(
      'Failed to sign transaction input: bad input'
    )
  })
})

describe('getAddressTypeForSigning', () => {
  it.each(['Paddr', 'Taddr'])('классифицирует %s как p2pkh', (addr) => {
    expect(getAddressTypeForSigning(addr)).toBe('p2pkh')
  })

  it.each(['3addr', 'Yaddr', 'Zaddr'])('классифицирует %s как p2sh', (addr) => {
    expect(getAddressTypeForSigning(addr)).toBe('p2sh')
  })

  it('обрезает пробелы перед классификацией', () => {
    expect(getAddressTypeForSigning('  Paddr  ')).toBe('p2pkh')
  })

  it('возвращает null для неизвестного префикса', () => {
    expect(getAddressTypeForSigning('Xaddr')).toBeNull()
  })

  it('возвращает null для пустого/не-строкового значения', () => {
    expect(getAddressTypeForSigning('')).toBeNull()
    expect(getAddressTypeForSigning(null as unknown as string)).toBeNull()
  })
})

describe('signTransactionForAddress', () => {
  it('бросает, если вход или его адрес отсутствуют', () => {
    expect(() =>
      signTransactionForAddress(makeBuilder(), null as never, 0, makeKeyPair())
    ).toThrow('Valid transaction input is required')
  })

  it('бросает для неподдерживаемого типа адреса', () => {
    expect(() =>
      signTransactionForAddress(makeBuilder(), { address: 'Xbad' }, 0, makeKeyPair())
    ).toThrow('Unsupported address type for signing')
  })

  it('p2pkh-адрес → обычная подпись по индексу', () => {
    const builder = makeBuilder()
    const kp = makeKeyPair()

    signTransactionForAddress(builder, { address: 'Paddr' }, 3, kp)

    expect(builder.sign).toHaveBeenCalledWith(3, kp.ecPair)
  })

  it('htlc-вход со scriptPubKey → объектная форма с prevOutScript', () => {
    const builder = makeBuilder()
    const kp = makeKeyPair()

    signTransactionForAddress(
      builder,
      { address: 'Paddr', type: 'htlc', scriptPubKey: 'beef' },
      1,
      kp
    )

    expect(builder.sign).toHaveBeenCalledWith({
      prevOutScript: Buffer.from('beef', 'hex'),
      prevOutScriptType: 'htlc',
      vin: 1,
      keyPair: kp.ecPair,
    })
  })
})

describe('createTransactionSignature', () => {
  it('бросает, если data не Buffer', () => {
    expect(() =>
      createTransactionSignature('nope' as unknown as Buffer, makeKeyPair(), 'Paddr')
    ).toThrow('Valid data buffer is required')
  })

  it('бросает, если keyPair невалиден', () => {
    expect(() =>
      createTransactionSignature(Buffer.from('00'), {} as unknown as KeyPair, 'Paddr')
    ).toThrow('Valid key pair is required')
  })

  it('бросает, если адрес отсутствует', () => {
    expect(() => createTransactionSignature(Buffer.from('00'), makeKeyPair(), '')).toThrow(
      'Address is required'
    )
  })

  it('подписывает данные и возвращает hex-подпись, pubkey, адрес', () => {
    const sign = vi.fn(() => Buffer.from('feed', 'hex'))
    const kp = makeKeyPair(sign)
    const data = Buffer.from('0011', 'hex')

    const res = createTransactionSignature(data, kp, 'Paddr')

    expect(sign).toHaveBeenCalledWith(data)
    expect(res).toEqual({ signature: 'feed', pubkey: '02aabbcc', address: 'Paddr' })
  })

  it('оборачивает ошибку подписи', () => {
    const kp = makeKeyPair(() => {
      throw new Error('sign fail')
    })

    expect(() => createTransactionSignature(Buffer.from('00'), kp, 'Paddr')).toThrow(
      'Failed to create transaction signature: sign fail'
    )
  })
})
