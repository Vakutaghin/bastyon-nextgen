// Просмотры под видеопостом: из описания видеосервера, у эфира — зрители сейчас.

import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { PeerTubeVideoInfo } from '@/helpers/api/peertube-api'
import { usePostViews } from './use-post-views'

const POINTER = 'peertube://peertube14.pocketnet.app/6a0b1c2d-1111-2222-3333-444455556666'
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function info(fields: Partial<PeerTubeVideoInfo>): PeerTubeVideoInfo {
  return { id: 1, uuid: 'u', name: 'n', ...fields }
}

describe('usePostViews', () => {
  it('берёт просмотры ролика с его сервера', async () => {
    const find = vi.fn(async (_host: string, _id: string) => info({ views: 1234 }))
    const { count, live } = usePostViews(() => POINTER, find)
    await flush()
    expect(find).toHaveBeenCalledWith(
      'peertube14.pocketnet.app',
      '6a0b1c2d-1111-2222-3333-444455556666'
    )
    expect(count.value).toBe(1234)
    expect(live.value).toBe(false)
  })

  it('у прямого эфира — сколько смотрят сейчас', async () => {
    const find = vi.fn(async (_host: string, _id: string) =>
      info({ isLive: true, views: 900, viewers: 12 })
    )
    const { count, live } = usePostViews(() => POINTER, find)
    await flush()
    expect(count.value).toBe(12)
    expect(live.value).toBe(true)
  })

  it('ноль, ошибка и не ролик PeerTube — без счётчика', async () => {
    const zero = usePostViews(
      () => POINTER,
      vi.fn(async (_host: string, _id: string) => info({ views: 0 }))
    )
    const failed = usePostViews(
      () => POINTER,
      vi.fn(async (_host: string, _id: string): Promise<PeerTubeVideoInfo> => {
        throw new Error('404')
      })
    )
    const find = vi.fn(async (_host: string, _id: string) => info({ views: 5 }))
    const other = usePostViews(() => 'https://youtube.com/watch?v=x', find)
    await flush()
    expect(zero.count.value).toBeNull()
    expect(failed.count.value).toBeNull()
    expect(other.count.value).toBeNull()
    expect(find).not.toHaveBeenCalled()
  })

  it('ответ по прежней ссылке после смены ролика не показывается', async () => {
    const url = ref(POINTER)
    let release: (v: PeerTubeVideoInfo) => void = () => {}
    const find = vi
      .fn(async (_host: string, _id: string): Promise<PeerTubeVideoInfo> => info({ views: 7 }))
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const { count } = usePostViews(() => url.value, find)
    url.value = 'peertube://peertube14.pocketnet.app/other'
    await nextTick()
    await flush()
    release(info({ views: 999 }))
    await flush()
    expect(count.value).toBe(7)
  })
})
