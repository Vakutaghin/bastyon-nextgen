// Кто качает на этой платформе. null — скачивать негде.

import { Capacitor } from '@capacitor/core'
import type { OfflineBackend } from './types'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isAndroidNative(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('OfflineVideo')
}

/**
 * Веб: воркер пишет в OPFS. `createSyncAccessHandle` есть только в воркерах —
 * отсюда его не видно, поэтому смотрим на OPFS и воркеры (Safari 15.2+,
 * Chromium 102+, Firefox 111+ умеют и то и другое).
 */
function webSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof Worker !== 'undefined'
  )
}

/**
 * Приватное окно Safari и эфемерные профили: OPFS объявлена, но каталог не
 * открывается (UnknownError) — скачивать там некуда, говорим об этом сразу.
 */
async function opfsOpens(): Promise<boolean> {
  try {
    await navigator.storage.getDirectory()
    return true
  } catch {
    return false
  }
}

let chosen: Promise<OfflineBackend | null> | null = null

export function offlineBackend(): Promise<OfflineBackend | null> {
  chosen ??= (async () => {
    if (isTauri()) return (await import('./tauri-backend')).tauriBackend
    if (isAndroidNative()) return (await import('./android-backend')).androidBackend
    if (Capacitor.isNativePlatform()) return null
    if (webSupported() && (await opfsOpens())) return (await import('./web-backend')).webBackend
    return null
  })().catch(() => null)
  return chosen
}

/** Для тестов. */
export function resetOfflineBackend(next: OfflineBackend | null = null): void {
  chosen = next ? Promise.resolve(next) : null
}
