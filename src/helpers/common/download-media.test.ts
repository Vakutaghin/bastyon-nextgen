import { describe, it, expect } from 'vitest'
import { deriveFilename } from './download-media'

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
