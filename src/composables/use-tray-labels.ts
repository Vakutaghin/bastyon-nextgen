/**
 * Подписи меню трея (Windows, Linux) и строки меню macOS на языке приложения:
 * меню собирает Rust (src-tauri/src/tray.rs, app_menu.rs), а язык знает только
 * фронт. Только для десктопной сборки; где меню нет, команды ничего не делают.
 */
import { watch } from 'vue'
import { i18n, t } from '@/i18n'
import { logger } from '@/services/logger'

const log = logger.scope('[tray]')

const MENU_KEYS = [
  'about',
  'services',
  'hide',
  'hideOthers',
  'showAll',
  'quit',
  'file',
  'closeWindow',
  'edit',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
  'view',
  'fullscreen',
  'window',
  'minimize',
  'zoom',
  'help',
] as const

/** Подписи строки меню; `{name}` остаётся — название подставляет Rust. */
export function appMenuLabels(): Record<(typeof MENU_KEYS)[number], string> {
  return Object.fromEntries(
    MENU_KEYS.map((key) => [key, t(`appMenu.${key}`, { name: '{name}' })])
  ) as Record<(typeof MENU_KEYS)[number], string>
}

export function useTrayLabels(): void {
  watch(
    () => i18n.global.locale.value,
    async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('tray_set_labels', { open: t('tray.open'), quit: t('tray.quit') })
        await invoke('app_menu_set_labels', { labels: appMenuLabels() })
      } catch (err) {
        log.debug('labels not set', err)
      }
    },
    { immediate: true }
  )
}
