import { beforeEach, describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  appFetch: vi.fn(),
  openExternal: vi.fn(),
  saveBlobToDevice: vi.fn(),
}))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: h.appFetch }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: h.openExternal }))
vi.mock('@/helpers/common/save-to-device', () => ({ saveBlobToDevice: h.saveBlobToDevice }))

import { bastyonImageName, deriveFilename, downloadMedia } from './download-media'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16])

/** Что ушло на сохранение: тип и имя. */
function saved(): { type: string; name: string } {
  const calls = h.saveBlobToDevice.mock.calls
  const [blob, name] = calls[calls.length - 1] as [Blob, string]
  return { type: blob.type, name }
}

describe('bastyonImageName', () => {
  it('image_from_bastyon_ и дата со временем до секунд, по местным часам', () => {
    expect(bastyonImageName(new Date(2026, 0, 5, 7, 3, 9))).toBe(
      'image_from_bastyon_2026-01-05_07-03-09'
    )
    expect(bastyonImageName(new Date(2026, 10, 12, 23, 59, 58))).toBe(
      'image_from_bastyon_2026-11-12_23-59-58'
    )
  })
})

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

  it('картинка без типа (сервер чата: octet-stream) — тип по байтам, чтобы было расширение', async () => {
    h.appFetch.mockResolvedValue(
      new Response(new Blob([PNG], { type: 'application/octet-stream' }))
    )
    await downloadMedia('https://host/i/abc', 'image_from_bastyon_x')
    expect(saved()).toEqual({ type: 'image/png', name: 'image_from_bastyon_x' })
  })

  it('расшифрованная помечена image/jpeg, а внутри PNG — сохраняется как PNG', async () => {
    const pageFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Blob([PNG], { type: 'image/jpeg' })))
    await downloadMedia('blob:app/1', 'image_from_bastyon_x')
    expect(saved().type).toBe('image/png')
    pageFetch.mockRestore()
  })

  it('тип файла не трогаем: PDF с байтами JPEG остаётся PDF, JPEG — JPEG', async () => {
    h.appFetch.mockResolvedValue(new Response(new Blob([JPEG], { type: 'application/pdf' })))
    await downloadMedia('https://host/f/doc', 'doc.pdf')
    expect(saved().type).toBe('application/pdf')

    h.appFetch.mockResolvedValue(new Response(new Blob([JPEG], { type: 'image/jpeg' })))
    await downloadMedia('https://host/i/abc')
    expect(saved().type).toBe('image/jpeg')
  })

  it('с сервера не скачалось — открываем снаружи', async () => {
    h.appFetch.mockRejectedValue(new Error('network'))
    expect(await downloadMedia('https://host/i/abc')).toBe('opened')
    expect(h.openExternal).toHaveBeenCalledWith('https://host/i/abc')
    expect(h.saveBlobToDevice).not.toHaveBeenCalled()
  })
})
