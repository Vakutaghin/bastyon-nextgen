// Порядок картинок в редакторе: перетаскивание переставляет, а не добавляет.
// Поворот: всегда от картинки до первого поворота — без накопления потерь JPEG.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/b-components/app-toast', () => ({ appToast: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

const rotateBase64 = vi.hoisted(() =>
  vi.fn(async (src: string, degrees: number) => (degrees % 360 ? `${src}@${degrees}` : src))
)
vi.mock('./image-transform', () => ({ rotateBase64 }))

import { usePostImages } from './use-post-images'

beforeEach(() => {
  rotateBase64.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('usePostImages.rotate', () => {
  it('каждый поворот — от исходника; полный оборот возвращает его как был', async () => {
    const { images, setFromUrls, rotate } = usePostImages()
    setFromUrls(['data:a'])
    const id = images.value[0]!.id
    for (const expected of ['data:a@90', 'data:a@180', 'data:a@270', 'data:a']) {
      await rotate(id)
      expect(images.value[0]!.base64).toBe(expected)
    }
    expect(rotateBase64.mock.calls.map((c) => c[0])).toEqual([
      'data:a',
      'data:a',
      'data:a',
      'data:a',
    ])
  })

  it('два нажатия подряд — оба поворота, на экране последний', async () => {
    const { images, setFromUrls, rotate } = usePostImages()
    setFromUrls(['data:a'])
    const id = images.value[0]!.id
    await Promise.all([rotate(id), rotate(id)])
    expect(images.value[0]!.base64).toBe('data:a@180')
  })

  it('после редактора отсчёт — от новой картинки', async () => {
    const { images, setFromUrls, rotate, replace } = usePostImages()
    setFromUrls(['data:a'])
    const id = images.value[0]!.id
    await rotate(id)
    replace(id, 'data:crop')
    await rotate(id)
    expect(images.value[0]!.base64).toBe('data:crop@90')
  })

  it('поворот не удался — картинка прежняя, следующий поворот — на 90°', async () => {
    const { images, setFromUrls, rotate } = usePostImages()
    setFromUrls(['data:a'])
    const id = images.value[0]!.id
    rotateBase64.mockRejectedValueOnce(new Error('image_load_failed'))
    await rotate(id)
    expect(images.value[0]!.base64).toBe('data:a')
    await rotate(id)
    expect(images.value[0]!.base64).toBe('data:a@90')
  })
})

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
