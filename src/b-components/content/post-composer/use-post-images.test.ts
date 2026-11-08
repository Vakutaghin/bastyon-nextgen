// Порядок картинок в редакторе: перетаскивание переставляет, а не добавляет.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/b-components/app-toast', () => ({ appToast: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { usePostImages } from './use-post-images'

describe('usePostImages.move', () => {
  it('переставляет на место, набор тот же', () => {
    const { images, setFromUrls, move } = usePostImages()
    setFromUrls(['a', 'b', 'c'])
    const [a, , c] = images.value.map((i) => i.id)

    move(c!, 0)
    expect(images.value.map((i) => i.base64)).toEqual(['c', 'a', 'b'])
    move(a!, 2)
    expect(images.value.map((i) => i.base64)).toEqual(['c', 'b', 'a'])
  })

  it('чужой id, место за краем или то же место — без изменений', () => {
    const { images, setFromUrls, move } = usePostImages()
    setFromUrls(['a', 'b'])
    const before = images.value
    move('нет-такой', 0)
    move(before[0]!.id, 5)
    move(before[0]!.id, 0)
    expect(images.value).toBe(before)
  })
})
