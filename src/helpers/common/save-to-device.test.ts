import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ openSaveSink: vi.fn() }))
vi.mock('@/helpers/ipfs/ipfs-save-sinks', () => ({ openSaveSink: h.openSaveSink }))

import { safeFileName, saveBlobToDevice } from './save-to-device'

function fakeSink(maxBytes = 10 * 1024 ** 2) {
  const written: number[] = []
  return {
    written,
    sink: {
      kind: 'disk',
      maxBytes,
      write: vi.fn(async (chunk: Uint8Array) => void written.push(chunk.length)),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    },
  }
}

describe('safeFileName', () => {
  it('убирает путь и запрещённые символы из чужого имени', () => {
    expect(safeFileName('../../.ssh/authorized_keys')).toBe('authorized_keys')
    expect(safeFileName('C:\\Users\\a\\photo.jpg')).toBe('photo.jpg')
    expect(safeFileName('a<b>:c?.png')).toBe('abc.png')
    expect(safeFileName('...')).toBe('download')
  })

  it('без расширения — по типу файла', () => {
    expect(safeFileName('abc123', 'image/jpeg')).toBe('abc123.jpg')
    expect(safeFileName('photo.png', 'image/jpeg')).toBe('photo.png')
    expect(safeFileName('', 'image/webp', 'image')).toBe('image.webp')
    expect(safeFileName('note', 'application/x-unknown')).toBe('note')
  })
})

describe('saveBlobToDevice', () => {
  beforeEach(() => h.openSaveSink.mockReset())

  it('пишет файл кусками и закрывает', async () => {
    const { sink, written } = fakeSink()
    h.openSaveSink.mockResolvedValue(sink)
    const blob = new Blob([new Uint8Array(2.5 * 1024 * 1024)], { type: 'image/png' })
    expect(await saveBlobToDevice(blob, 'pic')).toBe('saved')
    expect(h.openSaveSink).toHaveBeenCalledWith('pic.png')
    expect(written).toEqual([1024 * 1024, 1024 * 1024, 512 * 1024])
    expect(sink.close).toHaveBeenCalled()
  })

  it('диалог закрыли — ничего не пишем', async () => {
    h.openSaveSink.mockResolvedValue(null)
    expect(await saveBlobToDevice(new Blob(['x']), 'a.txt')).toBe('cancelled')
  })

  it('ошибка записи или файл больше, чем выдержит способ, — недописанное убирается', async () => {
    const broken = fakeSink()
    broken.sink.write.mockRejectedValue(new Error('disk full'))
    h.openSaveSink.mockResolvedValue(broken.sink)
    expect(await saveBlobToDevice(new Blob(['x']), 'a.txt')).toBe('failed')
    expect(broken.sink.abort).toHaveBeenCalled()

    const small = fakeSink(1)
    h.openSaveSink.mockResolvedValue(small.sink)
    expect(await saveBlobToDevice(new Blob(['xy']), 'a.txt')).toBe('failed')
    expect(small.sink.abort).toHaveBeenCalled()
    expect(small.written).toEqual([])
  })
})
