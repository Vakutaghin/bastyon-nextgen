/**
 * Байты для протоколов mesh-радио: hex, UTF-8, числа little-endian.
 *
 * Отдельно от buffer-полифилла: протокольный код работает с Uint8Array и
 * одинаково запускается в браузере, в Tauri, в тестах и в e2e-стенде.
 */

const encoder = new TextEncoder()
// fatal: false — битый UTF-8 из эфира не должен ронять разбор кадра.
const decoder = new TextDecoder('utf-8', { fatal: false })

export function utf8(text: string): Uint8Array {
  return encoder.encode(text)
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

/** Строка из поля фиксированной длины: до первого нулевого байта. */
export function fromUtf8z(bytes: Uint8Array): string {
  const end = bytes.indexOf(0)
  return fromUtf8(end === -1 ? bytes : bytes.subarray(0, end))
}

/** Длина текста в байтах UTF-8 (кириллица — 2 байта на букву). */
export function utf8Length(text: string): number {
  return encoder.encode(text).length
}

/**
 * Самое длинное начало текста, которое помещается в `maxBytes` байт UTF-8, не
 * разрезая символ (и суррогатную пару эмодзи).
 */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  if (utf8Length(text) <= maxBytes) return text
  let used = 0
  let out = ''
  for (const ch of text) {
    const size = utf8Length(ch)
    if (used + size > maxBytes) break
    used += size
    out += ch
  }
  return out
}

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase()
  if (clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) throw new Error(`bad hex: ${hex}`)
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

export function u16le(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

export function u32le(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value >>> 0, true)
  return out
}

export function i32le(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, value | 0, true)
  return out
}

/** Чтение кадра по порядку, без выхода за его конец. */
export class ByteReader {
  private at = 0
  private readonly view: DataView

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  get offset(): number {
    return this.at
  }

  get remaining(): number {
    return this.bytes.length - this.at
  }

  private need(n: number): void {
    if (this.at + n > this.bytes.length) {
      throw new RangeError(`frame too short: need ${n} at ${this.at} of ${this.bytes.length}`)
    }
  }

  u8(): number {
    this.need(1)
    return this.bytes[this.at++]!
  }

  i8(): number {
    this.need(1)
    return this.view.getInt8(this.at++)
  }

  u16(): number {
    this.need(2)
    const v = this.view.getUint16(this.at, true)
    this.at += 2
    return v
  }

  u32(): number {
    this.need(4)
    const v = this.view.getUint32(this.at, true)
    this.at += 4
    return v
  }

  i32(): number {
    this.need(4)
    const v = this.view.getInt32(this.at, true)
    this.at += 4
    return v
  }

  bytesN(n: number): Uint8Array {
    this.need(n)
    const out = this.bytes.slice(this.at, this.at + n)
    this.at += n
    return out
  }

  rest(): Uint8Array {
    const out = this.bytes.slice(this.at)
    this.at = this.bytes.length
    return out
  }

  skip(n: number): void {
    this.need(n)
    this.at += n
  }
}
