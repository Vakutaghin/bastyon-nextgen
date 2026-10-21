import { describe, expect, it } from 'vitest'
import { canPreview, previewKind, PREVIEW_MAX_BYTES } from './ipfs-preview'

const chrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile'
const safari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

describe('previewKind', () => {
  it('картинки, звук, видео и текст показываются', () => {
    expect(previewKind('image/png', chrome)).toBe('image')
    expect(previewKind('image/svg+xml', chrome)).toBe('image')
    expect(previewKind('video/mp4', android)).toBe('video')
    expect(previewKind('audio/mpeg', android)).toBe('audio')
    expect(previewKind('text/plain; charset=utf-8', chrome)).toBe('text')
    expect(previewKind('application/json', chrome)).toBe('text')
  })

  it('HTML — текстом: чужую страницу на origin приложения не открываем', () => {
    expect(previewKind('text/html', chrome)).toBe('text')
  })

  it('MOV и HEIC — только в движке Apple', () => {
    expect(previewKind('video/quicktime', safari)).toBe('video')
    expect(previewKind('video/quicktime', chrome)).toBeNull()
    expect(previewKind('image/heic', safari)).toBe('image')
    expect(previewKind('image/heic', android)).toBeNull()
  })

  it('PDF, архивы и прочее — только скачать', () => {
    for (const type of ['application/pdf', 'application/zip', 'application/octet-stream', '']) {
      expect(previewKind(type, chrome), type).toBeNull()
    }
  })
})

describe('canPreview', () => {
  it('большое видео не держим в памяти — его скачивают', () => {
    expect(canPreview('video/mp4', PREVIEW_MAX_BYTES.video, chrome)).toBe('video')
    expect(canPreview('video/mp4', PREVIEW_MAX_BYTES.video + 1, chrome)).toBeNull()
  })

  it('текст любого размера: показывается начало', () => {
    expect(canPreview('text/plain', 10 * 1024 ** 3, chrome)).toBe('text')
  })
})
