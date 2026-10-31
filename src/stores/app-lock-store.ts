/**
 * Замок приложения — пин-код или графический ключ на вход (helpers/app-lock).
 *
 * Закрыто при запуске, после перерыва (автоблокировка) и по «Заблокировать»
 * (меню аккаунта, Ctrl+L / Cmd+L). Сейф под пароль-фразой при запуске
 * спрашивает её — это и есть вход, код второй раз не нужен; после перерыва
 * спрашивается код.
 *
 * Код забыт — 12 слов или приватный ключ любого аккаунта на устройстве
 * снимают замок, ничего не стирая; без записи — выход из всех аккаунтов.
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { Capacitor } from '@capacitor/core'

import { APP_LOCK_KEY } from '@/blockchain/constants/storage'
import {
  ensureVaultReady,
  getVaultLevel,
  getVaultSecret,
  getVaultStatus,
} from '@/blockchain/storage/vault/crypto-vault'
import { readEnvelope } from '@/blockchain/storage/vault/vault-envelope-store'
import { loadAccountsList } from '@/blockchain/storage/storage-accounts'
import { recoverKeyPair, loadBip39Russian } from '@/blockchain/core/keys'
import { generateAddressFromKeyPair } from '@/blockchain/core/addresses'
import {
  AUTO_LOCK_MS,
  clearLockAttempts,
  clearLockConfig,
  createLockConfig,
  readLockAttempts,
  readLockConfig,
  recordLockFailure,
  verifyLockCode,
  writeLockConfig,
  type AppLockConfig,
  type AutoLockAfter,
  type LockKind,
} from '@/helpers/app-lock/app-lock-config'
import { capacitorAppState, startAutoLock, type AutoLock } from '@/helpers/app-lock/auto-lock'
import { setHideInRecents } from '@/helpers/app-lock/recents-privacy'

export interface CodeCheck {
  ok: boolean
  /** До этого времени ввод закрыт после ошибок; 0 — открыт. */
  until: number
  /** Сейф не открылся — коду не с чем сверяться. */
  unavailable?: boolean
}

export type RecoverResult = 'ok' | 'invalid' | 'unknown'

/** Телефон сворачивают на минуту и возвращаются; за компьютером читают подолгу. */
export function defaultAutoLock(): AutoLockAfter {
  return Capacitor.isNativePlatform() ? 'min1' : 'min15'
}

function lockedAtLaunch(config: AppLockConfig | null): boolean {
  return config !== null && readEnvelope()?.mode !== 'passphrase'
}

async function vaultSecret(): Promise<string | null> {
  const out = await ensureVaultReady()
  if (out.status !== 'unlocked') return null
  try {
    return getVaultSecret()
  } catch {
    return null
  }
}

async function addressOfSecret(secret: string): Promise<string | null> {
  try {
    await loadBip39Russian()
    const { keyPair } = recoverKeyPair(secret)
    return generateAddressFromKeyPair(keyPair).addressInfo.address
  } catch {
    return null
  }
}

export const useAppLockStore = defineStore('appLock', () => {
  const config = shallowRef<AppLockConfig | null>(readLockConfig())
  const locked = ref(lockedAtLaunch(config.value))
  const confirmOpen = ref(false)
  let confirmResolve: ((ok: boolean) => void) | null = null
  let autoLock: AutoLock | null = null

  const enabled = computed(() => config.value !== null)
  const kind = computed<LockKind | null>(() => config.value?.kind ?? null)
  const digits = computed(() => config.value?.digits ?? 4)
  const autoLockAfter = computed<AutoLockAfter>(() => config.value?.autoLock ?? defaultAutoLock())

  /**
   * Перечитать с диска: выход из последнего аккаунта стирает замок вместе с
   * сейфом (clearAllUserData), а другая вкладка могла его снять или задать.
   */
  function refresh(): void {
    config.value = readLockConfig()
    if (!config.value) locked.value = false
  }

  /** Задать код можно, когда сейф открыт настоящим ключом, а не отпечатком устройства. */
  function available(): boolean {
    return getVaultStatus() === 'unlocked' && getVaultLevel() !== 'none'
  }

  function lock(): void {
    refresh()
    if (!config.value) return
    // Окно подтверждения под замком не оставляем: оба ловили бы цифры с клавиатуры.
    if (confirmOpen.value) finishConfirm(false)
    locked.value = true
  }

  async function checkCode(code: string): Promise<CodeCheck> {
    const cfg = config.value
    if (!cfg) return { ok: true, until: 0 }
    const paused = readLockAttempts().until
    if (paused > Date.now()) return { ok: false, until: paused }
    const secret = await vaultSecret()
    if (!secret) return { ok: false, until: 0, unavailable: true }
    const ok = await verifyLockCode(cfg, secret, code).catch(() => false)
    if (ok) {
      clearLockAttempts()
      return { ok: true, until: 0 }
    }
    return { ok: false, until: recordLockFailure().until }
  }

  async function unlock(code: string): Promise<CodeCheck> {
    const res = await checkCode(code)
    if (res.ok) {
      locked.value = false
      autoLock?.touch()
    }
    return res
  }

  /** Новый код (или смена вида). Сейф должен быть открыт. */
  async function enable(nextKind: LockKind, code: string): Promise<boolean> {
    const secret = await vaultSecret()
    if (!secret) return false
    const next = await createLockConfig(secret, nextKind, code, autoLockAfter.value)
    writeLockConfig(next)
    clearLockAttempts()
    config.value = next
    setHideInRecents(true)
    return true
  }

  function disable(): void {
    clearLockConfig()
    config.value = null
    locked.value = false
    setHideInRecents(false)
  }

  function setAutoLock(after: AutoLockAfter): void {
    if (!config.value) return
    const next = { ...config.value, autoLock: after }
    writeLockConfig(next)
    config.value = next
    autoLock?.touch()
  }

  /**
   * Подтвердить код перед опасным: показать фразу, сменить или снять код.
   * Замка нет — сразу да.
   */
  function confirm(): Promise<boolean> {
    refresh()
    if (!config.value) return Promise.resolve(true)
    confirmResolve?.(false)
    confirmOpen.value = true
    return new Promise((resolve) => {
      confirmResolve = resolve
    })
  }

  function finishConfirm(ok: boolean): void {
    confirmOpen.value = false
    const resolve = confirmResolve
    confirmResolve = null
    resolve?.(ok)
  }

  /** «Забыли код?»: фраза или ключ аккаунта с этого устройства снимают замок. */
  async function recover(secret: string): Promise<RecoverResult> {
    const text = secret.trim()
    if (!text) return 'invalid'
    const address = await addressOfSecret(text)
    if (!address) return 'invalid'
    const list = loadAccountsList()
    const known = list.success && list.data?.accounts.some((a) => a.address === address)
    if (!known) return 'unknown'
    disable()
    return 'ok'
  }

  /**
   * Запустить замок на экране приложения (app-lock-screen): автоблокировка,
   * Ctrl+L, снимок в недавних. Вернёт функцию остановки.
   */
  function start(): () => void {
    // Сейф не открылся вовсе (нет данных, ключ утерян) — защищать нечего, а
    // окно сброса сейфа не должно уйти под замок.
    if (locked.value) {
      void ensureVaultReady().then((out) => {
        if (out.status === 'empty' || out.status === 'needs-reset') locked.value = false
      })
    }
    setHideInRecents(enabled.value)
    autoLock = startAutoLock({
      timeoutMs: () => (config.value ? AUTO_LOCK_MS[config.value.autoLock] : null),
      isLocked: () => locked.value,
      lock,
      subscribeAppState: Capacitor.isNativePlatform() ? capacitorAppState : undefined,
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyL' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (!enabled.value || locked.value) return
      e.preventDefault()
      lock()
    }
    const onStorage = (e: StorageEvent): void => {
      if (e.key === APP_LOCK_KEY || e.key === null) refresh()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('storage', onStorage)
    return () => {
      autoLock?.stop()
      autoLock = null
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('storage', onStorage)
    }
  }

  return {
    config,
    locked,
    confirmOpen,
    enabled,
    kind,
    digits,
    autoLockAfter,
    refresh,
    available,
    lock,
    checkCode,
    unlock,
    enable,
    disable,
    setAutoLock,
    confirm,
    finishConfirm,
    recover,
    start,
  }
})
