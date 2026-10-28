/**
 * Поведение окна приложения для компьютера (Настройки → «Система»): что
 * делает крестик на Windows и Linux и есть ли значок в строке меню macOS.
 * Настройки хранит и применяет Rust (`src-tauri/src/desktop_prefs.rs`):
 * крестик нажимают и до загрузки страницы. В браузере их нет — null.
 */

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { logger } from '@/services/logger'

const log = logger.scope('[desktop-prefs]')

export interface DesktopPrefs {
  /** Крестик прячет окно в трей; false — закрывает приложение (Windows, Linux). */
  closeToTray: boolean
  /** Значок в строке меню (macOS). */
  menuBarIcon: boolean
}

export interface DesktopPrefsView extends DesktopPrefs {
  platform: 'macos' | 'windows' | 'linux'
  /** Трей есть: на Linux без appindicator его нет, крестик закрывает приложение. */
  trayAvailable: boolean
}

export async function getDesktopPrefs(): Promise<DesktopPrefsView | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<DesktopPrefsView>('desktop_prefs_get')
  } catch (e) {
    log.warn('get failed', e)
    return null
  }
}

/** Сохранить; вернёт то, что теперь действует, или null, если не вышло. */
export async function setDesktopPrefs(prefs: DesktopPrefs): Promise<DesktopPrefsView | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<DesktopPrefsView>('desktop_prefs_set', { prefs })
  } catch (e) {
    log.warn('set failed', e)
    return null
  }
}
