// Долгие блокировки главного потока для сведений в поддержку: переживают
// перезапуск (localStorage), хранятся неделю и не больше двадцати, из кадра
// берутся самые долгие скрипты — имя файла без пути, функция, длительность;
// короткие заминки не пишутся.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { noteStall, recentStalls, stallFromFrame } from './main-thread-stalls'

const NOW = Date.parse('2026-10-31T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => vi.stubGlobal('localStorage', memStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('main-thread-stalls', () => {
  it('запись переживает перезапуск: читается из localStorage', () => {
    noteStall({ ms: 4200, blockingMs: 4100 }, NOW)
    expect(JSON.parse(localStorage.getItem('BST_DIAG_STALLS')!)).toHaveLength(1)
    expect(recentStalls(NOW)).toMatchObject([
      { ms: 4200, blockingMs: 4100, at: new Date(NOW).toISOString() },
    ])
  })

  it('старше недели — не показываются; хранится не больше двадцати', () => {
    noteStall({ ms: 1500 }, NOW - 8 * DAY)
    expect(recentStalls(NOW)).toHaveLength(0)
    for (let i = 0; i < 25; i++) noteStall({ ms: 1000 + i }, NOW + i)
    const kept = recentStalls(NOW + 25)
    expect(kept).toHaveLength(20)
    expect(kept[19]!.ms).toBe(1024)
  })

  it('из кадра — три самых долгих скрипта: файл без пути и запроса, функция, мс', () => {
    const stall = stallFromFrame(
      {
        duration: 3210.6,
        blockingDuration: 3150.2,
        scripts: [
          {
            duration: 40,
            sourceURL: 'https://localhost/assets/a.js',
            invokerType: 'event-listener',
          },
          {
            duration: 2900.4,
            sourceURL: 'https://localhost/assets/index-Bx9.js?v=1',
            sourceFunctionName: 'decryptEvent',
            sourceCharPosition: 48213,
          },
          { duration: 120, sourceURL: '', invokerType: 'resolve-promise' },
          { duration: 1, sourceURL: 'https://localhost/assets/b.js' },
        ],
      },
      false
    )
    expect(stall).toEqual({
      ms: 3211,
      blockingMs: 3150,
      hidden: undefined,
      scripts: [
        'index-Bx9.js:48213 decryptEvent 2900ms',
        '? resolve-promise 120ms',
        'a.js event-listener 40ms',
      ],
    })
  })

  it('без атрибуции (longtask) — только длительность; свёрнутое помечается', () => {
    expect(stallFromFrame({ duration: 1800 }, true)).toEqual({
      ms: 1800,
      blockingMs: undefined,
      hidden: true,
      scripts: undefined,
    })
  })

  it('битая запись в хранилище не ломает сведения', () => {
    localStorage.setItem('BST_DIAG_STALLS', '{oops')
    expect(recentStalls(NOW)).toEqual([])
    noteStall({ ms: 2000 }, NOW)
    expect(recentStalls(NOW)).toHaveLength(1)
  })
})
