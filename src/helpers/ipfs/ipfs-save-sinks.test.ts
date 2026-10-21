// Куда уходит проверенный файл: выбор способа по устройству и что каждый
// способ делает с кусками, при успехе и при отмене.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  mobile: false,
  tauri: false,
  invoke: vi.fn(),
  anchor: vi.fn(),
  fs: {
    writeFile: vi.fn(async () => ({ uri: '' })),
    appendFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined),
    rmdir: vi.fn(async () => undefined),
    getUri: vi.fn(async () => ({ uri: 'file:///cache/ipfs-downloads/x/a.zip' })),
  },
  share: { share: vi.fn(async () => ({})) },
}))

vi.mock('@mobile/utils/platform', () => ({ isMobile: () => h.mobile, isTauri: () => h.tauri }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }))
vi.mock('@/helpers/common/download-media', () => ({ triggerAnchorDownload: h.anchor }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: h.fs, Directory: { Cache: 'CACHE' } }))
vi.mock('@capacitor/share', () => ({ Share: h.share }))

import { BlobSink, DesktopSink, ShareSink, openSaveSink } from './ipfs-save-sinks'

type PickerWindow = Window & { showSaveFilePicker?: unknown }

const decodeBase64 = (data: string): string => atob(data)
const chunk = (s: string): Uint8Array => new TextEncoder().encode(s)

beforeEach(() => {
  vi.clearAllMocks()
  h.mobile = false
  h.tauri = false
})

afterEach(() => {
  delete (window as PickerWindow).showSaveFilePicker
})

describe('openSaveSink: способ по устройству', () => {
  it('телефон — «Поделиться», прошлые загрузки из кэша удаляются', async () => {
    h.mobile = true
    const sink = await openSaveSink('a.zip')
    expect(sink?.kind).toBe('share')
    expect(h.fs.rmdir).toHaveBeenCalledWith({
      path: 'ipfs-downloads',
      directory: 'CACHE',
      recursive: true,
    })
  })

  it('браузер с диалогом сохранения — запись на диск', async () => {
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn(async () => undefined) }
    const picker = vi.fn(async () => ({ createWritable: async () => writable }))
    ;(window as PickerWindow).showSaveFilePicker = picker
    const sink = await openSaveSink('a.zip')
    expect(picker).toHaveBeenCalledWith({ suggestedName: 'a.zip' })
    expect(sink?.kind).toBe('disk')
    await sink?.abort()
    expect(writable.abort).toHaveBeenCalled()
  })

  it('диалог закрыли — ничего не скачиваем', async () => {
    ;(window as PickerWindow).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('closed', 'AbortError')
    })
    expect(await openSaveSink('a.zip')).toBeNull()
  })

  it('диалог недоступен (нет жеста, политика) или его нет вовсе — обычная загрузка', async () => {
    ;(window as PickerWindow).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('no gesture', 'SecurityError')
    })
    expect((await openSaveSink('a.zip'))?.kind).toBe('blob')
    delete (window as PickerWindow).showSaveFilePicker
    expect((await openSaveSink('a.zip'))?.kind).toBe('blob')
  })
})

describe('BlobSink', () => {
  it('файл уходит обычной загрузкой под своим именем', async () => {
    const sink = new BlobSink('report.pdf')
    await sink.write(chunk('%PDF-'))
    await sink.write(chunk('1.7'))
    await sink.close()
    expect(h.anchor).toHaveBeenCalledWith(expect.stringMatching(/^blob:/), 'report.pdf')
  })

  it('отмена — загрузки нет', async () => {
    const sink = new BlobSink('a.bin')
    await sink.write(chunk('x'))
    await sink.abort()
    expect(h.anchor).not.toHaveBeenCalled()
  })
})

describe('ShareSink (телефон)', () => {
  const make = () =>
    new ShareSink(
      h.fs as never,
      h.share as never,
      'CACHE' as never,
      'ipfs-downloads/1/a.zip',
      'a.zip'
    )

  it('первый кусок создаёт файл, следующие дописываются; готовый — в «Поделиться»', async () => {
    const sink = make()
    const big = new Uint8Array(2 * 1024 * 1024).fill(0x41)
    await sink.write(big)
    await sink.write(chunk('tail'))
    await sink.close()

    expect(h.fs.writeFile).toHaveBeenCalledTimes(1)
    const [first] = h.fs.writeFile.mock.calls[0] as unknown as [
      { data: string; recursive: boolean },
    ]
    expect(first.recursive).toBe(true)
    expect(decodeBase64(first.data)).toHaveLength(big.length)
    const [second] = h.fs.appendFile.mock.calls[0] as unknown as [{ data: string }]
    expect(decodeBase64(second.data)).toBe('tail')
    expect(h.share.share).toHaveBeenCalledWith({
      title: 'a.zip',
      files: ['file:///cache/ipfs-downloads/x/a.zip'],
    })
  })

  it('пустой файл тоже создаётся', async () => {
    const sink = make()
    await sink.close()
    const [first] = h.fs.writeFile.mock.calls[0] as unknown as [{ data: string }]
    expect(first.data).toBe('')
  })

  it('закрытое «Поделиться» — не ошибка', async () => {
    h.share.share.mockRejectedValueOnce(new Error('Share canceled'))
    await expect(make().close()).resolves.toBeUndefined()
  })

  it('отмена удаляет недокачанный файл', async () => {
    const sink = make()
    await sink.write(new Uint8Array(2 * 1024 * 1024))
    await sink.abort()
    expect(h.fs.deleteFile).toHaveBeenCalledWith({
      path: 'ipfs-downloads/1/a.zip',
      directory: 'CACHE',
    })
    expect(h.share.share).not.toHaveBeenCalled()
  })
})

describe('DesktopSink (компьютер без модуля)', () => {
  it('диалог «Сохранить» — у Rust; закрыли — ничего не качаем', async () => {
    h.tauri = true
    h.invoke.mockResolvedValueOnce(null)
    expect(await openSaveSink('a.zip')).toBeNull()
    expect(h.invoke).toHaveBeenCalledWith('ipfs_sink_open', { suggestedName: 'a.zip' })
  })

  it('куски копятся до мегабайта и уходят сырым телом; конец — переименование', async () => {
    h.tauri = true
    h.invoke.mockResolvedValue('tok')
    const sink = (await openSaveSink('a.zip')) as DesktopSink
    expect(sink).toBeInstanceOf(DesktopSink)
    expect(sink.kind).toBe('disk')
    h.invoke.mockClear()
    await sink.write(new Uint8Array(600 * 1024))
    expect(h.invoke).not.toHaveBeenCalled()
    await sink.write(new Uint8Array(600 * 1024))
    expect(h.invoke).toHaveBeenCalledTimes(1)
    const [cmd, body, opts] = h.invoke.mock.calls[0] as [string, Uint8Array, unknown]
    expect(cmd).toBe('ipfs_sink_write')
    expect(body).toBeInstanceOf(Uint8Array)
    expect(body.length).toBe(1200 * 1024)
    expect(opts).toEqual({ headers: { 'x-sink': 'tok' } })
    await sink.write(chunk('tail'))
    await sink.close()
    expect(h.invoke).toHaveBeenNthCalledWith(2, 'ipfs_sink_write', chunk('tail'), {
      headers: { 'x-sink': 'tok' },
    })
    expect(h.invoke).toHaveBeenLastCalledWith('ipfs_sink_close', { token: 'tok' })
  })

  it('отмена удаляет недокачанное', async () => {
    h.invoke.mockResolvedValue(undefined)
    const sink = new DesktopSink(h.invoke as never, 'tok')
    await sink.write(chunk('part'))
    await sink.abort()
    expect(h.invoke).toHaveBeenCalledTimes(1)
    expect(h.invoke).toHaveBeenCalledWith('ipfs_sink_abort', { token: 'tok' })
  })
})
