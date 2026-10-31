// Снимок приложения в списке недавних на Android: с замком его нет, иначе
// переписку видно поверх закрытого приложения. Плагин AppLock
// (android/.../plugins/AppLockPlugin.java); на других платформах — ничего.

import { Capacitor, registerPlugin } from '@capacitor/core'

interface AppLockPlugin {
  setHideInRecents(opts: { hide: boolean }): Promise<void>
}

let plugin: AppLockPlugin | null = null

export function setHideInRecents(hide: boolean): void {
  if (Capacitor.getPlatform() !== 'android') return
  plugin ??= registerPlugin<AppLockPlugin>('AppLock')
  plugin.setHideInRecents({ hide }).catch(() => {
    /* старая сборка без плагина — снимок остаётся */
  })
}
