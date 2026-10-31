// Замок приложения: пин-код или графический ключ на вход.
//
// Замок — над сейфом, а не вместо него: фраза и ключи по-прежнему зашифрованы
// сейфом (blockchain/storage/vault), код их не перешифровывает. Короткий код
// перебирается за секунды, так что шифровать им ключи — ложная защита; он
// закрывает приложение от того, у кого в руках устройство.
//
// Сам код нигде не хранится. В localStorage — подпись кода HMAC-SHA256 ключом,
// выведенным из секрета сейфа (HKDF): по файлам приложения код не подобрать,
// не открыв сейф. Проверка — доли миллисекунды, ввод не ждёт.

import { APP_LOCK_KEY, APP_LOCK_ATTEMPTS_KEY } from '@/blockchain/constants/storage'
import {
  bytesToB64,
  b64ToBytes,
  randomBytes,
  SALT_BYTES,
} from '@/blockchain/storage/vault/vault-crypto'

export type LockKind = 'pin' | 'pattern'

/** Через сколько без дела приложение закрывается само. */
export type AutoLockAfter = 'now' | 'min1' | 'min5' | 'min15' | 'hour1' | 'never'

export const AUTO_LOCK_OPTIONS: readonly AutoLockAfter[] = [
  'now',
  'min1',
  'min5',
  'min15',
  'hour1',
  'never',
]

/**
 * Сколько можно не трогать приложение. `now` — закрыть, как только его
 * свернули; открытое и брошенное оно ждёт столько же, сколько при «5 минутах».
 * `null` — только при запуске.
 */
export const AUTO_LOCK_MS: Record<AutoLockAfter, number | null> = {
  now: 0,
  min1: 60_000,
  min5: 5 * 60_000,
  min15: 15 * 60_000,
  hour1: 60 * 60_000,
  never: null,
}

export const PIN_LENGTHS = [4, 6] as const
export type PinLength = (typeof PIN_LENGTHS)[number]

/** Меньше четырёх точек ключ не принимается — как в Android. */
export const PATTERN_MIN_DOTS = 4

export interface AppLockConfig {
  v: 1
  kind: LockKind
  /** Цифр в пин-коде: набрали все — код проверяется сам, без кнопки. */
  digits?: PinLength
  salt: string
  mac: string
  autoLock: AutoLockAfter
}

function isConfig(o: unknown): o is AppLockConfig {
  if (!o || typeof o !== 'object') return false
  const c = o as Record<string, unknown>
  if (c.v !== 1 || typeof c.salt !== 'string' || typeof c.mac !== 'string') return false
  if (!AUTO_LOCK_OPTIONS.includes(c.autoLock as AutoLockAfter)) return false
  if (c.kind === 'pattern') return true
  return c.kind === 'pin' && PIN_LENGTHS.includes(c.digits as PinLength)
}

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readLockConfig(): AppLockConfig | null {
  try {
    const raw = ls()?.getItem(APP_LOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeLockConfig(config: AppLockConfig): void {
  ls()?.setItem(APP_LOCK_KEY, JSON.stringify(config))
}

export function clearLockConfig(): void {
  try {
    ls()?.removeItem(APP_LOCK_KEY)
    ls()?.removeItem(APP_LOCK_ATTEMPTS_KEY)
  } catch {
    /* хранилище недоступно */
  }
}

/** Ключ графического ключа — номера точек 0–8 по порядку соединения. */
export function patternToCode(dots: readonly number[]): string {
  return dots.join('')
}

// ─── подпись кода ─────────────────────────────────────────────────────────────

const HKDF_INFO = 'bastyon-app-lock:v1'

async function lockKey(vaultSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(vaultSecret),
    'HKDF',
    false,
    ['deriveKey']
  )
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as BufferSource,
      info: new TextEncoder().encode(HKDF_INFO),
    },
    material,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  )
}

async function macOf(
  vaultSecret: string,
  salt: Uint8Array,
  kind: LockKind,
  code: string
): Promise<string> {
  const key = await lockKey(vaultSecret, salt)
  const sig = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${kind}:${code}`)
  )
  return bytesToB64(new Uint8Array(sig))
}

/** Сравнение без раннего выхода: время ответа не подсказывает, сколько совпало. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createLockConfig(
  vaultSecret: string,
  kind: LockKind,
  code: string,
  autoLock: AutoLockAfter
): Promise<AppLockConfig> {
  const salt = randomBytes(SALT_BYTES)
  const mac = await macOf(vaultSecret, salt, kind, code)
  const config: AppLockConfig = { v: 1, kind, salt: bytesToB64(salt), mac, autoLock }
  if (kind === 'pin') config.digits = code.length as PinLength
  return config
}

export async function verifyLockCode(
  config: AppLockConfig,
  vaultSecret: string,
  code: string
): Promise<boolean> {
  const mac = await macOf(vaultSecret, b64ToBytes(config.salt), config.kind, code)
  return sameString(mac, config.mac)
}

// ─── попытки ──────────────────────────────────────────────────────────────────

export interface LockAttempts {
  failures: number
  /** До этого времени (мс) ввод закрыт; 0 — открыт. */
  until: number
}

/**
 * Четыре ошибки подряд — без паузы (промахнуться по кнопке легко), дальше
 * 30 секунд, минута, две и по пять минут. Весь пин-код из 4 цифр так
 * перебирается месяц.
 */
export function pauseAfter(failures: number): number {
  if (failures < 5) return 0
  if (failures === 5) return 30_000
  if (failures === 6) return 60_000
  if (failures === 7) return 120_000
  return 300_000
}

export function readLockAttempts(): LockAttempts {
  try {
    const raw = ls()?.getItem(APP_LOCK_ATTEMPTS_KEY)
    if (!raw) return { failures: 0, until: 0 }
    const o = JSON.parse(raw) as Partial<LockAttempts>
    return {
      failures: typeof o.failures === 'number' ? o.failures : 0,
      until: typeof o.until === 'number' ? o.until : 0,
    }
  } catch {
    return { failures: 0, until: 0 }
  }
}

export function recordLockFailure(now: number = Date.now()): LockAttempts {
  const failures = readLockAttempts().failures + 1
  const next: LockAttempts = { failures, until: now + pauseAfter(failures) }
  try {
    ls()?.setItem(APP_LOCK_ATTEMPTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearLockAttempts(): void {
  try {
    ls()?.removeItem(APP_LOCK_ATTEMPTS_KEY)
  } catch {
    /* ignore */
  }
}
