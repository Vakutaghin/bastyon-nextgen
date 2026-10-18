// Каталог «Сервисов»: следующая страница грузится сразу за текущей, и
// «Загрузить ещё» видно, только когда в ней есть что показать — не при
// ровно одной странице приложений и не когда дальше одни установленные.

import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRemoteApps, type UseRemoteAppsOptions } from './use-remote-apps'

const app = (i: number) => ({ id: `app${i}.app`, name: `App ${i}`, scope: `a${i}.com` })

/** Нода с `total` приложениями; `fail` — номера запросов (с нуля), которые падают. */
function node(total: number, fail: number[] = []) {
  let call = 0
  return vi.fn(async (_method: string, params: unknown) => {
    const n = call++
    if (fail.includes(n)) throw new Error('offline')
    const { pageStart, pageSize, search } = params as {
      pageStart: number
      pageSize: number
      search: string
    }
    const all = Array.from({ length: total }, (_, i) => app(i)).filter(
      (a) => !search || a.name.includes(search)
    )
    return all.slice(pageStart, pageStart + pageSize)
  })
}

let wrapper: VueWrapper | null = null

function setup(options: UseRemoteAppsOptions) {
  let api!: ReturnType<typeof useRemoteApps>
  wrapper = mount(
    defineComponent({
      setup() {
        api = useRemoteApps(options)
        return () => h('div')
      },
    })
  )
  return api
}

const settle = () => vi.waitFor(() => Promise.resolve())

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('useRemoteApps', () => {
  it('ровно одна страница приложений — кнопки нет, хотя страница полная', async () => {
    const rpc = node(4)
    const api = setup({ rpc, pageSize: 4 })
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    await settle()
    expect(api.items.value).toHaveLength(4)
    expect(api.hasMore.value).toBe(false)
  })

  it('следующая страница уже загружена: кнопка видна, нажатие добавляет сразу и грузит дальше', async () => {
    const rpc = node(10)
    const api = setup({ rpc, pageSize: 4 })
    await vi.waitFor(() => expect(api.hasMore.value).toBe(true))
    expect(api.items.value).toHaveLength(4)

    await api.loadMore()
    expect(api.items.value).toHaveLength(8)
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(3))
    await vi.waitFor(() => expect(api.hasMore.value).toBe(true))

    await api.loadMore()
    expect(api.items.value.map((a) => a.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `app${i}.app`)
    )
    await settle()
    expect(api.hasMore.value).toBe(false)
  })

  it('дальше только установленные — листает их, а если показать нечего, кнопки нет', async () => {
    const installed = new Set(['app4.app', 'app5.app', 'app6.app', 'app7.app', 'app8.app'])
    const rpc = node(9)
    const api = setup({ rpc, pageSize: 4, isHidden: (e) => installed.has(e.id) })
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(3))
    await settle()
    expect(api.hasMore.value).toBe(false)
  })

  it('за страницей из установленных есть новые — кнопка есть, нажатие их показывает', async () => {
    const installed = new Set(['app4.app', 'app5.app', 'app6.app', 'app7.app'])
    const rpc = node(10)
    const api = setup({ rpc, pageSize: 4, isHidden: (e) => installed.has(e.id) })
    await vi.waitFor(() => expect(api.hasMore.value).toBe(true))
    await api.loadMore()
    expect(api.items.value.some((a) => a.id === 'app8.app')).toBe(true)
  })

  it('следующая страница не загрузилась — кнопка остаётся и повторяет попытку', async () => {
    const rpc = node(6, [1])
    const api = setup({ rpc, pageSize: 4 })
    await vi.waitFor(() => expect(api.hasMore.value).toBe(true))
    expect(api.items.value).toHaveLength(4)

    await api.loadMore()
    expect(api.items.value).toHaveLength(6)
    await settle()
    expect(api.hasMore.value).toBe(false)
  })

  it('поиск сменился, пока грузилась страница вперёд — старый ответ не попадает в выдачу', async () => {
    vi.useFakeTimers()
    try {
      const rpc = node(12)
      const api = setup({ rpc, pageSize: 4 })
      await vi.waitFor(() => expect(api.hasMore.value).toBe(true))

      api.search.value = 'App 1'
      await vi.advanceTimersByTimeAsync(400)
      await vi.waitFor(() =>
        expect(api.items.value.map((a) => a.name)).toEqual(['App 1', 'App 10', 'App 11'])
      )
      await vi.waitFor(() => expect(api.hasMore.value).toBe(false))
    } finally {
      vi.useRealTimers()
    }
  })
})
