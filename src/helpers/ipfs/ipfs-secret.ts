// Расшифровка приватного файла на этом устройстве (веб и телефон). Формат тот
// же, что у Rust (src-tauri/src/ipfs/crypto.rs): nonce(12) || шифртекст ||
// тег(16), AES-256-GCM. Ключ — base64 из фрагмента ссылки, на шлюз он не уходит.
// Тег GCM заодно гарантирует целостность: подменённый шифртекст не расшифруется.
import { SecretError } from './ipfs-errors'

const NONCE_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32

/** Сколько шифр добавляет к размеру файла. */
export const SECRET_OVERHEAD = NONCE_LEN + TAG_LEN

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

export async function decryptSecretFile(
  keyB64: string,
  blob: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', decodeKey(keyB64), 'AES-GCM', false, ['decrypt'])
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
