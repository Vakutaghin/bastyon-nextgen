/**
 * Число непрочитанных сообщений на значке приложения — каждой системе своим
 * способом:
 *
 * - компьютер (Tauri): команда `app_badge_set` (src-tauri/src/app_badge.rs) —
 *   Dock на macOS, кружок на панели задач и в трее на Windows, док и трей на Linux;
 * - Android: плагин AppBadge — тихое уведомление с числом, пока приложение
 *   свёрнуто (по нему лаунчеры рисуют число или точку), у Huawei и Honor — число напрямую;
 * - установленное веб-приложение (PWA в Chrome, Edge): Badging API.
 *
 * iOS не трогаем: число на значке там требует разрешения на уведомления, а
 * сообщений-уведомлений в приложении пока нет.
 */
import { Capacitor } from '@capacitor/core'

import { AppBadge } from '@/plugins/app-badge'
import { logger } from '@/services/logger'

const log = logger.scope('[app-badge]')

/** Android спрашивал разрешение на уведомления ради счётчика — второй раз не просим. */
const PERMISSION_ASKED_KEY = 'appBadge.permissionAsked'

export interface AppBadgeTexts {
  /** Подсказка значка в трее: «Bastyon NextGen — 3 непрочитанных сообщения». */
  tooltip: string
  /** Заголовок уведомления на Android — название приложения. */
  title: string
  /** Текст уведомления на Android: «3 непрочитанных сообщения». */
  text: string
  /** Канал уведомлений Android: «Непрочитанные сообщения». */
  channel: string
}

export type AppBadgeTarget = 'tauri' | 'android' | 'web' | 'none'

export function appBadgeTarget(): AppBadgeTarget {
  if (import.meta.env.VITE_TAURI === 'true') return 'tauri'
  const platform = Capacitor.getPlatform()
  if (platform === 'android') return Capacitor.isPluginAvailable('AppBadge') ? 'android' : 'none'
  if (platform !== 'web') return 'none'
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator ? 'web' : 'none'
}

/** Показать число (0 — убрать). Ошибки системы не роняют приложение: счётчик вспомогательный. */
export async function showAppBadge(count: number, texts: AppBadgeTexts): Promise<void> {
  const n = Math.max(0, Math.floor(count))
  try {
    switch (appBadgeTarget()) {
      case 'tauri': {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('app_badge_set', { count: n, tooltip: texts.tooltip })
        break
      }
      case 'android':
        await AppBadge.set({
          count: n,
          title: texts.title,
          text: texts.text,
          channel: texts.channel,
        })
        break
      case 'web':
        if (n > 0) await navigator.setAppBadge(n)
        else await navigator.clearAppBadge()
        break
      case 'none':
        break
    }
  } catch (err) {
    log.debug('badge not set', err)
  }
}

/**
 * Android 13+: без разрешения на уведомления лаунчер числа не покажет.
 * Спрашиваем один раз — когда впервые появились непрочитанные или человек
 * включил счётчик в настройках (`force`); отказ не переспрашиваем.
 */
export async function ensureAppBadgePermission(force = false): Promise<void> {
  if (appBadgeTarget() !== 'android') return
  try {
    const { notifications } = await AppBadge.checkPermissions()
    if (notifications === 'granted' || notifications === 'denied') return
    if (!force && localStorage.getItem(PERMISSION_ASKED_KEY)) return
    localStorage.setItem(PERMISSION_ASKED_KEY, '1')
    await AppBadge.requestPermissions()
  } catch (err) {
    log.debug('permission not requested', err)
  }
}
