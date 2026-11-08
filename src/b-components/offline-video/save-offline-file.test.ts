// «Сохранить файлом»: имя файла из названия поста, звук — .m4a, ролик — .mp4;
// файл идёт в выбранное место кусками, закрытый диалог — не ошибка.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfflineItem } from '@/services/offline-video/types'

const mocks = vi.hoisted(() => ({
  openSaveSink: vi.fn(),
  fileUrl: vi.fn(async () => 'blob:offline/video.mp4'),
}))

vi.mock('@/helpers/ipfs/ipfs-save-sinks', () => ({ openSaveSink: mocks.openSaveSink }))
vi.mock('@/services/offline-video/backend', () => ({
  offlineBackend: async () => ({ fileUrl: mocks.fileUrl }),
}))

import { offlineFileName, saveOfflineFile } from './save-offline-file'

function item(kind: 'audio' | 'video', title: string): OfflineItem {
  return {
    id: 'uuid-0',
    meta: {
      id: 'uuid-0',
      peertubeUrl: 'peertube://h/uuid',
      kind,
      uuid: 'uuid',
      title,
      author: { address: 'PA' },
      height: 0,
      size: 6,
      createdAt: 1,
      accounts: ['PA'],
    },
    state: { status: 'done', received: 6, total: 6 },
  }
}

function sink() {
  return {
    kind: 'blob' as const,
    maxBytes: 1024,
    write: vi.fn(async (_chunk: Uint8Array) => {}),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4, 5, 6])))
  )
})

describe('offlineFileName', () => {
  it('звук — .m4a, ролик — .mp4, без запрещённых в именах знаков', () => {
    expect(offlineFileName(item('audio', 'Трек: для/дороги?'))).toBe('дороги.m4a')
    expect(offlineFileName(item('video', 'Ролик'))).toBe('Ролик.mp4')
    expect(offlineFileName(item('video', ''))).toBe('uuid.mp4')
  })
})

describe('saveOfflineFile', () => {
  it('пишет файл с устройства в выбранное место', async () => {
    const s = sink()
    mocks.openSaveSink.mockResolvedValue(s)
    expect(await saveOfflineFile(item('audio', 'Трек'))).toBe('saved')
    expect(mocks.openSaveSink).toHaveBeenCalledWith('Трек.m4a')
    expect(mocks.fileUrl).toHaveBeenCalledWith('uuid-0', 'video.mp4')
    const written = s.write.mock.calls.reduce((n, [chunk]) => n + chunk.length, 0)
    expect(written).toBe(6)
    expect(s.close).toHaveBeenCalled()
  })

  it('диалог закрыли — отмена, ничего не читаем', async () => {
    mocks.openSaveSink.mockResolvedValue(null)
    expect(await saveOfflineFile(item('video', 'Ролик'))).toBe('cancelled')
    expect(mocks.fileUrl).not.toHaveBeenCalled()
  })

  it('файл не прочитался — недописанное убирается', async () => {
    const s = sink()
    mocks.openSaveSink.mockResolvedValue(s)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 }))
    )
    expect(await saveOfflineFile(item('video', 'Ролик'))).toBe('failed')
    expect(s.abort).toHaveBeenCalled()
    expect(s.close).not.toHaveBeenCalled()
  })
})
