/**
 * Обновление изнутри приложения на Android: плагин AppUpdater
 * (android/app/src/main/java/com/bastyon/app/plugins/AppUpdaterPlugin.java).
 *
 * APK релиза качается в кэш приложения и сверяется: размер и SHA-256 — с тем,
 * что GitHub отдал у файла релиза (helpers/updates/github-release), а сам
 * пакет — наш, новее установленного и подписан тем же ключом. Потом его
 * ставит системный установщик: подтверждает человек, тихо обновить себя
 * приложение не может. Если установщик поставил новую версию, этот процесс
 * завершается и ответа нет; если вернулся — обновление не поставили.
 *
 * Tor на телефоне нет (только в сборке для компьютера), поэтому APK, как и
 * остальное, качается напрямую.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { ReleaseApk } from './github-release'
import type { InstallProgress } from './install-update'

interface AppUpdaterPlugin {
  download(o: { url: string; sha256: string; size: number }): Promise<{ path: string }>
  install(o: { path: string }): Promise<{ status: 'not_installed' }>
  addListener(
    event: 'progress',
    cb: (ev: { received: number; total: number }) => void
  ): Promise<PluginListenerHandle>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

/**
 * `dismissed` — установщик закрыли, не обновив (отмена или его ошибка);
 * `permission` — человек не разрешил приложению ставить обновления.
 * В обоих случаях можно нажать «Обновить» ещё раз.
 */
export type AndroidInstallResult = 'dismissed' | 'permission'

export function isAndroidUpdaterAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('AppUpdater')
}

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

/**
 * Скачивает, проверяет и отдаёт APK установщику. Бросает, если поставить
 * само не выйдет (сеть, хеш, чужая подпись, нет места) — тогда остаётся
 * страница релиза.
 */
export async function installAndroidUpdate(
  apk: ReleaseApk,
  onProgress: (progress: InstallProgress) => void
): Promise<AndroidInstallResult> {
  onProgress({ phase: 'download', fraction: 0 })
  const sub = await AppUpdater.addListener('progress', ({ received, total }) => {
    onProgress({ phase: 'download', fraction: total > 0 ? Math.min(1, received / total) : null })
  })
  let path: string
  try {
    ;({ path } = await AppUpdater.download({ url: apk.url, sha256: apk.sha256, size: apk.size }))
  } finally {
    await sub.remove()
  }

  onProgress({ phase: 'install', fraction: 1 })
  try {
    await AppUpdater.install({ path })
    return 'dismissed'
  } catch (e) {
    if (errorCode(e) === 'permission') return 'permission'
    throw e
  }
}
