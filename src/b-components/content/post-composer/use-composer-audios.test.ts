// Записи аудио-поста: грузятся по очереди, порядок и названия меняются, сбой
// одной не мешает другим, обложка — у первой записи.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'

import type { KeyPair } from '@/blockchain/types/keys'
import { MAX_POST_AUDIOS } from '@/helpers/content/post-audios'
import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import type { UploadVideoParams } from '@/services/peertube/peertube-video-service'
import { asAudioFile } from './audio-file'
import { useComposerAudios, type UseComposerAudiosOptions } from './use-composer-audios'

const auth = { keyPair: {} as KeyPair, address: 'PAddr' }
const mp3 = (name: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type: 'audio/mpeg' })
const flush = () => new Promise((r) => setTimeout(r, 0))

/** Загрузки, которые завершает тест. */
function manualUpload() {
  const started: Array<{
    params: UploadVideoParams
    done: (uuid: string, isAudio?: boolean) => Promise<void>
    fail: (error: Error) => Promise<void>
  }> = []
  const upload = vi.fn(
    (params: UploadVideoParams) =>
      new Promise((resolve, reject) => {
        started.push({
          params,
          done: async (uuid, isAudio = true) => {
            resolve({ pointer: '', host: 'pt.example', uuid, isAudio })
            await flush()
          },
          fail: async (error) => {
            reject(error)
            await flush()
          },
        })
      })
  )
  return { upload: upload as unknown as UseComposerAudiosOptions['upload'], started }
}

let scope: EffectScope
function setup(overrides: Partial<UseComposerAudiosOptions> = {}) {
  const options: UseComposerAudiosOptions = {
    getAuth: () => auth,
    onAuthRequired: vi.fn(),
    onFirstUploaded: vi.fn(),
    saveCover: vi.fn(async () => {}) as never,
    serverCover: vi.fn(async () => null),
    duration: async () => 61.6,
    ...overrides,
  }
  scope = effectScope()
  return { options, audios: scope.run(() => useComposerAudios(options))! }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  )
})
afterEach(() => {
  scope.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useComposerAudios', () => {
  it('файлы встают по именам — «2» раньше «10» — и грузятся по одному', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('Глава 10.mp3'), mp3('Глава 2.mp3'), mp3('Глава 1.mp3')])
    expect(audios.items.value.map((x) => x.title)).toEqual(['Глава 1', 'Глава 2', 'Глава 10'])
    expect(audios.items.value.map((x) => x.status)).toEqual(['uploading', 'queued', 'queued'])
    expect(started).toHaveLength(1)
    expect(started[0]!.params).toMatchObject({ name: 'Глава 1', address: 'PAddr' })
    expect(audios.busy.value).toBe(true)

    started[0]!.params.onProgress?.({ bytesUploaded: 5, total: 10, percent: 50 })
    expect(audios.items.value[0]!.percent).toBe(50)
    await started[0]!.done('u1')
    expect(audios.items.value.map((x) => x.status)).toEqual(['done', 'uploading', 'queued'])
    expect(audios.firstUrl.value).toBe('peertube://pt.example/u1/audio')
    await started[1]!.done('u2')
    await started[2]!.done('u3')
    expect(audios.busy.value).toBe(false)
    expect(audios.uploaded.value).toEqual([
      { url: 'peertube://pt.example/u1/audio', title: 'Глава 1', duration: 62 },
      { url: 'peertube://pt.example/u2/audio', title: 'Глава 2', duration: 62 },
      { url: 'peertube://pt.example/u3/audio', title: 'Глава 10', duration: 62 },
    ])
  })

  it('сервер принял файл с вшитой картинкой за видео — запись всё равно звук', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('a.mp3')])
    await started[0]!.done('u1', false)
    expect(audios.firstUrl.value).toBe('peertube://pt.example/u1/audio')
  })

  it('сбой одной: остальные грузятся, «Повторить» — тот же файл', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('1.mp3'), mp3('2.mp3')])
    await started[0]!.fail(new Error('network'))
    expect(audios.failed.value).toBe(true)
    expect(audios.items.value[0]!.error).not.toBe('')
    await started[1]!.done('u2')
    expect(audios.firstUrl.value).toBe('peertube://pt.example/u2/audio')
    audios.retry(audios.items.value[0]!.id)
    expect(audios.failed.value).toBe(false)
    expect(started[2]!.params.file.name).toBe('1.mp3')
    await started[2]!.done('u1')
    expect(audios.uploaded.value.map((x) => x.url)).toEqual([
      'peertube://pt.example/u1/audio',
      'peertube://pt.example/u2/audio',
    ])
  })

  it('убрали ту, что грузится: загрузка оборвана, следующая пошла', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('1.mp3'), mp3('2.mp3')])
    const first = audios.items.value[0]!.id
    audios.remove(first)
    expect(started[0]!.params.signal?.aborted).toBe(true)
    expect(started).toHaveLength(2)
    await started[0]!.fail(new PeertubeUploadError('cancelled', { cancelled: true } as never))
    expect(audios.items.value.map((x) => x.title)).toEqual(['2'])
    expect(audios.failed.value).toBe(false)
    await started[1]!.done('u2')
    expect(audios.uploaded.value).toHaveLength(1)
  })

  it('добавили ещё, пока грузится, — вторая загрузка не начинается, ждёт очереди', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('1.mp3')])
    audios.add([mp3('2.mp3')])
    expect(started).toHaveLength(1)
    expect(audios.items.value.map((x) => x.status)).toEqual(['uploading', 'queued'])
    await started[0]!.done('u1')
    expect(started).toHaveLength(2)
  })

  it('порядок, названия, предел', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('1.mp3'), mp3('2.mp3')])
    await started[0]!.done('u1')
    await started[1]!.done('u2')
    audios.rename(audios.items.value[1]!.id, 'Эпилог')
    audios.move(1, 0)
    expect(audios.uploaded.value.map((x) => x.title)).toEqual(['Эпилог', '1'])
    expect(audios.firstUrl.value).toBe('peertube://pt.example/u2/audio')
    audios.move(0, 5)
    expect(audios.uploaded.value.map((x) => x.title)).toEqual(['Эпилог', '1'])

    audios.add(Array.from({ length: 200 }, (_, i) => mp3(`${i}.mp3`)))
    expect(audios.items.value).toHaveLength(MAX_POST_AUDIOS)
    expect(audios.full.value).toBe(true)
  })

  it('обложка — у первой записи; порядок поменяли — картинка уходит новой первой', async () => {
    const { upload, started } = manualUpload()
    const saveCover = vi.fn(async () => {})
    const { audios } = setup({ upload, saveCover: saveCover as never })
    audios.add([mp3('1.mp3'), mp3('2.mp3')])
    audios.setCover(new Blob(['x'], { type: 'image/jpeg' }), 'image')
    expect(saveCover).not.toHaveBeenCalled()
    await started[0]!.done('u1')
    expect(saveCover).toHaveBeenLastCalledWith(
      expect.objectContaining({ host: 'pt.example', uuid: 'u1' })
    )
    await started[1]!.done('u2')
    audios.move(1, 0)
    await nextTick()
    await flush()
    expect(saveCover).toHaveBeenLastCalledWith(expect.objectContaining({ uuid: 'u2' }))
  })

  it('заголовок поста — от первой записи, когда она загрузилась', async () => {
    const { upload, started } = manualUpload()
    const { audios, options } = setup({ upload })
    audios.add([mp3('Песня.mp3'), mp3('Ещё.mp3')])
    await started[0]!.done('u1')
    expect(options.onFirstUploaded).toHaveBeenCalledTimes(1)
    await started[1]!.done('u2')
    expect(options.onFirstUploaded).toHaveBeenCalledTimes(1)
  })

  it('не вошёл — вход, файлы не берутся', () => {
    const { upload, started } = manualUpload()
    const { audios, options } = setup({ upload, getAuth: () => null })
    audios.add([mp3('1.mp3')])
    expect(options.onAuthRequired).toHaveBeenCalled()
    expect(audios.items.value).toEqual([])
    expect(started).toHaveLength(0)
  })

  it('черновик и правка: записи уже на сервере, можно добавить ещё', async () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.restore([
      { url: 'peertube://pt.example/u1/audio', title: 'Глава 1', duration: 60 },
      { url: 'peertube://pt.example/u2/audio', title: '', duration: null },
    ])
    expect(audios.busy.value).toBe(false)
    expect(audios.cover.value).toBeNull()
    audios.add([mp3('Глава 3.mp3')])
    await started[0]!.done('u3')
    expect(audios.uploaded.value.map((x) => x.url.split('/')[3])).toEqual(['u1', 'u2', 'u3'])
  })

  it('окно закрыли — загрузка обрывается', () => {
    const { upload, started } = manualUpload()
    const { audios } = setup({ upload })
    audios.add([mp3('1.mp3')])
    scope.stop()
    expect(started[0]!.params.signal?.aborted).toBe(true)
    expect(audios.items.value).toEqual([])
  })
})

describe('asAudioFile', () => {
  it('звук по типу; без типа — по расширению, с типом; видео и картинка — нет', () => {
    const file = mp3('a.mp3')
    expect(asAudioFile(file)).toBe(file)
    const flac = asAudioFile(new File(['x'], 'Глава 1.FLAC'))!
    expect(flac.type).toBe('audio/flac')
    expect(flac.name).toBe('Глава 1.FLAC')
    expect(asAudioFile(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBeNull()
    expect(asAudioFile(new File(['x'], 'a.ogg', { type: 'video/ogg' }))).toBeNull()
    expect(asAudioFile(new File(['x'], 'a.mkv'))).toBeNull()
    expect(asAudioFile(new File(['x'], 'mp3'))).toBeNull()
  })
})
