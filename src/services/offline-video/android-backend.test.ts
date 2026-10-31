// Скачанные ролики на Android: методы OfflineBackend — вызовы плагина
// OfflineVideo с теми же полями, события — его `progress` и `changed`.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { plugin } = vi.hoisted(() => ({
  plugin: {
    list: vi.fn(),
    enqueue: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    remove: vi.fn(),
    patchMeta: vi.fn(),
    usage: vi.fn(),
    clear: vi.fn(),
    nativePath: vi.fn(),
    setWifiOnly: vi.fn(),
    addListener: vi.fn(),
  },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
  registerPlugin: (name: string) => {
    expect(name).toBe('OfflineVideo')
    return plugin
  },
}))

import { androidBackend } from './android-backend'
import type { OfflineItem, OfflineJob, OfflineMeta } from './types'

const meta: OfflineMeta = {
  id: 'abc-360',
  peertubeUrl: 'peertube://peertube701.pocketnet.app/abc',
  kind: 'video',
  uuid: 'abc',
  title: 'Ролик',
  author: { address: 'PAddr' },
  height: 360,
  size: 1000,
  createdAt: 1,
  accounts: ['PAddr'],
}
const item: OfflineItem = {
  id: 'abc-360',
  meta,
  state: { status: 'queued', received: 0, total: 1000 },
}
const job: OfflineJob = {
  id: 'abc-360',
  sources: [
    'https://peertube701.pocketnet.app/static/streaming-playlists/hls/abc/abc-360-fragmented.mp4',
  ],
  fileName: 'abc-360-fragmented.mp4',
  sha256Urls: [
    'https://peertube701.pocketnet.app/static/streaming-playlists/hls/abc/segments-sha256.json',
  ],
  extras: [
    { name: 'thumb.jpg', url: 'https://peertube701.pocketnet.app/static/thumbnails/abc.jpg' },
  ],
  size: 1000,
}

beforeEach(() => {
  Object.values(plugin).forEach((fn) => fn.mockReset())
})

describe('android offline backend', () => {
  it('список и постановка — как у плагина', async () => {
    expect(androidBackend.kind).toBe('android')
    plugin.list.mockResolvedValue({ items: [item] })
    expect(await androidBackend.list()).toEqual([item])
    plugin.list.mockResolvedValue({})
    expect(await androidBackend.list()).toEqual([])

    plugin.enqueue.mockResolvedValue(item)
    expect(await androidBackend.enqueue(job, meta)).toBe(item)
    expect(plugin.enqueue).toHaveBeenCalledWith({ job, meta })
  })

  it('команды по id и правка meta', async () => {
    await androidBackend.pause('abc-360')
    expect(plugin.pause).toHaveBeenCalledWith({ id: 'abc-360' })
    await androidBackend.resume('abc-360')
    expect(plugin.resume).toHaveBeenCalledWith({ id: 'abc-360' })
    await androidBackend.remove('abc-360')
    expect(plugin.remove).toHaveBeenCalledWith({ id: 'abc-360' })
    await androidBackend.clear()
    expect(plugin.clear).toHaveBeenCalled()

    plugin.patchMeta.mockResolvedValue(item)
    const patch = { accounts: ['PAddr', 'PB'], authorDeleted: null }
    expect(await androidBackend.patchMeta('abc-360', patch)).toBe(item)
    expect(plugin.patchMeta).toHaveBeenCalledWith({ id: 'abc-360', patch })

    await androidBackend.setWifiOnly?.(false)
    expect(plugin.setWifiOnly).toHaveBeenCalledWith({ on: false })
  })

  it('ошибка плагина доходит как есть: код в сообщении', async () => {
    plugin.resume.mockRejectedValue(Object.assign(new Error('not_found'), { code: 'not_found' }))
    await expect(androidBackend.resume('nope')).rejects.toThrow('not_found')
  })

  it('место: free null — не узнать', async () => {
    plugin.usage.mockResolvedValue({ used: 5, free: 7_000_000_000 })
    expect(await androidBackend.usage()).toEqual({ used: 5, free: 7_000_000_000 })
    plugin.usage.mockResolvedValue({ used: 5 })
    expect(await androidBackend.usage()).toEqual({ used: 5, free: null })
    plugin.usage.mockResolvedValue({ used: 0, free: null })
    expect(await androidBackend.usage()).toEqual({ used: 0, free: null })
  })

  it('файлы — через перехват WebView, ExoPlayer — file://', async () => {
    const origin = window.location.origin
    expect(await androidBackend.fileUrl('abc-360', 'video.mp4')).toBe(
      `${origin}/_offline_/abc-360/video.mp4`
    )
    expect(await androidBackend.fileUrl('abc-360', 'captions/pt-BR.vtt')).toBe(
      `${origin}/_offline_/abc-360/captions/pt-BR.vtt`
    )

    plugin.nativePath.mockResolvedValue({
      path: '/data/user/0/com.bastyon.app/files/offline/abc-360/video.mp4',
    })
    expect(await androidBackend.nativeUrl?.('abc-360')).toBe(
      'file:///data/user/0/com.bastyon.app/files/offline/abc-360/video.mp4'
    )
    expect(plugin.nativePath).toHaveBeenCalledWith({ id: 'abc-360' })
    plugin.nativePath.mockResolvedValue({})
    expect(await androidBackend.nativeUrl?.('abc-360')).toBeNull()
  })

  it('события — подписка плагина, отписка снимает её; item: null при удалении', async () => {
    const handlers: Record<string, (p: unknown) => void> = {}
    const remove = vi.fn()
    plugin.addListener.mockImplementation(async (event: string, cb: (p: unknown) => void) => {
      handlers[event] = cb
      return { remove }
    })

    const progress = vi.fn()
    const offProgress = await androidBackend.onProgress(progress)
    handlers.progress?.({ id: 'abc-360', received: 10, total: 1000 })
    expect(progress).toHaveBeenCalledWith({ id: 'abc-360', received: 10, total: 1000 })

    const changed = vi.fn()
    const offChanged = await androidBackend.onChanged(changed)
    handlers.changed?.({ id: 'abc-360', item })
    handlers.changed?.({ id: 'abc-360' })
    expect(changed).toHaveBeenNthCalledWith(1, { id: 'abc-360', item })
    expect(changed).toHaveBeenNthCalledWith(2, { id: 'abc-360', item: null })
    expect(plugin.addListener).toHaveBeenCalledWith('progress', expect.any(Function))
    expect(plugin.addListener).toHaveBeenCalledWith('changed', expect.any(Function))

    offProgress()
    offChanged()
    expect(remove).toHaveBeenCalledTimes(2)
  })
})
