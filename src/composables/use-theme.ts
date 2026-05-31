/**
 * Управление темой оформления (light / dark / auto).
 *
 * Состояние применяется к корневому `<html>` через атрибут `data-theme`,
 * который всегда содержит *разрешённую* тему (light|dark):
 *   - `light` → `<html data-theme="light">`
 *   - `dark`  → `<html data-theme="dark">`
 *   - `auto`  → разрешается в light|dark по системному `prefers-color-scheme`
 *               прямо в JS (см. `applyMode`), а matchMedia-listener в `initTheme`
 *               переключает тему вживую при смене системной.
 *
 * Почему не CSS `@media (prefers-color-scheme)`: тёмная палитра объявлена ТОЛЬКО
 * в `:root[data-theme="dark"]` — один источник правды. Дублировать ~60 токенов
 * во второй `@media`-блок означало бы неизбежный рассинхрон (так и было: auto-блок
 * перекрывал лишь ~11 токенов → «светлое на тёмном» у дефолтных пользователей).
 *
 * Выбор сохраняется в `localStorage` под ключом `bastyon_theme`. При первом
 * заходе используется `auto`.
 *
 * Стили живут в CSS variables (`src/style.css` :root и :root[data-theme="dark"]),
 * палитра styled-components — в `src/styles/theme-colors.ts` (var(--color-X)).
 * Поэтому смена темы — одна правка атрибута без перерисовки SC.
 *
 * `initTheme()` следует вызвать в `main.js` ДО монтирования приложения,
 * чтобы избежать вспышки светлой темы при загрузке.
 */

import { ref, computed, readonly, type Ref } from 'vue'

const STORAGE_KEY = 'bastyon_theme'

export type ThemeMode = 'auto' | 'light' | 'dark'

const isValidMode = (v: unknown): v is ThemeMode => v === 'auto' || v === 'light' || v === 'dark'

/** Прочитать сохранённый режим. `auto` — дефолт для новых пользователей. */
function loadStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isValidMode(raw)) return raw
  } catch {
    /* приватный режим / SSR — фолбэк ниже */
  }
  return 'auto'
}

/** Тёмная ли системная тема прямо сейчас. */
function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

/**
 * Применить режим к DOM. На `<html>` всегда выставляется *разрешённая* тема
 * (`light`|`dark`); `auto` резолвится по системному `prefers-color-scheme`.
 */
function applyMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const resolved: 'light' | 'dark' = mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : mode
  document.documentElement.setAttribute('data-theme', resolved)
}

const mode: Ref<ThemeMode> = ref<ThemeMode>('auto')

/**
 * Инициализация темы. Вызвать ОДИН РАЗ при бутстрапе приложения, до монтирования
 * корневого компонента — это убирает FOUC (вспышку светлой темы при загрузке).
 */
export function initTheme(): void {
  const stored = loadStoredMode()
  mode.value = stored
  applyMode(stored)

  // Живое следование системной теме, пока активен режим `auto`. Слушатель —
  // глобальный синглтон (как и `mode`): живёт всё время работы приложения,
  // отдельная очистка не нужна.
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (mode.value === 'auto') applyMode('auto')
    }
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else if (mq.addListener) mq.addListener(onChange) // Safari < 14
  }
}

/** Установить режим темы. Сохраняет в localStorage и применяет к DOM. */
export function setThemeMode(next: ThemeMode): void {
  mode.value = next
  applyMode(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* приватный режим — изменение не переживёт reload */
  }
}

/**
 * Composable для компонентов: реактивный режим темы + хелперы.
 *
 * @example
 * const { mode, isDark, setMode } = useTheme()
 * <button @click="setMode(isDark ? 'light' : 'dark')">Toggle</button>
 */
export function useTheme() {
  /** Является ли текущая активная тема тёмной (учитывая `auto` + системный). */
  const isDark = computed<boolean>(() => {
    if (mode.value === 'dark') return true
    if (mode.value === 'light') return false
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  return {
    mode: readonly(mode),
    isDark,
    setMode: setThemeMode,
  }
}
