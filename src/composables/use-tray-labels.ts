/**
 * Подписи меню трея (Windows, Linux) на языке приложения: меню собирает Rust
 * (src-tauri/src/tray.rs), а язык знает только фронт. Только для десктопной
 * сборки; где трея нет, команда ничего не делает.
 */
import { watch } from 'vue'
import { i18n, t } from '@/i18n'
import { logger } from '@/services/logger'

const log = logger.scope('[tray]')

export function useTrayLabels(): void {
  watch(
    () => i18n.global.locale.value,
    async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('tray_set_labels', { open: t('tray.open'), quit: t('tray.quit') })
      } catch (err) {
        log.debug('labels not set', err)
      }
    },
    { immediate: true }
  )
}
