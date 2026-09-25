/**
 * Применение настроек приложения к самому приложению.
 *
 * Настройка, которая никуда не применяется, хуже отсутствующей, поэтому всё,
 * что влияет на документ целиком (анимации, масштаб интерфейса), включается
 * здесь — один раз на запуск, рядом с чтением настроек.
 *
 * Точечные настройки (автоплей, встроенные видео, порядок комментариев) читают
 * стор там, где работают, — им отдельный эффект не нужен.
 */

import { watch } from 'vue'

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { logger } from '@/services/logger'

const log = logger.scope('[preferences]')

/** Класс, по которому style.css гасит анимации и переходы. */
export const NO_ANIMATIONS_CLASS = 'no-animations'

function applyAnimations(enabled: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(NO_ANIMATIONS_CLASS, !enabled)
}

/**
 * Масштаб интерфейса. В десктопной сборке просим вебвью — тот же механизм, что
 * у горячих клавиш Ctrl +/-, поэтому масштаб не дерётся с ними. В браузере
 * настройка не показывается: там масштабом заведует сам браузер.
 */
async function applyUiScale(percent: number): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    await getCurrentWebview().setZoom(percent / 100)
  } catch (e) {
    log.debug('zoom failed', e)
  }
}

let started = false

/** Прочитать настройки и держать документ в согласии с ними. Идемпотентно. */
export async function setupAppPreferences(): Promise<void> {
  if (started) return
  started = true

  const prefs = useAppPreferencesStore()
  await prefs.load()

  applyAnimations(prefs.animations)
  void applyUiScale(prefs.uiScale)

  watch(
    () => prefs.animations,
    (enabled) => applyAnimations(enabled)
  )
  watch(
    () => prefs.uiScale,
    (percent) => void applyUiScale(percent)
  )
}

/** Сброс для тестов. */
export function resetAppPreferencesEffectsForTests(): void {
  started = false
}
