// Стейт-машина «сейфа» (P0-1). Владеет секретом S в памяти и его обёрткой на диске.
//
// Единственная индирекция: S (32 байта) заменяет device-fingerprint как ключ для
// НЕизменённого crypto-js слоя (encryptData/decryptData). Сам S хранится только
// обёрнутым в конверте BST_VAULT: passwordless — под non-extractable AES-GCM
// CryptoKey в IndexedDB; passphrase — под PBKDF2-ключом (пароль нигде не хранится).
//
// Разворачивается один раз на буте (async, ensureVaultReady). Дальше getVaultSecret()
// синхронно отдаёт кэш base64(S) — весь storage-слой остаётся синхронным.
//
// Никогда не «кирпичит»: любой инфра-сбой → нестрогий статус (degraded/storage-
// unavailable/needs-reset), из которого есть восстановление через 12 слов. Гонки
// таб-в-таб сериализуются navigator.locks; в JS-контексте — мемоизацией readyPromise.
// framework-free (без pinia); UI-оркестровка — в vault-unlock.ts.

import {
  MNEMONIC_STORAGE_KEY,
  ACCOUNT_STORAGE_PREFIX,
  DEVICE_FINGERPRINT_KEY,
  VAULT_ENVELOPE_KEY,
  VAULT_ENVELOPE_BACKUP_KEY,
  VAULT_MIGRATION_KEY,
  VAULT_ATTEMPTS_KEY,
} from '../../constants/storage'
import { ACCOUNTS_LIST_KEY } from '../storage-constants'
import { getDeviceFingerprint, readStoredFingerprint } from '../device-fingerprint'
import { migrateLegacyToVault } from './vault-migration'
import {
  isSubtleAvailable,
  generateSecret,
  generateDeviceKey,
  derivePassphraseKey,
  wrapSecret,
  unwrapSecret,
  bytesToB64,
  b64ToBytes,
  randomBytes,
  DEFAULT_PBKDF2_ITERATIONS,
  SALT_BYTES,
  type Pbkdf2Hash,
  type WrapEnvelope,
} from './vault-crypto'
import { indexedDbVaultKeyStore, type VaultKeyStore } from './vault-key-store'

export type VaultStatus =
  | 'unknown'
  | 'empty'
  | 'unlocked'
  | 'needs-passphrase'
  | 'needs-reset'
  | 'storage-unavailable'
  | 'degraded-fingerprint'
export type VaultLevel = 'none' | 'device' | 'passphrase'
export interface VaultOutcome {
  status: VaultStatus
  level: VaultLevel
}

export class VaultLockedError extends Error {
  constructor() {
    super('vault is locked')
    this.name = 'VaultLockedError'
  }
}

interface DeviceEnvelope extends WrapEnvelope {
  v: 1
  mode: 'device'
  migrated: boolean
}
interface PassphraseEnvelope extends WrapEnvelope {
  v: 1
  mode: 'passphrase'
  kdf: 'PBKDF2'
  hash: Pbkdf2Hash
  iter: number
  salt: string
}
type VaultEnvelope = DeviceEnvelope | PassphraseEnvelope

interface Deps {
  keyStore: VaultKeyStore
}
let deps: Deps = { keyStore: indexedDbVaultKeyStore }

// In-memory состояние (НЕ pinia/reactive — это модульный синглтон).
let secret: Uint8Array | null = null
let secretB64: string | null = null
let level: VaultLevel = 'none'
let status: VaultStatus = 'unknown'
let degraded = false
let readyPromise: Promise<VaultOutcome> | null = null

/** Тесты инъектируют in-memory keyStore (happy-dom без indexedDB). */
export function configureVault(newDeps: Partial<Deps>): void {
  deps = { ...deps, ...newDeps }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}
function lsRemove(key: string): void {
  try {
    ls()?.removeItem(key)
  } catch {
    /* ignore */
  }
}

function isEnvelope(e: unknown): e is VaultEnvelope {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  if (o.v !== 1 || typeof o.iv !== 'string' || typeof o.ct !== 'string') return false
  if (o.mode === 'device') return typeof o.migrated === 'boolean'
  if (o.mode === 'passphrase')
    return typeof o.salt === 'string' && typeof o.iter === 'number' && typeof o.hash === 'string'
  return false
}

/** Читает конверт: сначала первичный, затем backup — устойчиво к повреждению [A4/C5]. */
function readEnvelope(): VaultEnvelope | null {
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
function writeEnvelope(env: VaultEnvelope): void {
  const store = ls()
  if (!store) return
  const raw = JSON.stringify(env)
  store.setItem(VAULT_ENVELOPE_BACKUP_KEY, raw)
  store.setItem(VAULT_ENVELOPE_KEY, raw)
}

function clearEnvelope(): void {
  lsRemove(VAULT_ENVELOPE_KEY)
  lsRemove(VAULT_ENVELOPE_BACKUP_KEY)
  lsRemove(VAULT_MIGRATION_KEY)
}

function hasAnyEncryptedPayload(): boolean {
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

// ─── cross-tab lock ───────────────────────────────────────────────────────────

interface LockManagerLike {
  request(name: string, fn: () => Promise<unknown>): Promise<unknown>
}
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as unknown as { locks?: LockManagerLike })?.locks
  if (locks?.request) {
    return (await locks.request('bastyon-vault-init', fn as () => Promise<unknown>)) as T
  }
  return fn()
}

// ─── state helpers ────────────────────────────────────────────────────────────

function isUnlocked(): boolean {
  return secret !== null
}
function outcome(): VaultOutcome {
  return { status, level }
}
function setUnlocked(s: Uint8Array, lvl: VaultLevel): void {
  secret = s
  secretB64 = bytesToB64(s)
  level = lvl
  status = 'unlocked'
  degraded = false
}

// ─── public sync accessors (используются storage-keys/accounts) ───────────────

/** SYNC. unlocked → base64(S); degraded → fingerprint; иначе — throw (fail-safe backstop). */
export function getVaultSecret(): string {
  if (secretB64) return secretB64
  if (degraded) return getDeviceFingerprint()
  throw new VaultLockedError()
}

/** Сырой fingerprint для heal-ветки чтения; null после завершённой миграции. */
export function getVaultLegacyKey(): string | null {
  return readStoredFingerprint()
}

export function getVaultLevel(): VaultLevel {
  return level
}
export function getVaultStatus(): VaultStatus {
  return status
}
export function isVaultUnlocked(): boolean {
  return isUnlocked()
}
export function hasVault(): boolean {
  return readEnvelope() !== null
}

// ─── boot gate ────────────────────────────────────────────────────────────────

/** Мемоизированный бут-гейт. НИКОГДА не реджектит; транзиентные сбои не кэширует. */
export function ensureVaultReady(): Promise<VaultOutcome> {
  if (readyPromise) return readyPromise
  readyPromise = withLock(runReadyInner)
    .then((out) => {
      if (out.status === 'storage-unavailable') readyPromise = null // ретрай на следующем вызове [A2/B3]
      return out
    })
    .catch(() => {
      readyPromise = null
      status = 'storage-unavailable'
      return { status: 'storage-unavailable' as VaultStatus, level: 'none' as VaultLevel }
    })
  return readyPromise
}

async function runReadyInner(): Promise<VaultOutcome> {
  if (isUnlocked()) return outcome()
  if (!isSubtleAvailable()) {
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }

  const env = readEnvelope()

  if (env?.mode === 'device') {
    let key: CryptoKey | null
    try {
      key = await deps.keyStore.getKey()
    } catch {
      status = 'storage-unavailable'
      return { status, level: 'device' }
    }
    if (!key) {
      status = 'needs-reset'
      return { status, level: 'device' }
    }
    try {
      const s = await unwrapSecret(key, env)
      setUnlocked(s, 'device')
      return outcome()
    } catch {
      status = 'needs-reset' // конверт есть, ключ есть, но не разворачивается → повреждение
      return { status, level: 'device' }
    }
  }

  if (env?.mode === 'passphrase') {
    // Orphan device-ключ чистим ТОЛЬКО если enablePassphrase крэшнул на полпути
    // (маркер 'enable'). Безусловное удаление затирало бы device-ключ, который
    // конкурентный disablePassphrase в другой табе только что создал → needs-reset
    // и полное локальное стирание (cross-tab race). [P1-E]
    if (readMigrationMarker() === 'enable') {
      void deps.keyStore.deleteKey().catch(() => {})
      clearMigrationMarker()
    }
    status = 'needs-passphrase'
    level = 'passphrase'
    return outcome()
  }

  // Конверта нет/повреждён.
  const fp = readStoredFingerprint()
  if (hasAnyEncryptedPayload()) {
    if (fp) return bootstrapFromLegacy(fp)
    status = 'needs-reset' // payload'ы под S, но ни ключа, ни fingerprint → восстановление
    level = 'none'
    return outcome()
  }
  status = 'empty'
  level = 'none'
  return outcome()
}

/** Существующий fingerprint-кошелёк: создаём device-сейф; payload'ы мигрируют лениво. */
async function bootstrapFromLegacy(_fp: string): Promise<VaultOutcome> {
  const s = generateSecret()
  let key: CryptoKey
  try {
    key = await generateDeviceKey()
    await deps.keyStore.setKey(key)
  } catch {
    // Не смогли создать/сохранить ключ → остаёмся на fingerprint (payload'ы целы), ретрай позже [D2].
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }

  let env: DeviceEnvelope
  try {
    const wrap = await wrapSecret(key, s)
    env = { v: 1, mode: 'device', iv: wrap.iv, ct: wrap.ct, migrated: false }
  } catch {
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }
  writeEnvelope(env)

  // round-trip verify: ключ durable и конверт корректен [C3].
  try {
    const k2 = await deps.keyStore.getKey()
    if (!k2) throw new Error('key vanished')
    const s2 = await unwrapSecret(k2, env)
    if (bytesToB64(s2) !== bytesToB64(s)) throw new Error('verify mismatch')
  } catch {
    clearEnvelope()
    await deps.keyStore.deleteKey().catch(() => {})
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }

  setUnlocked(s, 'device')
  // Миграцию payload'ов НЕ гоним синхронно (crypto-js PBKDF2 медленный) — не морозим бут.
  // Чтение идёт через heal-ветку; finalizeMigration() (defer, Stage 4) добьёт и удалит fingerprint.
  return outcome()
}

// ─── first-persist (register/signIn) ──────────────────────────────────────────

/** Гарантирует наличие сейфа перед первой записью секрета. Идемпотентна; degrade-not-throw. */
export function ensureInitialized(): Promise<VaultOutcome> {
  return withLock(async () => {
    const out = await runReadyInner()
    if (out.status === 'empty') return mintDeviceVault()
    return out
  }).catch(() => {
    // Инфра-сбой (navigator.locks reject / бросок в readEnvelope) НЕ должен ронять
    // register/signIn: деградируем на fingerprint, свежий сид сохранится (level 0).
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  })
}

async function mintDeviceVault(): Promise<VaultOutcome> {
  const s = generateSecret()
  let key: CryptoKey
  try {
    key = await generateDeviceKey()
    await deps.keyStore.setKey(key)
    const wrap = await wrapSecret(key, s)
    writeEnvelope({ v: 1, mode: 'device', iv: wrap.iv, ct: wrap.ct, migrated: true })
  } catch {
    // Нет subtle/IDB → фоллбек на fingerprint (level 0). Свежий секрет НЕ теряем: getVaultSecret→fingerprint.
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }
  setUnlocked(s, 'device')
  readyPromise = Promise.resolve(outcome())
  return outcome()
}

// ─── deferred migration finalize ──────────────────────────────────────────────

/**
 * Досвечивает миграцию payload'ов fingerprint→S и удаляет fingerprint, когда ВСЁ
 * перешло. Вызывается отложенно (после restore), т.к. crypto-js PBKDF2 блокирует
 * поток. Безопасно вызывать многократно; no-op если уже migrated или нет fingerprint.
 */
export function finalizeMigration(): void {
  if (!secretB64) return
  const env = readEnvelope()
  if (env?.mode !== 'device' || env.migrated) return
  const fp = readStoredFingerprint()
  if (!fp) {
    writeEnvelope({ ...env, migrated: true })
    return
  }
  const { allOk } = migrateLegacyToVault(secretB64, fp)
  if (allOk) {
    lsRemove(DEVICE_FINGERPRINT_KEY)
    writeEnvelope({ ...env, migrated: true })
  }
}

// ─── passphrase unlock + toggle ───────────────────────────────────────────────

export interface SubmitResult {
  ok: boolean
  reason?: 'bad-passphrase' | 'no-vault'
}

export async function submitPassphrase(pw: string): Promise<SubmitResult> {
  const env = readEnvelope()
  if (env?.mode !== 'passphrase') return { ok: false, reason: 'no-vault' }
  try {
    const key = await derivePassphraseKey(pw, b64ToBytes(env.salt), env.iter, env.hash)
    const s = await unwrapSecret(key, env) // throws на неверном пароле (AES-GCM auth)
    setUnlocked(s, 'passphrase')
    readyPromise = Promise.resolve(outcome())
    clearAttempts()
    return { ok: true }
  } catch {
    recordFailedAttempt()
    return { ok: false, reason: 'bad-passphrase' }
  }
}

/**
 * Включает passphrase (требует разлоченного сейфа). Crash-atomic: commit → verify →
 * удалить device-ключ. Под withLock — сериализация с бутом других таб (cross-tab race).
 */
export async function enablePassphrase(pw: string): Promise<void> {
  if (!secret) throw new VaultLockedError()
  const s = secret
  await withLock(async () => {
    // ДО перехода в passphrase добиваем legacy-миграцию и сносим fingerprint —
    // иначе fingerprint-копия сида осталась бы навсегда (finalizeMigration
    // работает только в device-режиме) и «апгрейд» дал бы ложную защиту.
    finalizeMigration()
    writeMigrationMarker('enable')
    try {
      const salt = randomBytes(SALT_BYTES)
      const key = await derivePassphraseKey(pw, salt, DEFAULT_PBKDF2_ITERATIONS, 'SHA-256')
      const wrap = await wrapSecret(key, s)
      const env: PassphraseEnvelope = {
        v: 1,
        mode: 'passphrase',
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iter: DEFAULT_PBKDF2_ITERATIONS,
        salt: bytesToB64(salt),
        iv: wrap.iv,
        ct: wrap.ct,
      }
      writeEnvelope(env) // commit
      const vkey = await derivePassphraseKey(pw, salt, env.iter, env.hash)
      const s2 = await unwrapSecret(vkey, env)
      if (bytesToB64(s2) !== bytesToB64(s)) throw new Error('enablePassphrase verify failed')
      await deps.keyStore.deleteKey().catch(() => {}) // только после verify
      level = 'passphrase'
    } finally {
      clearMigrationMarker()
    }
  })
}

/**
 * Выключает passphrase (требует текущего пароля). Возврат к device-режиму.
 * Под withLock — сериализация с бутом других таб, чтобы orphan-cleanup на буте не
 * затёр только что созданный device-ключ (cross-tab race).
 */
export async function disablePassphrase(pw: string): Promise<void> {
  if (!secret) throw new VaultLockedError()
  const s = secret
  await withLock(async () => {
    const env = readEnvelope()
    if (env?.mode !== 'passphrase') return
    const cur = await derivePassphraseKey(pw, b64ToBytes(env.salt), env.iter, env.hash)
    await unwrapSecret(cur, env) // throws при неверном пароле
    writeMigrationMarker('disable')
    try {
      const key = await generateDeviceKey()
      await deps.keyStore.setKey(key) // durable до commit
      const wrap = await wrapSecret(key, s)
      const devEnv: DeviceEnvelope = {
        v: 1,
        mode: 'device',
        iv: wrap.iv,
        ct: wrap.ct,
        migrated: true,
      }
      writeEnvelope(devEnv) // commit
      const k2 = await deps.keyStore.getKey()
      if (!k2) throw new Error('key vanished')
      const s2 = await unwrapSecret(k2, devEnv)
      if (bytesToB64(s2) !== bytesToB64(s)) throw new Error('disablePassphrase verify failed')
      level = 'device'
    } finally {
      clearMigrationMarker()
    }
  })
}

// ─── lock / destroy ───────────────────────────────────────────────────────────

export function lockVault(): void {
  if (secret) secret.fill(0)
  secret = null
  secretB64 = null
  level = 'none'
  status = 'unknown'
  degraded = false
  readyPromise = null
}

/** Полное уничтожение сейфа (signOut / reset). Wipe конверта, IDB-ключа, fingerprint, attempts. */
export async function destroyVault(): Promise<void> {
  clearEnvelope()
  lsRemove(VAULT_ATTEMPTS_KEY)
  lsRemove(DEVICE_FINGERPRINT_KEY)
  try {
    await deps.keyStore.deleteKey()
  } catch {
    /* ignore */
  }
  lockVault()
}

// ─── passphrase attempt throttling ────────────────────────────────────────────

export interface AttemptState {
  attempts: number
  cooldownUntil: number
}

export function getAttemptState(): AttemptState {
  const raw = ls()?.getItem(VAULT_ATTEMPTS_KEY)
  if (!raw) return { attempts: 0, cooldownUntil: 0 }
  try {
    const o = JSON.parse(raw) as Partial<AttemptState>
    return {
      attempts: typeof o.attempts === 'number' ? o.attempts : 0,
      cooldownUntil: typeof o.cooldownUntil === 'number' ? o.cooldownUntil : 0,
    }
  } catch {
    return { attempts: 0, cooldownUntil: 0 }
  }
}

function backoffMs(attempts: number): number {
  if (attempts <= 3) return 0
  if (attempts === 4) return 5_000
  if (attempts === 5) return 15_000
  if (attempts === 6) return 30_000
  return 60_000
}

function recordFailedAttempt(): AttemptState {
  const cur = getAttemptState()
  const attempts = cur.attempts + 1
  // now берём из Date через переданный источник времени нельзя (framework-free) —
  // используем Date.now(): это app-runtime, не workflow-скрипт.
  const next: AttemptState = { attempts, cooldownUntil: Date.now() + backoffMs(attempts) }
  try {
    ls()?.setItem(VAULT_ATTEMPTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

function clearAttempts(): void {
  lsRemove(VAULT_ATTEMPTS_KEY)
}

function writeMigrationMarker(phase: 'enable' | 'disable'): void {
  try {
    ls()?.setItem(VAULT_MIGRATION_KEY, JSON.stringify({ phase }))
  } catch {
    /* ignore */
  }
}
function readMigrationMarker(): 'enable' | 'disable' | null {
  try {
    const raw = ls()?.getItem(VAULT_MIGRATION_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { phase?: unknown }
    return o.phase === 'enable' || o.phase === 'disable' ? o.phase : null
  } catch {
    return null
  }
}
function clearMigrationMarker(): void {
  lsRemove(VAULT_MIGRATION_KEY)
}

/** Тест-хелпер: полный сброс in-memory состояния между кейсами. */
export function __resetVaultForTests(): void {
  secret = null
  secretB64 = null
  level = 'none'
  status = 'unknown'
  degraded = false
  readyPromise = null
  deps = { keyStore: indexedDbVaultKeyStore }
}
