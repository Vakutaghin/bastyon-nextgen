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
  DEVICE_FINGERPRINT_KEY,
  VAULT_MIGRATION_KEY,
  VAULT_ATTEMPTS_KEY,
} from '../../constants/storage'
import { getDeviceFingerprint, readStoredFingerprint } from '../device-fingerprint'
import { migrateLegacyToVault } from './vault-migration'
import {
  isSubtleAvailable,
  generateSecret,
  derivePassphraseKey,
  wrapSecret,
  unwrapSecret,
  bytesToB64,
  b64ToBytes,
  randomBytes,
  DEFAULT_PBKDF2_ITERATIONS,
  SALT_BYTES,
} from './vault-crypto'
import { createPlatformVaultKeyStore, type VaultKeyStore } from './vault-key-store'
import { ls, lsRemove } from './vault-ls'
import {
  readEnvelope,
  writeEnvelope,
  clearEnvelope,
  hasAnyEncryptedPayload,
  type DeviceEnvelope,
  type PassphraseEnvelope,
} from './vault-envelope-store'
import { recordFailedAttempt, clearAttempts } from './vault-attempts'

// Публичный API сохранён: getAttemptState/AttemptState раньше жили здесь и
// импортируются vault-unlock — реэкспортируем из vault-attempts.
export { getAttemptState } from './vault-attempts'
export type { AttemptState } from './vault-attempts'

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

/** Passphrase нельзя включить, пока часть секретов ещё лежит под fingerprint (N5/VP-11). */
export class VaultMigrationIncompleteError extends Error {
  constructor() {
    super('legacy fingerprint payloads still present')
    this.name = 'VaultMigrationIncompleteError'
  }
}

/**
 * Просим браузер не вытеснять storage (IndexedDB с device-ключом). Best-effort:
 * Safari/WKWebView игнорируют, Chromium даёт persistent при установленном PWA
 * или высокой вовлечённости. Раньше вызывалось только из Settings → Security,
 * куда большинство не заходит (VP-3/V12) — теперь при каждом создании device-ключа.
 */
function requestPersistentStorage(): void {
  try {
    const nav = globalThis.navigator as
      | { storage?: { persist?: () => Promise<boolean> } }
      | undefined
    void nav?.storage?.persist?.()?.catch(() => {})
  } catch {
    /* не поддерживается — не критично */
  }
}

interface Deps {
  keyStore: VaultKeyStore
}
let deps: Deps = { keyStore: createPlatformVaultKeyStore() }

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
      // Ключ вытеснен (iOS ITP / очистка site data). Если payload'ы ещё не
      // перешли под S (миграция отложена/упала) и fingerprint на месте — они
      // читаются под ним: заводим device-сейф заново вместо стирания (VP-4).
      const fp = readStoredFingerprint()
      if (!env.migrated && fp) {
        clearEnvelope()
        return bootstrapFromLegacy(fp)
      }
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
    key = await deps.keyStore.createKey()
  } catch {
    // Не смогли создать/сохранить ключ → остаёмся на fingerprint (payload'ы целы), ретрай позже [D2].
    degraded = true
    status = 'degraded-fingerprint'
    level = 'none'
    return outcome()
  }

  requestPersistentStorage()

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
    // Вход по 12 словам поверх мёртвого сейфа (ключ вытеснен, конверт повреждён):
    // старые payload'ы всё равно нечитаемы — сносим сейф и минтим свежий, иначе
    // getVaultSecret() бросал бы и свежий сид не сохранился бы (V8-подобная ловушка).
    if (out.status === 'needs-reset') {
      await destroyVault()
      return mintDeviceVault()
    }
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
  try {
    const key = await deps.keyStore.createKey()
    requestPersistentStorage()
    const wrap = await wrapSecret(key, s)
    const env: DeviceEnvelope = { v: 1, mode: 'device', iv: wrap.iv, ct: wrap.ct, migrated: true }
    writeEnvelope(env)
    // round-trip verify, как в bootstrapFromLegacy: ключ реально долежал до IDB и
    // конверт разворачивается — иначе первый же перезапуск дал бы needs-reset (V12).
    const k2 = await deps.keyStore.getKey()
    if (!k2) throw new Error('key vanished')
    const s2 = await unwrapSecret(k2, env)
    if (bytesToB64(s2) !== bytesToB64(s)) throw new Error('verify mismatch')
  } catch {
    // Нет subtle/IDB → фоллбек на fingerprint (level 0). Свежий секрет НЕ теряем: getVaultSecret→fingerprint.
    clearEnvelope()
    await deps.keyStore.deleteKey().catch(() => {})
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
  let s: Uint8Array
  try {
    const key = await derivePassphraseKey(pw, b64ToBytes(env.salt), env.iter, env.hash)
    s = await unwrapSecret(key, env) // throws на неверном пароле (AES-GCM auth)
  } catch {
    recordFailedAttempt()
    return { ok: false, reason: 'bad-passphrase' }
  }
  setUnlocked(s, 'passphrase')
  readyPromise = Promise.resolve(outcome())
  clearAttempts()
  // Self-tuning KDF (VP-6): конверт, созданный при меньшем счётчике итераций,
  // прозрачно перезаворачиваем на текущий target (свежие соль и IV). Best-effort:
  // сбой оставляет старый конверт, который только что успешно развернулся.
  if (env.iter < DEFAULT_PBKDF2_ITERATIONS) {
    try {
      writeEnvelope(await buildPassphraseEnvelope(pw, s))
    } catch {
      /* старый конверт валиден */
    }
  }
  return { ok: true }
}

/** Свежие соль/IV, текущие параметры KDF; общий для enablePassphrase и self-tuning. */
async function buildPassphraseEnvelope(pw: string, s: Uint8Array): Promise<PassphraseEnvelope> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derivePassphraseKey(pw, salt, DEFAULT_PBKDF2_ITERATIONS, 'SHA-256')
  const wrap = await wrapSecret(key, s)
  return {
    v: 1,
    mode: 'passphrase',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iter: DEFAULT_PBKDF2_ITERATIONS,
    salt: bytesToB64(salt),
    iv: wrap.iv,
    ct: wrap.ct,
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
    // Если что-то так и не перешло под S (allOk=false → fingerprint остался),
    // passphrase-режим дал бы ложную защиту: fingerprint-копия сида лежала бы
    // рядом. Отказываем с понятной ошибкой вместо тихого «включено» (N5/VP-11).
    if (readStoredFingerprint()) throw new VaultMigrationIncompleteError()
    writeMigrationMarker('enable')
    try {
      const env = await buildPassphraseEnvelope(pw, s)
      writeEnvelope(env) // commit
      const vkey = await derivePassphraseKey(pw, b64ToBytes(env.salt), env.iter, env.hash)
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
      const key = await deps.keyStore.createKey() // durable до commit
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
  deps = { keyStore: createPlatformVaultKeyStore() }
}
