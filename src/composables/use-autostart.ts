/**
 * Автозапуск приложения при входе в систему (в старом клиенте — «Запускать
 * Bastyon автоматически»).
 *
 * Состоянием владеет операционная система: LaunchAgent на macOS, ключ реестра
 * на Windows, .desktop на Linux. Поэтому настройку сначала применяем к системе
 * и только потом запоминаем у себя — иначе тумблер показывал бы то, чего нет.
 */

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { logger } from '@/services/logger'

const log = logger.scope('[autostart]')

/** Включён ли автозапуск по мнению системы. В браузере — всегда `false`. */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart')
    return await isEnabled()
  } catch (e) {
    log.debug('isEnabled failed', e)
    return false
  }
}

/**
 * Включить или выключить автозапуск. Возвращает `false`, если система отказала,
 * — вызывающий покажет ошибку и не станет менять тумблер.
 */
export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart')
    if (enabled) await enable()
    else await disable()
    return true
  } catch (e) {
    log.warn('autostart change failed', e)
    return false
  }
}
