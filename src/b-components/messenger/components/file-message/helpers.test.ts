import { describe, it, expect } from 'vitest'
import { iconForMime, formatFileSize } from './helpers'

describe('file-message helpers', () => {
  describe('iconForMime', () => {
    it('returns image icon for image mimes and extensions', () => {
      expect(iconForMime('image/png')).toBe('🖼️')
      expect(iconForMime('image/jpeg')).toBe('🖼️')
      expect(iconForMime(undefined, 'photo.JPG')).toBe('🖼️')
    })

    it('returns audio/video icons accordingly', () => {
      expect(iconForMime('audio/mpeg')).toBe('🎵')
      expect(iconForMime('video/mp4')).toBe('🎬')
      expect(iconForMime(undefined, 'movie.mkv')).toBe('🎬')
    })

    it('returns archive icon for zip and friends', () => {
      expect(iconForMime('application/zip')).toBe('🗜️')
      expect(iconForMime(undefined, 'src.tar.gz')).toBe('🗜️')
      expect(iconForMime('application/x-7z-compressed')).toBe('🗜️')
    })

    it('returns pdf for pdf', () => {
      expect(iconForMime('application/pdf')).toBe('📕')
      expect(iconForMime(undefined, 'report.PDF')).toBe('📕')
    })

    it('returns code icon for source code files', () => {
      expect(iconForMime(undefined, 'index.ts')).toBe('🧾')
      expect(iconForMime('application/json')).toBe('🧾')
    })

    it('defaults to generic file icon', () => {
      expect(iconForMime()).toBe('📄')
      expect(iconForMime('application/octet-stream', 'data.bin')).toBe('📄')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes under 1KB', () => {
      expect(formatFileSize(0)).toBe('0 Б')
      expect(formatFileSize(512)).toBe('512 Б')
    })

    it('formats KB with adaptive precision', () => {
      expect(formatFileSize(1024)).toBe('1.0 КБ')
      expect(formatFileSize(2048)).toBe('2.0 КБ')
      expect(formatFileSize(500 * 1024)).toBe('500 КБ')
    })

    it('formats MB and GB', () => {
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 МБ')
      expect(formatFileSize(50 * 1024 * 1024)).toBe('50 МБ')
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.50 ГБ')
    })

    it('returns empty for invalid', () => {
      expect(formatFileSize(NaN)).toBe('')
      expect(formatFileSize(-1)).toBe('')
    })
  })
})
