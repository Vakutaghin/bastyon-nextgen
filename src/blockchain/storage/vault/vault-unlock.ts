// UI-осведомлённый бут-оркестратор сейфа (P0-1).
//
// Обёртка над ensureVaultReady: для passwordless — молча авто-разлочивает; для
// passphrase — открывает модалку разблокировки через инъектируемый UI-мост
// (DI, чтобы crypto-vault оставался framework-free). Резолвер модалки живёт в
// module-scope (НЕ в pinia-state) [H2]. Никогда не реджектит — из любого исхода
// есть путь (unlock / reset через 12 слов / non-destructive retry).

import {
  ensureVaultReady,
  submitPassphrase,
  getAttemptState,
  destroyVault,
  type VaultOutcome,
} from './crypto-vault'

/** Мост к UI-хосту (модалка). Реализация подключается в main.ts поверх modal-store. */
export interface UnlockUiBridge {
  open(): void
  close(): void
  /** Есть ли где показать модалку (false в embed/headless — тогда не вешаемся) [A4/H2]. */
  hostAvailable(): boolean
}

let bridge: UnlockUiBridge | null = null
export function configureUnlockUi(b: UnlockUiBridge | null): void {
  bridge = b
}

let unlockPromise: Promise<VaultOutcome> | null = null
let pendingResolve: ((choice: 'unlocked' | 'reset') => void) | null = null

/** Единая точка разлока на буте. Мемоизирована; дедуп с обоими restoreSession-сайтами [A5]. */
export function ensureVaultUnlocked(): Promise<VaultOutcome> {
  if (unlockPromise) return unlockPromise
  unlockPromise = drive()
  return unlockPromise
}

async function drive(): Promise<VaultOutcome> {
  let out = await ensureVaultReady()

  if (
    out.status === 'unlocked' ||
    out.status === 'degraded-fingerprint' ||
    out.status === 'empty'
  ) {
    return out
  }
  // Транзиентные/восстановительные исходы не мемоизируем — дать шанс ретраю/re-import.
  if (out.status === 'storage-unavailable' || out.status === 'needs-reset') {
    unlockPromise = null
    return out
  }

  // status === 'needs-passphrase'
  if (!bridge || !bridge.hostAvailable()) {
    unlockPromise = null
    return out // некому показать модалку → трактуется как «не аутентифицирован»
  }

  const choice = await new Promise<'unlocked' | 'reset'>((resolve) => {
    pendingResolve = resolve
    bridge!.open()
  })
  bridge.close()
  pendingResolve = null

  if (choice === 'reset') {
    await destroyVault()
    unlockPromise = null
    return { status: 'needs-reset', level: 'none' }
  }

  out = await ensureVaultReady() // submitPassphrase уже разлочил → 'unlocked'
  return out
}

export interface UnlockAttemptResult {
  ok: boolean
  attempts: number
  cooldownUntil: number
}

/** Вызывается модалкой на каждую попытку пароля. Успех — резолвит ожидающий unlock. */
export async function submitUnlockPassphrase(pw: string): Promise<UnlockAttemptResult> {
  const res = await submitPassphrase(pw)
  const st = getAttemptState()
  if (res.ok && pendingResolve) pendingResolve('unlocked')
  return { ok: res.ok, attempts: st.attempts, cooldownUntil: st.cooldownUntil }
}

/** «Забыл пароль → восстановить по 12 словам». Резолвит ожидающий unlock как reset. */
export function requestUnlockReset(): void {
  pendingResolve?.('reset')
}

export function getUnlockAttemptState(): { attempts: number; cooldownUntil: number } {
  return getAttemptState()
}

/** Тест-хелпер: сброс оркестратора между кейсами. */
export function __resetUnlockForTests(): void {
  bridge = null
  unlockPromise = null
  pendingResolve = null
}
