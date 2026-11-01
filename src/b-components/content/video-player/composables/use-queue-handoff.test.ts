// Ролик из очереди на Android: адреса следующих — заранее, хвост для
// ExoPlayer — только из известных; вернулись после ухода вперёд — очередь на
// том ролике, позиция запомнена, открывается его пост.

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const m = vi.hoisted(() => ({
  prefetch: vi.fn(),
  known: new Set<string>(),
  save: vi.fn(async () => {}),
  openCurrent: vi.fn(),
}))

vi.mock('./background-media-controller', () => ({ isAndroidNative: true }))
vi.mock('@/b-components/media/mini-player/native-handoff', () => ({
  prefetchStreams: m.prefetch,
  resolvedTail: (upcoming: { url: string; title: string }[]) => {
    const tail = []
    for (const item of upcoming) {
      if (!m.known.has(item.url)) break
      tail.push({ url: `${item.url}.m3u8`, title: item.title })
    }
    return tail
  },
}))
vi.mock('@/db/apis/video-progress-api', () => ({ videoProgressAPI: { save: m.save } }))
vi.mock('@/composables/use-playback', async () => {
  const { usePlaybackQueueStore } = await import('@/stores/playback-queue-store')
  return { usePlayback: () => ({ queue: usePlaybackQueueStore(), openCurrent: m.openCurrent }) }
})

import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import { useQueueHandoff } from './use-queue-handoff'

const item = (id: string) => ({
  id,
  type: 'video' as const,
  url: `peertube://h/${id}`,
  title: id,
  artist: 'Автор',
  address: 'PA',
  cover: null,
  duration: 300,
})

function mountWith(url: string) {
  let api: ReturnType<typeof useQueueHandoff> | null = null
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useQueueHandoff(() => url)
        return () => h('div')
      },
    })
  )
  return { wrapper, api: api! }
}

describe('useQueueHandoff', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    m.prefetch.mockClear()
    m.save.mockClear()
    m.openCurrent.mockClear()
    m.known = new Set()
  })

  it('играет текущий ролик очереди — следующие заранее; хвост — до первого неизвестного адреса', async () => {
    const queue = usePlaybackQueueStore()
    queue.play([item('a'), item('b'), item('c')], 0)
    const { wrapper, api } = mountWith('peertube://h/a')
    await flushPromises()
    expect(m.prefetch).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'b' }), expect.objectContaining({ id: 'c' })],
      10
    )
    m.known.add('peertube://h/b')
    expect(api.queueTail()).toEqual([{ url: 'peertube://h/b.m3u8', title: 'b' }])
    wrapper.unmount()

    // Плеер не того ролика (лента рядом с очередью) — очереди ему не давать.
    const other = mountWith('peertube://h/zzz')
    expect(other.api.queueTail()).toEqual([])
    other.wrapper.unmount()
  })

  it('ExoPlayer ушёл на два вперёд — очередь там, позиция запомнена, пост открыт', async () => {
    const queue = usePlaybackQueueStore()
    queue.play([item('a'), item('b'), item('c')], 0)
    const { wrapper, api } = mountWith('peertube://h/a')
    api.onNativeAdvanced(2, 41)
    expect(queue.current?.id).toBe('c')
    expect(m.save).toHaveBeenCalledWith(expect.any(String), 41, 300)
    expect(m.openCurrent).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
