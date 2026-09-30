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
import { UI_SCALES, useAppPreferencesStore } from '@/stores/app-preferences-store'
import { logger } from '@/services/logger'

const log = logger.scope('[preferences]')

/** Класс, по которому style.css гасит анимации и переходы. */
export const NO_ANIMATIONS_CLASS = 'no-animations'

function applyAnimations(enabled: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(NO_ANIMATIONS_CLASS, !enabled)
}

/**
 * Масштаб интерфейса. В десктопной сборке просим вебвью. В браузере
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

/** Шаг масштаба: 1 — крупнее, -1 — мельче, 0 — обратно 100 %. */
export type UiScaleStep = 1 | -1 | 0

/** Соседний масштаб из тех, что в настройках (80…150 %), в сторону `step`. */
export function stepUiScale(current: number, step: UiScaleStep): number {
  if (step === 0) return 100
  if (step > 0)
    return UI_SCALES.find((scale) => scale > current) ?? UI_SCALES[UI_SCALES.length - 1]!
  return [...UI_SCALES].reverse().find((scale) => scale < current) ?? UI_SCALES[0]
}

/**
 * Какой шаг масштаба просит сочетание: Cmd (на Mac) или Ctrl и +, − или 0.
 * Клавишу берём по месту (`code`), а не по символу: в русской раскладке и с
 * Shift символ другой, а клавиша та же.
 */
export function zoomShortcutStep(event: KeyboardEvent, apple: boolean): UiScaleStep | null {
  if (!(apple ? event.metaKey : event.ctrlKey) || event.altKey) return null
  switch (event.code) {
    case 'Equal':
    case 'NumpadAdd':
      return 1
    case 'Minus':
    case 'NumpadSubtract':
      return -1
    case 'Digit0':
    case 'Numpad0':
      return 0
  }
  if (event.key === '+' || event.key === '=') return 1
  if (event.key === '-') return -1
  if (event.key === '0') return 0
  return null
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
}

/**
 * Масштаб в десктопе — только клавишами и в настройках. Встроенные в Tauri
 * горячие клавиши (`zoomHotkeysEnabled`) выключены: их скрипт менял масштаб на
 * 20 % за каждое событие колеса с Ctrl, а щипок на тачпаде присылает таких
 * событий десятки — масштаб прыгал от случайного касания. На Windows тот же
 * флаг включал и щипок самого WebView2. Свои клавиши шагают по масштабам из
 * настроек и сохраняют выбор, поэтому после перезапуска он тот же.
 */
function setupZoomShortcuts(prefs: ReturnType<typeof useAppPreferencesStore>): void {
  if (!isTauri() || typeof window === 'undefined') return
  const apple = isApplePlatform()

  window.addEventListener('keydown', (event) => {
    const step = zoomShortcutStep(event, apple)
    if (step === null) return
    event.preventDefault()
    const next = stepUiScale(prefs.uiScale, step)
    if (next !== prefs.uiScale) void prefs.set('uiScale', next)
  })

  // Щипок приходит колесом с Ctrl (WebKit, WebView2) или жестом WebKit на Mac —
  // не даём вебвью масштабировать ни тем, ни другим.
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) event.preventDefault()
    },
    { passive: false }
  )
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => event.preventDefault())
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
  setupZoomShortcuts(prefs)

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
