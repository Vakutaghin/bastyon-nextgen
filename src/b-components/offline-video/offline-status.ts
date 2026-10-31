// Подписи состояния скачанного: кнопка под роликом и карточки «Скачанное».

import type { OfflineItem } from '@/services/offline-video/types'
import { formatBytes } from '@/services/offline-video/format-bytes'

type T = (key: string, params?: Record<string, unknown>) => string

/** Доля скачанного 0…1; null — размер ещё не известен. */
export function offlineFraction(received: number, total: number): number | null {
  return total > 0 ? Math.min(1, received / total) : null
}

export function offlinePercent(received: number, total: number): string {
  const f = offlineFraction(received, total)
  return f === null ? '' : `${Math.floor(f * 100)} %`
}

/** Почему стоит или упало — по коду бэкенда. */
export function offlineReason(t: T, error: string | undefined): string {
  switch (error) {
    case 'network':
      return t('offlineVideo.reason.network')
    case 'not_found':
      return t('offlineVideo.reason.notFound')
    case 'hash_mismatch':
      return t('offlineVideo.reason.hashMismatch')
    case 'no_space':
    case 'disk_full':
      return t('offlineVideo.reason.noSpace')
    case 'tor_not_ready':
      return t('offlineVideo.reason.tor')
    case 'wifi':
      return t('offlineVideo.reason.wifi')
    case 'quota':
      return t('offlineVideo.reason.quota')
    case 'io':
      return t('offlineVideo.reason.io')
    default:
      return ''
  }
}

/** Строка состояния карточки. */
export function offlineStatusText(
  t: T,
  locale: string,
  item: OfflineItem,
  progress: { received: number; total: number } | undefined
): string {
  const received = progress?.received ?? item.state.received
  const total = progress?.total || item.state.total || item.meta.size
  const size = (n: number) => formatBytes(n, locale)
  switch (item.state.status) {
    case 'done':
      return t('offlineVideo.status.done', { size: size(item.state.total || total) })
    case 'queued':
      return t('offlineVideo.status.queued')
    case 'downloading':
      return total > 0
        ? t('offlineVideo.status.downloading', {
            percent: offlinePercent(received, total),
            received: size(received),
            total: size(total),
          })
        : t('offlineVideo.status.starting')
    case 'paused': {
      const reason = offlineReason(t, item.state.error)
      const percent = offlinePercent(received, total)
      if (reason) return t('offlineVideo.status.pausedBecause', { reason })
      return percent ? t('offlineVideo.status.paused', { percent }) : t('offlineVideo.pausedShort')
    }
    case 'failed': {
      const reason = offlineReason(t, item.state.error)
      return reason
        ? t('offlineVideo.status.failedBecause', { reason })
        : t('offlineVideo.status.failed')
    }
  }
}
