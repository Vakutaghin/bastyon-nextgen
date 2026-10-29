/**
 * Шифрование переписки, сохранённой на устройстве. Ключ AES-GCM выводится
 * (HKDF-SHA-256) из приватного ключа аккаунта: без входа в этот аккаунт
 * копию не прочитать — ни другому аккаунту на устройстве, ни с диска. Ключ
 * не извлекаемый и живёт только в памяти, пока аккаунт открыт.
 */

const SALT = new TextEncoder().encode('bastyon-chat-archive')
const INFO = new TextEncoder().encode('v1')

export interface Sealed {
  iv: Uint8Array
  data: Uint8Array
}

/** Ключ копии из приватного ключа аккаунта (те же байты — тот же ключ). Buffer тоже годится. */
export async function deriveArchiveKey(privateKey: ArrayLike<number>): Promise<CryptoKey> {
  const raw = toBuffer(Uint8Array.from(privateKey))
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { iv, data: new Uint8Array(data) }
}

/** null — не расшифровалось: чужой ключ или повреждённая запись. */
export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBuffer(sealed.iv) },
      key,
      toBuffer(sealed.data)
    )
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}

/** WebCrypto в части движков не берёт Buffer и срезы: отдаём отдельную копию байтов. */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}
