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
import { clearAllUserData } from '../storage-manager'

/** Что показывает модалка: ввод passphrase или «локальный ключ утерян → 12 слов». */
export type UnlockPhase = 'passphrase' | 'reset'

/** Мост к UI-хосту (модалка). Реализация подключается в main.ts поверх modal-store. */
export interface UnlockUiBridge {
  open(phase: UnlockPhase): void
  close(): void
  /** Есть ли где показать модалку (false в embed/headless — тогда не вешаемся) [A4/H2]. */
  hostAvailable(): boolean
  /** После подтверждённого сброса — открыть импорт по 12 словам. */
  openImport(): void
}

let bridge: UnlockUiBridge | null = null
export function configureUnlockUi(b: UnlockUiBridge | null): void {
  bridge = b
}

type Choice = 'unlocked' | 'reset' | 'later'

let unlockPromise: Promise<VaultOutcome> | null = null
let pendingResolve: ((choice: Choice) => void) | null = null

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
  // Транзиентный исход не мемоизируем — дать шанс ретраю.
  if (out.status === 'storage-unavailable') {
    unlockPromise = null
    return out
  }

  // 'needs-passphrase' | 'needs-reset' — нужна модалка.
  if (!bridge || !bridge.hostAvailable()) {
    unlockPromise = null
    return out // некому показать модалку → трактуется как «не аутентифицирован»
  }

  // needs-reset (вытеснен device-ключ / повреждён конверт): раньше restore-session
  // молча стирал все локальные данные. Теперь — объяснение и явное подтверждение,
  // как и предусматривал план сейфа (VP-4/V12); «Позже» ничего не трогает.
  const phase: UnlockPhase = out.status === 'needs-reset' ? 'reset' : 'passphrase'
  const choice = await new Promise<Choice>((resolve) => {
    pendingResolve = resolve
    bridge!.open(phase)
  })
  bridge.close()
  pendingResolve = null

  if (choice === 'reset') {
    await destroyVault()
    clearAllUserData()
    unlockPromise = null
    bridge.openImport()
    return { status: 'needs-reset', level: 'none' }
  }
  if (choice === 'later') {
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

/**
 * «Забыл пароль» / «Восстановить по 12 словам» — после подтверждения в модалке.
 * Резолвит ожидающий unlock как reset: сейф и локальные данные стираются,
 * открывается импорт.
 */
export function requestUnlockReset(): void {
  pendingResolve?.('reset')
}

/** «Позже» в фазе reset: закрыть модалку, ничего не стирать (вернётся на следующем запуске). */
export function dismissUnlockReset(): void {
  pendingResolve?.('later')
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
