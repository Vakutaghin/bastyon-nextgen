// Файл уходит в Rust кусками: в памяти — один кусок, а не всё видео (с
// телефона это гигабайты). Сорвалось посередине — недописанный файл удаляется.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  convertFileSrc: (path: string) => `asset://${path}`,
}))
vi.mock('../utils/environment', () => ({ isTauri: () => true }))

import { TEMP_CHUNK_BYTES, TauriTranscoder } from './tauri-transcoder'

const TEMP = '/tmp/tauri_video_1_clip.mp4'

describe('TauriTranscoder: файл во временную папку', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'save_temp_file') return TEMP
      if (cmd === 'get_video_metadata')
        return { width: 1920, height: 1080, duration: 10, fps: 30, has_audio: true }
      return undefined
    })
  })

  it('большой файл — первый кусок создаёт файл, остальные дописываются', async () => {
    const size = TEMP_CHUNK_BYTES * 2 + 5
    const file = new File([new Uint8Array(size)], 'Отпуск.mp4', { type: 'video/mp4' })
    await new TauriTranscoder().getMetadata(file)

    const calls = mocks.invoke.mock.calls
    const [save, ...rest] = calls.filter(([cmd]) => cmd !== 'get_video_metadata')
    expect(save![0]).toBe('save_temp_file')
    expect((save![1] as Uint8Array).byteLength).toBe(TEMP_CHUNK_BYTES)
    expect(save![2]).toEqual({ headers: { 'x-file-name': encodeURIComponent('Отпуск.mp4') } })
    const appends = rest.filter(([cmd]) => cmd === 'append_temp_file')
    expect(appends.map(([, body]) => (body as Uint8Array).byteLength)).toEqual([
      TEMP_CHUNK_BYTES,
      5,
    ])
    expect(appends[0]![2]).toEqual({ headers: { 'x-file-path': encodeURIComponent(TEMP) } })
  })

  it('маленький файл — одним куском', async () => {
    const file = new File([new Uint8Array(10)], 'a.mp4', { type: 'video/mp4' })
    await new TauriTranscoder().getMetadata(file)
    expect(mocks.invoke.mock.calls.map(([cmd]) => cmd)).toEqual([
      'save_temp_file',
      'get_video_metadata',
      'delete_temp_file',
    ])
  })

  it('сорвалось посередине — недописанный файл удаляется', async () => {
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'save_temp_file') return TEMP
      if (cmd === 'append_temp_file') throw new Error('disk full')
      return undefined
    })
    const file = new File([new Uint8Array(TEMP_CHUNK_BYTES + 1)], 'a.mp4')
    await expect(new TauriTranscoder().getMetadata(file)).rejects.toMatchObject({
      code: 'METADATA_ERROR',
    })
    expect(mocks.invoke).toHaveBeenCalledWith('delete_temp_file', { filePath: TEMP })
  })
})
