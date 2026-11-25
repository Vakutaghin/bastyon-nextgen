import { t } from '@/i18n'

/** Ход установки модуля (Tor, IPFS): этап и доля; текст из Rust — английский, для журнала. */
export interface InstallProgress {
  phase: 'starting' | 'downloading' | 'verifying' | 'extracting' | 'ready'
  fraction: number
}

/** Строка состояния: скачивание — в процентах, дальше — что происходит. */
export function installProgressText(
  progress: InstallProgress | null,
  keys: { downloading: string; preparing: string }
): string {
  if (!progress) return t(keys.preparing)
  if (progress.phase === 'verifying') return t('header.moduleVerifying')
  if (progress.phase === 'extracting' || progress.phase === 'ready') {
    return t('header.moduleExtracting')
  }
  return t(keys.downloading, { pct: Math.round(progress.fraction * 100) })
}
