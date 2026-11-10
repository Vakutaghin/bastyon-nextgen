// Превью аватарок: небольшая аватарка берёт превью с устройства вместо сети,
// пока оно читается — ждёт (без инициалов), зависшая база не держит аватарки;
// превью снимается с показанной картинки, когда есть свободное время, и
// пишется пачкой. База подменена; холст в jsdom не рисует — подменён тоже.

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
  INDEX_WAIT_MS,
  READ_WAIT_MS,
  REFRESH_AFTER_MS,
  SAVE_DELAY_MS,
  SHOW_MAX_PX,
  THUMB_PX,
  __resetAvatarThumbsForTests,
  avatarSource,
  fallbackThumb,
  flushAvatarThumbs,
  forgetAvatarThumbs,
  makeThumb,
  rememberThumb,
  startAvatarThumbs,
} from './avatar-thumbs'

const URL_A = 'https://pocketnet.app:8092/i/aaa.jfif'
const URL_B = 'https://peertube101.pocketnet.app/images/b/b-original.jpg'
const THUMB_A = 'data:image/webp;base64,AAAA'

function image(w: number, h: number, currentSrc = URL_A): HTMLImageElement {
  const img = document.createElement('img')
  Object.defineProperty(img, 'naturalWidth', { value: w })
  Object.defineProperty(img, 'naturalHeight', { value: h })
  Object.defineProperty(img, 'currentSrc', { value: currentSrc })
  return img
}

let ctx: { drawImage: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn> } & Record<
  string,
  unknown
>
let toDataURL: ReturnType<typeof vi.fn>

async function started(keys: string[] | null = []): Promise<void> {
  api.keys.mockResolvedValue(keys === null ? null : new Set(keys))
  await startAvatarThumbs()
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetAvatarThumbsForTests()
  api.keys.mockReset().mockResolvedValue(new Set())
  api.get.mockReset().mockResolvedValue([])
  api.save.mockReset().mockResolvedValue(undefined)
  api.clear.mockReset().mockResolvedValue(0)
  ctx = { drawImage: vi.fn(), fillRect: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
  toDataURL = vi.fn().mockReturnValue(THUMB_A)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    toDataURL as unknown as HTMLCanvasElement['toDataURL']
  )
})

afterEach(() => {
  __resetAvatarThumbsForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('откуда брать аватарку', () => {
  it('база не открылась (превью не запускались) — из сети, как раньше', () => {
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
    expect(avatarSource(null, 32)).toEqual({ wait: false })
  })

  it('пока читается индекс — небольшая ждёт, крупная идёт в сеть', async () => {
    let release: (keys: Set<string>) => void = () => {}
    api.keys.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const start = startAvatarThumbs()
    expect(avatarSource(URL_A, SHOW_MAX_PX)).toEqual({ wait: true })
    expect(avatarSource(URL_A, SHOW_MAX_PX + 1)).toEqual({ src: URL_A, wait: false })
    release(new Set())
    await start
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
  })

  it('индекс завис — через INDEX_WAIT_MS аватарки идут в сеть', async () => {
    api.keys.mockReturnValue(new Promise(() => {}))
    void startAvatarThumbs()
    expect(avatarSource(URL_A, 32).wait).toBe(true)
    await vi.advanceTimersByTimeAsync(INDEX_WAIT_MS)
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
  })

  it('база недоступна — сразу из сети', async () => {
    await started(null)
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
  })

  it('превью на устройстве — читается пачкой и заменяет картинку; крупной — нет', async () => {
    await started([thumbKey(URL_A), thumbKey(URL_B)])
    api.get.mockResolvedValue([
      { url: URL_A, data: THUMB_A, savedAt: Date.now() },
      { url: URL_B, data: 'data:image/webp;base64,BBBB', savedAt: Date.now() },
    ])
    expect(avatarSource(URL_A, 32)).toEqual({ wait: true })
    expect(avatarSource(URL_B, 50)).toEqual({ wait: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get.mock.calls[0]![0]).toEqual([
      [thumbKey(URL_A), URL_A],
      [thumbKey(URL_B), URL_B],
    ])
    expect(avatarSource(URL_A, 32)).toEqual({ src: THUMB_A, wait: false })
    expect(avatarSource(URL_A, 120)).toEqual({ src: URL_A, wait: false })
    // Свежее превью не переписывается.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).not.toHaveBeenCalled()
  })

  it('превью не нашлось (стёрли, совпал хэш) — в сеть', async () => {
    await started([thumbKey(URL_A)])
    api.get.mockResolvedValue([])
    avatarSource(URL_A, 32)
    await vi.advanceTimersByTimeAsync(0)
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
  })

  it('чтение превью зависло — через READ_WAIT_MS в сеть; пришло позже — подставляется', async () => {
    await started([thumbKey(URL_A)])
    let release: (rows: unknown) => void = () => {}
    api.get.mockReturnValue(new Promise((resolve) => (release = resolve)))
    avatarSource(URL_A, 32)
    await vi.advanceTimersByTimeAsync(READ_WAIT_MS)
    expect(avatarSource(URL_A, 32)).toEqual({ src: URL_A, wait: false })
    release([{ url: URL_A, data: THUMB_A, savedAt: Date.now() }])
    await vi.advanceTimersByTimeAsync(0)
    expect(avatarSource(URL_A, 32)).toEqual({ src: THUMB_A, wait: false })
  })

  it('давно сохранённое превью освежается: давно не виденные вытесняются первыми', async () => {
    await started([thumbKey(URL_A)])
    api.get.mockResolvedValue([
      { url: URL_A, data: THUMB_A, savedAt: Date.now() - REFRESH_AFTER_MS - 1 },
    ])
    avatarSource(URL_A, 32)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).toHaveBeenCalledWith([{ url: URL_A, data: THUMB_A }])
  })

  it('крупной аватарке без сети — запасное превью с устройства', async () => {
    await started([thumbKey(URL_A)])
    api.get.mockResolvedValue([{ url: URL_A, data: THUMB_A, savedAt: Date.now() }])
    expect(fallbackThumb(URL_A)).toBeUndefined()
    await vi.advanceTimersByTimeAsync(0)
    expect(fallbackThumb(URL_A)).toBe(THUMB_A)
    expect(fallbackThumb(URL_B)).toBeUndefined()
    expect(api.get).toHaveBeenCalledTimes(1)
  })
})

describe('превью с показанной картинки', () => {
  it('квадрат по центру, не больше THUMB_PX; в WebP', () => {
    expect(makeThumb(image(400, 200))).toBe(THUMB_A)
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      100,
      0,
      200,
      200,
      0,
      0,
      THUMB_PX,
      THUMB_PX
    )
    expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.8)
    // Маленькую не растягиваем.
    makeThumb(image(40, 60))
    expect(ctx.drawImage).toHaveBeenLastCalledWith(expect.anything(), 0, 10, 40, 40, 0, 0, 40, 40)
  })

  it('WebKit не кодирует WebP — JPEG на белом фоне', () => {
    toDataURL.mockImplementation((type: string) =>
      type === 'image/webp' ? 'data:image/png;base64,PPPP' : 'data:image/jpeg;base64,JJJJ'
    )
    expect(makeThumb(image(200, 200))).toBe('data:image/jpeg;base64,JJJJ')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, THUMB_PX, THUMB_PX)
    expect(ctx.drawImage).toHaveBeenCalledTimes(2)
  })

  it('картинка без CORS, не загружена или не сжалась — превью нет', () => {
    toDataURL.mockImplementationOnce(() => {
      throw new DOMException('tainted', 'SecurityError')
    })
    expect(makeThumb(image(200, 200))).toBeNull()
    expect(makeThumb(image(0, 0))).toBeNull()
    toDataURL.mockReturnValueOnce('data:image/webp;base64,' + 'A'.repeat(50_000))
    expect(makeThumb(image(200, 200))).toBeNull()
  })

  it('снимается в свободное время, пишется пачкой и сразу служит небольшой аватарке', async () => {
    await started()
    rememberThumb(URL_A, image(300, 300))
    rememberThumb(URL_B, image(300, 300, URL_B))
    expect(toDataURL).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(avatarSource(URL_A, 32)).toEqual({ src: THUMB_A, wait: false })
    expect(api.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save.mock.calls[0]![0].map((t: { url: string }) => t.url)).toEqual([URL_A, URL_B])
    // Уже снятое второй раз не снимается.
    rememberThumb(URL_A, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    expect(toDataURL).toHaveBeenCalledTimes(2)
  })

  it('не снимаем: база не готова, GIF (остановил бы анимацию), показано само превью, не картинка', async () => {
    rememberThumb(URL_A, image(300, 300))
    await started()
    rememberThumb('https://x/anim.gif', image(300, 300, 'https://x/anim.gif'))
    rememberThumb(URL_A, image(300, 300, THUMB_A))
    rememberThumb(URL_B, document.createElement('div'))
    rememberThumb(null, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    expect(toDataURL).not.toHaveBeenCalled()
  })

  it('без CORS снять не вышло — больше не пробуем', async () => {
    await started()
    toDataURL.mockImplementation(() => {
      throw new DOMException('tainted', 'SecurityError')
    })
    rememberThumb(URL_A, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    rememberThumb(URL_A, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    expect(toDataURL).toHaveBeenCalledTimes(1)
  })
})

describe('запись и стирание', () => {
  it('свернули приложение — пишем сразу', async () => {
    await started()
    rememberThumb(URL_A, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(api.save).toHaveBeenCalledTimes(1)
  })

  it('стирание отменяет накопленное и ждёт идущей записи', async () => {
    await started()
    let finish: () => void = () => {}
    api.save.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    rememberThumb(URL_A, image(300, 300))
    await vi.advanceTimersByTimeAsync(200)
    void flushAvatarThumbs()
    rememberThumb(URL_B, image(300, 300, URL_B))
    await vi.advanceTimersByTimeAsync(200)

    const forget = forgetAvatarThumbs()
    await vi.advanceTimersByTimeAsync(0)
    expect(api.clear).not.toHaveBeenCalled()
    finish()
    await forget
    expect(api.clear).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).toHaveBeenCalledTimes(1)
  })
})
