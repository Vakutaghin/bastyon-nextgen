// Device-ключ сейфа в нативном хранилище Capacitor (VP-2).
//
// Зачем: в WKWebView IndexedDB — best-effort хранилище, ITP вытесняет его через
// 7 дней без использования приложения → device-ключ пропадал, а с ним и доступ
// к сохранённым аккаунтам (needs-reset). `@capacitor/preferences` пишет в
// UserDefaults (iOS) / SharedPreferences (Android): данные приложения, не
// вытесняются, не входят в web-storage WebView — копия web-хранилища сама по
// себе ничего не расшифрует (свойство P0-1 сохраняется).
//
// Честно: это НЕ Keychain/EncryptedSharedPreferences — байты лежат в plist/xml
// внутри песочницы приложения (под защитой файлового шифрования ОС). Апгрейд до
// Keychain — отдельный плагин, интерфейс VaultKeyStore тот же.
//
// Сырые 32 байта → в JS импортируются как non-extractable AES-GCM CryptoKey, так
// что остальной код сейфа видит тот же тип, что и из IndexedDB.

import type { VaultKeyStore } from './vault-key-store'
import { b64ToBytes, bytesToB64, randomBytes } from './vault-crypto'

export const CAPACITOR_VAULT_KEY = 'bastyon-vault:device-key'
const KEY_BYTES = 32

/** Минимум от `Preferences` из @capacitor/preferences — для инъекции в тестах. */
export interface PreferencesLike {
  get(opts: { key: string }): Promise<{ value: string | null }>
  set(opts: { key: string; value: string }): Promise<void>
  remove(opts: { key: string }): Promise<void>
}

function importRaw(raw: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export function createCapacitorVaultKeyStore(prefs: PreferencesLike): VaultKeyStore {
  return {
    async getKey() {
      const { value } = await prefs.get({ key: CAPACITOR_VAULT_KEY })
      if (!value) return null
      const raw = b64ToBytes(value)
      if (raw.length !== KEY_BYTES) return null // повреждено → как отсутствие ключа
      return importRaw(raw)
    },
    async createKey() {
      const raw = randomBytes(KEY_BYTES)
      await prefs.set({ key: CAPACITOR_VAULT_KEY, value: bytesToB64(raw) })
      return importRaw(raw)
    },
    async deleteKey() {
      await prefs.remove({ key: CAPACITOR_VAULT_KEY })
    },
  }
}
