/**
 * Нативный счётчик непрочитанных на значке Android (AppBadgePlugin.java):
 * тихое уведомление с числом, пока приложение свёрнуто, у Huawei и Honor —
 * число напрямую. В вебе и на компьютере не используется.
 */
import { registerPlugin, type PermissionState } from '@capacitor/core'

export interface AppBadgeSetOptions {
  count: number
  /** Заголовок уведомления — название приложения. */
  title: string
  /** «3 непрочитанных сообщения». */
  text: string
  /** Имя канала уведомлений в настройках системы. */
  channel: string
}

export interface AppBadgePlugin {
  set(options: AppBadgeSetOptions): Promise<void>
  checkPermissions(): Promise<{ notifications: PermissionState }>
  requestPermissions(): Promise<{ notifications: PermissionState }>
}

export const AppBadge = registerPlugin<AppBadgePlugin>('AppBadge', {
  web: () => ({
    set: async () => {},
    checkPermissions: async () => ({ notifications: 'denied' as PermissionState }),
    requestPermissions: async () => ({ notifications: 'denied' as PermissionState }),
  }),
})
