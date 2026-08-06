import { describe, it, expect } from 'vitest'
import {
  validateVideoFile,
  isMatroska,
  MAX_VIDEO_SIZE_BYTES,
  VideoValidationError,
} from './peertube-validation'

const MKV_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]

/** File с заданными первыми байтами и MIME. */
const fileWith = (bytes: number[], type: string, name = 'v'): File =>
  new File([new Uint8Array(bytes)], name, { type })

/** Лёгкая заглушка File с большим size без аллокации гигабайтов. */
const hugeFile = (size: number, type = 'video/mp4'): File =>
  ({ type, size, name: 'big.mp4', lastModified: 0 }) as unknown as File

describe('isMatroska', () => {
  it('распознаёт EBML magic 1A 45 DF A3', async () => {
    expect(await isMatroska(fileWith([...MKV_MAGIC, 0x00, 0x11], ''))).toBe(true)
  })
  it('чужие байты / слишком короткий файл → false', async () => {
    expect(await isMatroska(fileWith([0x00, 0x11, 0x22, 0x33], ''))).toBe(false)
    expect(await isMatroska(fileWith([0x1a, 0x45], ''))).toBe(false)
  })
})

describe('validateVideoFile', () => {
  it('video/mp4 → isVideo, файл не меняется', async () => {
    const f = fileWith([0, 1, 2, 3], 'video/mp4', 'clip.mp4')
    const r = await validateVideoFile(f)
    expect(r).toMatchObject({ isVideo: true, isAudio: false })
    expect(r.file).toBe(f) // не пере-обёрнут
  })

  it('audio/mpeg → isAudio, isVideo=false', async () => {
    const r = await validateVideoFile(fileWith([0, 1, 2, 3], 'audio/mpeg', 'a.mp3'))
    expect(r).toMatchObject({ isVideo: false, isAudio: true })
  })

  it('пустой MIME + MKV magic → пере-обёртка в video/x-matroska, isVideo', async () => {
    const f = fileWith([...MKV_MAGIC, 0x00], '', 'movie.mkv')
    const r = await validateVideoFile(f)
    expect(r.isVideo).toBe(true)
    expect(r.file).not.toBe(f) // новый File
    expect(r.file.type).toBe('video/x-matroska')
    expect(r.file.name).toBe('movie.mkv')
  })

  it('пустой MIME без MKV magic → video_format_unsupported', async () => {
    await expect(validateVideoFile(fileWith([0, 1, 2, 3], '', 'x.bin'))).rejects.toMatchObject({
      code: 'video_format_unsupported',
    })
  })

  it('не-медиа MIME (application/pdf) → video_format_unsupported', async () => {
    await expect(
      validateVideoFile(fileWith([0, 1, 2, 3], 'application/pdf', 'd.pdf'))
    ).rejects.toBeInstanceOf(VideoValidationError)
  })

  it('размер > 4 ГиБ → video_too_large', async () => {
    await expect(validateVideoFile(hugeFile(MAX_VIDEO_SIZE_BYTES + 1))).rejects.toMatchObject({
      code: 'video_too_large',
    })
  })

  it('ровно 4 ГиБ проходит (граница не превышена)', async () => {
    const r = await validateVideoFile(hugeFile(MAX_VIDEO_SIZE_BYTES))
    expect(r.isVideo).toBe(true)
  })

  it('null → video_not_selected', async () => {
    await expect(validateVideoFile(null)).rejects.toMatchObject({ code: 'video_not_selected' })
  })
})
