/**
 * Инициализация Capacitor: статус-бар, splash, клавиатура.
 * Вызывается из src/main.js после монтирования приложения.
 * На web-сборке Capacitor.isNativePlatform() === false и функция выходит сразу,
 * нативные плагины подгружаются динамически только под мобильным WebView.
 */

import { Capacitor } from '@capacitor/core'

export async function initCapacitor(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    document.documentElement.setAttribute('data-platform', 'web')
    return
  }

  const platform = Capacitor.getPlatform()
  document.documentElement.setAttribute('data-platform', platform)
  document.documentElement.setAttribute('data-native', 'true')

  const [statusBarMod, splashMod, keyboardMod] = await Promise.all([
    import('@capacitor/status-bar').catch((e) => {
      console.warn('[capacitor] @capacitor/status-bar load failed', e)
      return null
    }),
    import('@capacitor/splash-screen').catch((e) => {
      console.warn('[capacitor] @capacitor/splash-screen load failed', e)
      return null
    }),
    import('@capacitor/keyboard').catch((e) => {
      console.warn('[capacitor] @capacitor/keyboard load failed', e)
      return null
    }),
  ])

  if (statusBarMod) {
    try {
      await statusBarMod.StatusBar.setStyle({ style: statusBarMod.Style.Dark })
      if (platform === 'android') {
        await statusBarMod.StatusBar.setBackgroundColor({ color: '#000000' })
      }
    } catch (e) {
      console.warn('[capacitor] StatusBar setup failed', e)
    }
  }

  if (splashMod) {
    try {
      await splashMod.SplashScreen.hide()
    } catch (e) {
      console.warn('[capacitor] SplashScreen.hide failed', e)
    }
  }

  // «Назад» — в use-back-button (стопка обработчиков). Второй слушатель здесь
  // листал историю вдобавок к нему, а на первой странице закрывал приложение,
  // даже когда «Назад» закрывал чат.

  if (keyboardMod) {
    keyboardMod.Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.classList.add('keyboard-open')
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
    })
    keyboardMod.Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open')
      document.documentElement.style.setProperty('--keyboard-height', '0px')
    })
  }
}
