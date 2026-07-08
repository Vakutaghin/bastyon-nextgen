// Миграция legacy fingerprint-шифрованных секретов на ключ сейфа S (P0-1).
//
// Идемпотентна и самоисцеляема: перешифровывает каждый payload из fingerprint→S
// по отдельности; повреждённый/чужой blob оставляет под fingerprint (allOk=false),
// fingerprint НЕ удаляется, ретрай на следующем буте. Порядок: перешифровать и
// проверить round-trip'ом ПЕРЕД записью; fingerprint удаляет вызывающий
// (crypto-vault) только когда allOk === true.
//
// Формат хранения: BST_ACCOUNTS_LIST — «голый» v2:-шифротекст; BST_MNEMONIC и
// BST_ACCOUNT_<addr> — JSON-конверт {data,timestamp,version}. sessionStorage-мнемоника
// (legacy) тоже сканируется, чтобы удаление fingerprint её не осиротило [M3].

import { encryptData, decryptData } from '../encryption'
import { MNEMONIC_STORAGE_KEY, ACCOUNT_STORAGE_PREFIX } from '../../constants/storage'
import { ACCOUNTS_LIST_KEY } from '../storage-constants'
import { looksLikeSecret, looksLikeAccountsList } from './plausibility'

export interface MigrationResult {
  allOk: boolean
  migratedCount: number
}

type Shape = 'bare' | 'wrapped'

function shapeOf(key: string): Shape {
  return key === ACCOUNTS_LIST_KEY ? 'bare' : 'wrapped'
}

function extractCiphertext(shape: Shape, raw: string): string | null {
  if (shape === 'bare') return raw
  try {
    const o = JSON.parse(raw) as { data?: unknown }
    return typeof o?.data === 'string' ? o.data : null
  } catch {
    return null
  }
}

function repack(shape: Shape, ciphertext: string): string {
  if (shape === 'bare') return ciphertext
  return JSON.stringify({ data: ciphertext, timestamp: Date.now(), version: '2.0' })
}

/** Правдоподобие расшифровки по форме (общее с heal-ветками, см. plausibility.ts). */
function isPlausible(key: string, plain: string): boolean {
  return key === ACCOUNTS_LIST_KEY ? looksLikeAccountsList(plain) : looksLikeSecret(plain)
}

interface Target {
  key: string
  storage: Storage
}

function collectTargets(): Target[] {
  const targets: Target[] = []
  const ls = typeof localStorage !== 'undefined' ? localStorage : null
  const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null

  if (ls) {
    targets.push({ key: MNEMONIC_STORAGE_KEY, storage: ls })
    targets.push({ key: ACCOUNTS_LIST_KEY, storage: ls })
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && k.startsWith(ACCOUNT_STORAGE_PREFIX)) targets.push({ key: k, storage: ls })
    }
  }
  // legacy: мнемоника могла осесть в sessionStorage от старых сборок
  if (ss && ss.getItem(MNEMONIC_STORAGE_KEY)) {
    targets.push({ key: MNEMONIC_STORAGE_KEY, storage: ss })
  }
  return targets
}

/**
 * Перешифровывает все legacy-секреты с fingerprint на S.
 * @param secretB64 base64(S) — ключ сейфа.
 * @param fingerprint сырой BST_DEVICE_FINGERPRINT; null → мигрировать нечего.
 * @returns allOk=true, если каждый присутствующий payload читается под S или fp и
 *   успешно перешифрован; тогда вызывающий вправе удалить fingerprint.
 */
export function migrateLegacyToVault(
  secretB64: string,
  fingerprint: string | null
): MigrationResult {
  if (!fingerprint) return { allOk: true, migratedCount: 0 }

  let allOk = true
  let migratedCount = 0

  for (const { key, storage } of collectTargets()) {
    const raw = storage.getItem(key)
    if (!raw) continue // отсутствует — не критично [C13]

    const shape = shapeOf(key)
    const ciphertext = extractCiphertext(shape, raw)
    if (!ciphertext) {
      // непарсимый конверт — не трогаем, оставляем fingerprint
      allOk = false
      continue
    }

    // Пытаемся под S (уже мигрирован?), затем под fingerprint. Плаузибилити — до записи.
    let plain: string | null = null
    let underS = false
    try {
      const p = decryptData(ciphertext, secretB64)
      if (isPlausible(key, p)) {
        plain = p
        underS = true
      }
    } catch {
      /* wrong key / malformed — пробуем fingerprint */
    }
    if (plain === null) {
      try {
        const p = decryptData(ciphertext, fingerprint)
        if (isPlausible(key, p)) plain = p
      } catch {
        /* unreadable */
      }
    }

    if (plain === null) {
      allOk = false // не смогли прочитать ни под S, ни под fp → оставляем fingerprint
      continue
    }
    if (underS) continue // уже под S — идемпотентно, ничего не пишем

    // Перешифровываем под S + round-trip verify ПЕРЕД записью [A3].
    let reblob: string
    try {
      reblob = encryptData(plain, secretB64)
      if (decryptData(reblob, secretB64) !== plain) {
        allOk = false
        continue
      }
    } catch {
      allOk = false
      continue
    }

    try {
      storage.setItem(key, repack(shape, reblob))
      migratedCount++
    } catch {
      // quota и пр. — payload остаётся под fp, читается через heal-ветку [C4]
      allOk = false
    }
  }

  return { allOk, migratedCount }
}
