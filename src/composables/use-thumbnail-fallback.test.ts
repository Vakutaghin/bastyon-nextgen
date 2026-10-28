// Превью, которое не загрузилось: один раз ищем ролик, как плеер, иначе заглушка.

import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useThumbnailFallback } from './use-thumbnail-fallback'

const POINTER = 'peertube://peertube700.pocketnet.app/546cec25'
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useThumbnailFallback', () => {
  it('не загрузилось — берёт превью, которое нашёл плеер', async () => {
    const find = vi.fn(async () => 'https://peertube701.pocketnet.app/static/thumbnails/a.jpg')
    const { src, onError } = useThumbnailFallback(
      () => 'https://peertube700.pocketnet.app/static/thumbnails/a.jpg',
      () => POINTER,
      find
    )
    onError()
    expect(src.value).toBeNull()
    await flush()
    expect(find).toHaveBeenCalledWith(POINTER)
    expect(src.value).toBe('https://peertube701.pocketnet.app/static/thumbnails/a.jpg')
  })

  it('и найденное не грузится — заглушка, второй раз не ищет', async () => {
    const find = vi.fn(async () => 'https://peertube701.pocketnet.app/b.jpg')
    const { src, onError } = useThumbnailFallback(
      () => 'https://dead/b.jpg',
      () => POINTER,
      find
    )
    onError()
    await flush()
    onError()
    await flush()
    expect(find).toHaveBeenCalledTimes(1)
    expect(src.value).toBeNull()
  })

  it('нашлось то же, что не грузилось, или ничего — заглушка', async () => {
    const same = useThumbnailFallback(
      () => 'https://peertube322.pocketnet.app/c.jpg',
      () => POINTER,
      async () => 'https://peertube322.pocketnet.app/c.jpg'
    )
    same.onError()
    await flush()
    expect(same.src.value).toBeNull()

    const none = useThumbnailFallback(
      () => 'https://x/c.jpg',
      () => POINTER,
      async () => {
        throw new Error('not found')
      }
    )
    none.onError()
    await flush()
    expect(none.src.value).toBeNull()
  })

  it('другой ролик в той же карточке — свой адрес, ответ про прежний не подставляется', async () => {
    const thumb = ref('https://a/1.jpg')
    let resolveFind: (url: string) => void = () => {}
    const find = vi.fn(() => new Promise<string>((resolve) => (resolveFind = resolve)))
    const { src, onError } = useThumbnailFallback(
      () => thumb.value,
      () => POINTER,
      find
    )
    onError()
    thumb.value = 'https://a/2.jpg'
    await nextTick()
    expect(src.value).toBe('https://a/2.jpg')
    resolveFind('https://archive/1.jpg')
    await flush()
    expect(src.value).toBe('https://a/2.jpg')
  })
})
