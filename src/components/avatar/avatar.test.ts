// Аватар и превью с устройства: небольшой берёт превью вместо сети и, пока оно
// читается, не мигает инициалами; крупный идёт в сеть, а без сети показывает
// превью; показанная из сети картинка оставляет превью следующему запуску.

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  keys: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
}))
vi.mock('@/db/apis/avatar-thumbs-api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/db/apis/avatar-thumbs-api')>()
  return { thumbKey: real.thumbKey, avatarThumbsAPI: api }
})

import { thumbKey } from '@/db/apis/avatar-thumbs-api'
import {
  __resetAvatarThumbsForTests,
  avatarSource,
  startAvatarThumbs,
} from '@/services/avatar-thumbs'
import Avatar from './index'

const URL_A = 'https://pocketnet.app:8092/i/aaa.jfif'
const THUMB_A = 'data:image/webp;base64,AAAA'

const render = (size: number, src = URL_A) =>
  mount(Avatar, { props: { src, size, alt: 'Alice', fallbackText: 'Alice' } })

async function startWith(keys: string[], rows: unknown[] = []): Promise<void> {
  api.keys.mockResolvedValue(new Set(keys))
  api.get.mockResolvedValue(rows)
  await startAvatarThumbs()
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetAvatarThumbsForTests()
  api.keys.mockReset()
  api.get.mockReset().mockResolvedValue([])
  api.save.mockReset().mockResolvedValue(undefined)
  api.clear.mockReset().mockResolvedValue(0)
})

afterEach(() => {
  __resetAvatarThumbsForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Avatar и превью с устройства', () => {
  it('превью не запускались (база не открылась) — картинка из сети, как раньше', () => {
    expect(render(32).get('img').attributes('src')).toBe(URL_A)
  })

  it('небольшой: пока превью читается — ни картинки, ни инициалов; потом превью', async () => {
    await startWith([thumbKey(URL_A)], [{ url: URL_A, data: THUMB_A, savedAt: Date.now() }])
    const w = render(40)
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).not.toContain('A')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(w.get('img').attributes('src')).toBe(THUMB_A)
  })

  it('крупный — из сети; сеть не дала — превью с устройства', async () => {
    await startWith([thumbKey(URL_A)], [{ url: URL_A, data: THUMB_A, savedAt: Date.now() }])
    const w = render(120)
    expect(w.get('img').attributes('src')).toBe(URL_A)
    await w.get('img').trigger('error')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(w.get('img').attributes('src')).toBe(THUMB_A)
  })

  it('крупный без превью и без сети — инициалы', async () => {
    await startWith([])
    const w = render(120)
    await w.get('img').trigger('error')
    await flushPromises()
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('A')
  })

  it('показанная из сети картинка оставляет превью', async () => {
    await startWith([])
    const ctx = { drawImage: vi.fn(), fillRect: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(THUMB_A)
    const w = render(120)
    const img = w.get('img').element
    Object.defineProperty(img, 'naturalWidth', { value: 300 })
    Object.defineProperty(img, 'naturalHeight', { value: 300 })
    await w.get('img').trigger('load')
    await vi.advanceTimersByTimeAsync(200)
    expect(avatarSource(URL_A, 32).src).toBe(THUMB_A)
    // Крупный аватар остаётся на картинке из сети.
    expect(w.get('img').attributes('src')).toBe(URL_A)
  })

  it('смена картинки сбрасывает сбой прежней', async () => {
    await startWith([])
    const w = render(120)
    await w.get('img').trigger('error')
    await flushPromises()
    await w.setProps({ src: 'https://pocketnet.app:8092/i/bbb.jfif' })
    expect(w.get('img').attributes('src')).toBe('https://pocketnet.app:8092/i/bbb.jfif')
  })
})
