// Расшифровка приватного файла на этом устройстве (веб и телефон). Форматы те
// же, что у Rust (src-tauri/src/ipfs/crypto.rs), AES-256-GCM, ключ — base64 из
// фрагмента ссылки, на шлюз он не уходит. Тег GCM заодно гарантирует
// целостность: подменённый шифртекст не расшифруется.
//  - v1: nonce(12) || шифртекст || тег(16) одним куском — файл целиком в памяти;
//  - v2: заголовок "BSTN" | 2 | размер куска u32 BE | префикс nonce (7), дальше
//    куски, каждый со своим nonce: префикс || номер || признак последнего.
//    Расшифровывается потоком, память не растёт с размером файла.
import { SecretError } from './ipfs-errors'

const NONCE_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32

/** Сколько шифр v1 добавляет к размеру файла. */
export const SECRET_OVERHEAD = NONCE_LEN + TAG_LEN

const STREAM_MAGIC = [0x42, 0x53, 0x54, 0x4e] // "BSTN"
const STREAM_VERSION = 2
const STREAM_HEADER_LEN = 16
const PREFIX_OFFSET = 9
/** Больше кусок не бывает: иначе «кусок» из чужого заголовка съел бы память. */
const MAX_STREAM_CHUNK = 16 * 1024 * 1024

function decodeKey(keyB64: string): Uint8Array<ArrayBuffer> {
  let raw: string
  try {
    raw = atob(keyB64.trim())
  } catch {
    throw new SecretError('bad key')
  }
  if (raw.length !== KEY_LEN) throw new SecretError('bad key')
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function importKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', decodeKey(keyB64), 'AES-GCM', false, ['decrypt'])
}

/** Начало шифртекста — формат v2 (кусками)? */
export function isStreamFormat(head: Uint8Array): boolean {
  return STREAM_MAGIC.every((b, i) => head[i] === b) && head[4] === STREAM_VERSION
}

/** Формат v1: весь шифртекст в памяти. */
export async function decryptSecretFile(
  keyB64: string,
  blob: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await importKey(keyB64)
  if (blob.length < SECRET_OVERHEAD) throw new SecretError('ciphertext too short')
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.subarray(0, NONCE_LEN) },
      key,
      blob.subarray(NONCE_LEN)
    )
    return new Uint8Array(plain)
  } catch {
    throw new SecretError('decrypt failed')
  }
}

function concat(a: Uint8Array<ArrayBuffer>, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

/**
 * Формат v2 по мере прихода шифртекста. Кусок расшифровывается, когда пришёл
 * следующий: только так известно, последний ли он. Отрезанный хвост,
 * переставленные куски и чужой ключ — SecretError.
 */
export async function* decryptSecretStream(
  keyB64: string,
  input: AsyncIterable<Uint8Array>,
  maxBytes: number
): AsyncGenerator<Uint8Array<ArrayBuffer>, void, undefined> {
  const key = await importKey(keyB64)
  let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(0)
  let header: Uint8Array<ArrayBuffer> | null = null
  let sealedLen = 0
  let counter = 0
  let total = 0

  const open = async (sealed: Uint8Array<ArrayBuffer>, last: boolean) => {
    const head = header as Uint8Array<ArrayBuffer>
    const nonce = new Uint8Array(NONCE_LEN)
    nonce.set(head.subarray(PREFIX_OFFSET, STREAM_HEADER_LEN))
    new DataView(nonce.buffer).setUint32(7, counter)
    nonce[11] = last ? 1 : 0
    let plain: ArrayBuffer
    try {
      plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: head },
        key,
        sealed
      )
    } catch {
      throw new SecretError('decrypt failed')
    }
    counter += 1
    total += plain.byteLength
    if (total > maxBytes) throw new SecretError('the file is too large')
    return new Uint8Array(plain)
  }

  for await (const piece of input) {
    buffer = concat(buffer, piece)
    if (!header) {
      if (buffer.length < STREAM_HEADER_LEN) continue
      header = buffer.slice(0, STREAM_HEADER_LEN)
      if (!isStreamFormat(header)) throw new SecretError('not an encrypted file of a known format')
      const chunk = new DataView(header.buffer).getUint32(5)
      if (chunk === 0 || chunk > MAX_STREAM_CHUNK) throw new SecretError('bad chunk size')
      sealedLen = chunk + TAG_LEN
      buffer = buffer.slice(STREAM_HEADER_LEN)
    }
    // Больше одного куска в буфере — первый точно не последний.
    while (buffer.length > sealedLen) {
      yield await open(buffer.slice(0, sealedLen), false)
      buffer = buffer.slice(sealedLen)
    }
  }
  if (!header || buffer.length < TAG_LEN) throw new SecretError('ciphertext too short')
  yield await open(buffer, true)
}
