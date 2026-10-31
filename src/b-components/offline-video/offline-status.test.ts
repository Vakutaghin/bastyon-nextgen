// Подписи состояния скачанного.

import { describe, it, expect } from 'vitest'
import type { OfflineItem } from '@/services/offline-video/types'
import { formatBytes } from '@/services/offline-video/format-bytes'
import { offlineFraction, offlinePercent, offlineStatusText } from './offline-status'

const t = (key: string, p?: Record<string, unknown>) => (p ? `${key} ${JSON.stringify(p)}` : key)

function item(state: OfflineItem['state']): OfflineItem {
  return {
    id: 'x',
    meta: {
      id: 'x',
      peertubeUrl: 'peertube://h/x',
      kind: 'video',
      uuid: 'x',
      title: '',
      author: { address: 'P' },
      height: 144,
      size: 10 * 1024 * 1024,
      createdAt: 1,
      accounts: ['P'],
    },
    state,
  }
}

describe('offline-status', () => {
  it('доля и проценты', () => {
    expect(offlineFraction(5, 10)).toBe(0.5)
    expect(offlineFraction(5, 0)).toBeNull()
    expect(offlinePercent(345, 1000)).toBe('34 %')
    expect(offlinePercent(1, 0)).toBe('')
  })

  it('размеры на языке интерфейса', () => {
    expect(formatBytes(47 * 1024 * 1024, 'ru')).toMatch(/^47 МБ$/)
    expect(formatBytes(1.25 * 1024 ** 3, 'en')).toBe('1.3 GB')
    expect(formatBytes(512, 'en')).toBe('1 kB')
    expect(formatBytes(150 * 1024 * 1024, 'kr')).toMatch(/150/)
  })

  it('состояние: ход, причина паузы, причина сбоя', () => {
    const down = offlineStatusText(
      t,
      'en',
      item({ status: 'downloading', received: 0, total: 0 }),
      {
        received: 5 * 1024 * 1024,
        total: 10 * 1024 * 1024,
      }
    )
    expect(down).toBe(
      'offlineVideo.status.downloading {"percent":"50 %","received":"5 MB","total":"10 MB"}'
    )
    expect(
      offlineStatusText(
        t,
        'en',
        item({ status: 'paused', received: 1, total: 2, error: 'wifi' }),
        undefined
      )
    ).toBe('offlineVideo.status.pausedBecause {"reason":"offlineVideo.reason.wifi"}')
    expect(
      offlineStatusText(
        t,
        'en',
        item({ status: 'failed', received: 1, total: 2, error: 'not_found' }),
        undefined
      )
    ).toBe('offlineVideo.status.failedBecause {"reason":"offlineVideo.reason.notFound"}')
    expect(
      offlineStatusText(t, 'en', item({ status: 'failed', received: 1, total: 2 }), undefined)
    ).toBe('offlineVideo.status.failed')
  })
})
