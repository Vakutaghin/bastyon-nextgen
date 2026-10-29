// Durable-хранилище конверта BST_VAULT в localStorage: чтение (первичный+backup,
// устойчиво к повреждению), запись (backup-first commit), очистка и детект
// наличия любых зашифрованных данных. Чистый persistence-адаптер — не держит
// секрет в памяти (стейт-машина живёт в crypto-vault). Аудит крупных файлов 2026-08.

import {
  MNEMONIC_STORAGE_KEY,
  ACCOUNT_STORAGE_PREFIX,
  VAULT_ENVELOPE_KEY,
  VAULT_ENVELOPE_BACKUP_KEY,
  VAULT_MIGRATION_KEY,
} from '../../constants/storage'
import { ACCOUNTS_LIST_KEY } from '../storage-constants'
import type { WrapEnvelope, Pbkdf2Hash } from './vault-crypto'
import { ls, lsRemove } from './vault-ls'

export interface DeviceEnvelope extends WrapEnvelope {
  v: 1
  mode: 'device'
  migrated: boolean
}
export interface PassphraseEnvelope extends WrapEnvelope {
  v: 1
  mode: 'passphrase'
  kdf: 'PBKDF2'
  hash: Pbkdf2Hash
  iter: number
  salt: string
}
export type VaultEnvelope = DeviceEnvelope | PassphraseEnvelope

export function isEnvelope(e: unknown): e is VaultEnvelope {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  if (o.v !== 1 || typeof o.iv !== 'string' || typeof o.ct !== 'string') return false
  if (o.mode === 'device') return typeof o.migrated === 'boolean'
  if (o.mode === 'passphrase')
    return typeof o.salt === 'string' && typeof o.iter === 'number' && typeof o.hash === 'string'
  return false
}

/** Читает конверт: сначала первичный, затем backup — устойчиво к повреждению [A4/C5]. */
export function readEnvelope(): VaultEnvelope | null {
  const store = ls()
  if (!store) return null
  for (const key of [VAULT_ENVELOPE_KEY, VAULT_ENVELOPE_BACKUP_KEY]) {
    const raw = store.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (isEnvelope(parsed)) return parsed
    } catch {
      /* пробуем backup */
    }
  }
  return null
}

/** Пишет конверт: backup первым (валидная копия), затем первичный = commit. */
export function writeEnvelope(env: VaultEnvelope): void {
  const store = ls()
  if (!store) return
  const raw = JSON.stringify(env)
  store.setItem(VAULT_ENVELOPE_BACKUP_KEY, raw)
  store.setItem(VAULT_ENVELOPE_KEY, raw)
}

export function clearEnvelope(): void {
  lsRemove(VAULT_ENVELOPE_KEY)
  lsRemove(VAULT_ENVELOPE_BACKUP_KEY)
  lsRemove(VAULT_MIGRATION_KEY)
}

/**
 * Шифротексты всех записей под сейфом: фраза, список аккаунтов, аккаунты — в
 * localStorage и sessionStorage. Записи с конвертом `{data}` разворачиваем.
 */
export function listEncryptedPayloads(): string[] {
  const out: string[] = []
  const stores = [ls(), typeof sessionStorage !== 'undefined' ? sessionStorage : null]
  for (const store of stores) {
    if (!store) continue
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)
        if (!k) continue
        if (
          k !== MNEMONIC_STORAGE_KEY &&
          k !== ACCOUNTS_LIST_KEY &&
          !k.startsWith(ACCOUNT_STORAGE_PREFIX)
        )
          continue
        const raw = store.getItem(k)
        if (!raw) continue
        if (!raw.startsWith('{')) {
          out.push(raw)
          continue
        }
        try {
          const data = (JSON.parse(raw) as { data?: unknown }).data
          if (typeof data === 'string') out.push(data)
        } catch {
          /* битая запись — прочитается и разберётся как раньше */
        }
      }
    } catch {
      /* хранилище недоступно */
    }
  }
  return out
}

export function hasAnyEncryptedPayload(): boolean {
  const store = ls()
  if (!store) return false
  if (store.getItem(MNEMONIC_STORAGE_KEY)) return true
  if (store.getItem(ACCOUNTS_LIST_KEY)) return true
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k && k.startsWith(ACCOUNT_STORAGE_PREFIX)) return true
  }
  return false
}
