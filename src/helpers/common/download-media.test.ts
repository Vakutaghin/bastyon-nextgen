import { beforeEach, describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  appFetch: vi.fn(),
  openExternal: vi.fn(),
  saveBlobToDevice: vi.fn(),
}))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: h.appFetch }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: h.openExternal }))
vi.mock('@/helpers/common/save-to-device', () => ({ saveBlobToDevice: h.saveBlobToDevice }))

import { deriveFilename, downloadMedia } from './download-media'

describe('deriveFilename', () => {
  it('берёт последний сегмент пути с расширением', () => {
    expect(deriveFilename('https://peertube.example/i/abc123.jpg')).toBe('abc123.jpg')
    expect(deriveFilename('https://host/path/to/photo.PNG')).toBe('photo.PNG')
  })

  it('игнорирует query и hash', () => {
    expect(deriveFilename('https://host/file.webp?v=2&x=1#frag')).toBe('file.webp')
  })

  it('декодирует percent-encoding', () => {
    expect(deriveFilename('https://host/my%20pic.jpg')).toBe('my pic.jpg')
  })

  it('возвращает сегмент без расширения как есть', () => {
    expect(deriveFilename('https://host/media/longhashwithoutext')).toBe('longhashwithoutext')
  })

  it('фолбэк на дефолт для пустого/корневого URL', () => {
    expect(deriveFilename('')).toBe('download')
    expect(deriveFilename('https://host/')).toBe('download')
    expect(deriveFilename('https://host/', 'image')).toBe('image')
  })
})

describe('downloadMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.saveBlobToDevice.mockResolvedValue('saved')
  })

  it('картинка с сервера — через appFetch (Tor, без CORS) и на устройство', async () => {
    h.appFetch.mockResolvedValue(new Response(new Blob(['img'], { type: 'image/jpeg' })))
    expect(await downloadMedia('https://host/i/abc')).toBe('saved')
    expect(h.appFetch).toHaveBeenCalledWith('https://host/i/abc', { credentials: 'omit' })
    expect(h.saveBlobToDevice).toHaveBeenCalledWith(expect.any(Blob), 'abc')
  })

  it('расшифрованная картинка (blob:) — из памяти страницы, под своим именем', async () => {
    const pageFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Blob(['img'], { type: 'image/png' })))
    expect(await downloadMedia('blob:app/1', 'cat.png')).toBe('saved')
    expect(pageFetch).toHaveBeenCalledWith('blob:app/1')
    expect(h.appFetch).not.toHaveBeenCalled()
    expect(h.saveBlobToDevice).toHaveBeenCalledWith(expect.any(Blob), 'cat.png')
    pageFetch.mockRestore()
  })

  it('с сервера не скачалось — открываем снаружи', async () => {
    h.appFetch.mockRejectedValue(new Error('network'))
    expect(await downloadMedia('https://host/i/abc')).toBe('opened')
    expect(h.openExternal).toHaveBeenCalledWith('https://host/i/abc')
    expect(h.saveBlobToDevice).not.toHaveBeenCalled()
  })
})
