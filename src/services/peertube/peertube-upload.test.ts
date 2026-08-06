import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  uploadVideoResumable,
  initResumableUpload,
  parseUploadId,
  resumableStorageKey,
  type UploadMetadata,
} from './peertube-upload'
import type { InstanceFetch } from './peertube-instance'

const META: UploadMetadata = { channelId: 7, name: 'clip' }

/** Response с заголовками (204/308 требуют null-тело). */
const res = (status: number, body?: unknown, headers?: Record<string, string>): Response =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers })

const doneBody = (uuid = 'UUID', extra: Record<string, unknown> = {}): unknown => ({
  video: { uuid, ...extra },
})

/** Файл заданного размера (нулевые байты). */
const makeFile = (size: number, type = 'video/mp4', name = 'v.mp4'): File =>
  new File([new Uint8Array(size)], name, { type })

/** Мгновенный sleep — backoff не тормозит тесты. */
const noSleep = (): Promise<void> => Promise.resolve()

function memStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
})

describe('parseUploadId', () => {
  it('достаёт upload_id из абсолютного/относительного/безсхемного Location', () => {
    expect(parseUploadId('https://h/api/v1/videos/upload-resumable?upload_id=ABC')).toBe('ABC')
    expect(parseUploadId('/api/v1/videos/upload-resumable?upload_id=DEF')).toBe('DEF')
    expect(parseUploadId('h/api/v1/videos/upload-resumable?upload_id=GHI')).toBe('GHI')
    expect(parseUploadId(null)).toBeNull()
    expect(parseUploadId('no-query-here')).toBeNull()
  })
})

describe('initResumableUpload', () => {
  it('201 → upload_id из Location; уходят Bearer и X-Upload-Content-Length', async () => {
    const fetchInstance = vi.fn(async () =>
      res(201, {}, { Location: 'https://h/x?upload_id=UP1' })
    ) as unknown as InstanceFetch & { mock: { calls: unknown[][] } }

    const id = await initResumableUpload({
      fetchInstance,
      accessToken: 'AT',
      size: 12345,
      contentType: 'video/mp4',
      metadata: META,
      now: () => 0,
    })
    expect(id).toBe('UP1')

    const init = (fetchInstance.mock.calls[0]?.[1] ?? {}) as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer AT')
    expect(headers['X-Upload-Content-Length']).toBe('12345')
    expect(headers['X-Upload-Content-Type']).toBe('video/mp4')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('413 → too_large, 415 → unsupported_type', async () => {
    await expect(
      initResumableUpload({
        fetchInstance: (async () => res(413)) as InstanceFetch,
        accessToken: 'AT',
        size: 1,
        contentType: 'video/mp4',
        metadata: META,
      })
    ).rejects.toMatchObject({ message: 'peertube_upload_too_large', status: 413 })

    await expect(
      initResumableUpload({
        fetchInstance: (async () => res(415)) as InstanceFetch,
        accessToken: 'AT',
        size: 1,
        contentType: 'application/zip',
        metadata: META,
      })
    ).rejects.toMatchObject({ message: 'peertube_upload_unsupported_type', status: 415 })
  })

  it('нет Location (вероятно CORS) → peertube_no_location', async () => {
    await expect(
      initResumableUpload({
        fetchInstance: (async () => res(201, {})) as InstanceFetch,
        accessToken: 'AT',
        size: 1,
        contentType: 'video/mp4',
        metadata: META,
      })
    ).rejects.toThrow('peertube_no_location')
  })
})

describe('uploadVideoResumable — happy path', () => {
  it('чанки выровнены по 256, финал 200 → uuid + истинный host; прогресс до 100; state очищен', async () => {
    // 700 байт при чанке 256 → 256 / 256 / 188(последний)
    const ranges: string[] = []
    let putCount = 0
    const fetchInstance = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res(201, {}, { Location: 'h/x?upload_id=UP' })
      if (init?.method === 'PUT') {
        putCount += 1
        ranges.push((init.headers as Record<string, string>)['Content-Range'] ?? '')
        // третий (последний) PUT завершает загрузку
        if (putCount === 3) {
          return res(
            200,
            doneBody('VID', { isAudio: false, videoCreated: { url: 'https://true.host/w/x' } })
          )
        }
        return res(308)
      }
      return res(404)
    }) as unknown as InstanceFetch

    const progress: number[] = []
    const result = await uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(700),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      now: () => 1000,
      sleep: noSleep,
      onProgress: (p) => progress.push(p.percent),
    })

    expect(result).toEqual({ host: 'true.host', uuid: 'VID', isAudio: false })
    expect(ranges).toEqual(['bytes 0-255/700', 'bytes 256-511/700', 'bytes 512-699/700'])
    expect(progress[progress.length - 1]).toBe(100)
    // resume-state вычищен после успеха
    expect(localStorage.getItem(resumableStorageKey('h', 'ADDR', 'VK'))).toBeNull()
  })

  it('фолбэк на исходный host, если videoCreated.url отсутствует', async () => {
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res(201, {}, { Location: 'h/x?upload_id=UP' })
      return res(200, doneBody('VID', { isAudio: true }))
    }) as InstanceFetch

    const result = await uploadVideoResumable({
      host: 'orig.host',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(100),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      sleep: noSleep,
    })
    expect(result).toEqual({ host: 'orig.host', uuid: 'VID', isAudio: true })
  })
})

describe('uploadVideoResumable — resume / reinit', () => {
  it('валидный resume-state → init пропускается, продолжаем с resumeFrom', async () => {
    localStorage.setItem(
      resumableStorageKey('h', 'ADDR', 'VK'),
      JSON.stringify({ uploadHost: 'h', uploadId: 'CACHED', resumeFrom: 256, lastOperation: 1000 })
    )

    let posted = false
    const seenUploadIds: string[] = []
    const fetchInstance = (async (path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted = true
        return res(201, {}, { Location: 'h/x?upload_id=NEW' })
      }
      if (init?.method === 'PUT') {
        seenUploadIds.push(new URL(path, 'http://x').searchParams.get('upload_id') ?? '')
        return res(200, doneBody('VID'))
      }
      return res(404)
    }) as InstanceFetch

    const result = await uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(512),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      now: () => 1500,
      sleep: noSleep,
    })

    expect(posted).toBe(false) // init не звался
    expect(seenUploadIds).toEqual(['CACHED']) // ровно один (последний) чанк
    expect(result.uuid).toBe('VID')
  })

  it('протухший resume-state (>12ч) игнорируется → полный init', async () => {
    localStorage.setItem(
      resumableStorageKey('h', 'ADDR', 'VK'),
      JSON.stringify({ uploadHost: 'h', uploadId: 'OLD', resumeFrom: 0, lastOperation: 0 })
    )
    let posted = false
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted = true
        return res(201, {}, { Location: 'h/x?upload_id=FRESH' })
      }
      return res(200, doneBody('VID'))
    }) as InstanceFetch

    await uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(256),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      now: () => 13 * 60 * 60 * 1000, // >12ч от lastOperation=0
      sleep: noSleep,
    })
    expect(posted).toBe(true)
  })

  it('404 на чанке → реинициализация и успешное завершение', async () => {
    let initCount = 0
    let putCount = 0
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        initCount += 1
        return res(201, {}, { Location: `h/x?upload_id=UP${initCount}` })
      }
      if (init?.method === 'PUT') {
        putCount += 1
        if (putCount === 1) return res(404) // первый чанк — upload_id протух на инстансе
        return res(200, doneBody('VID'))
      }
      return res(404)
    }) as InstanceFetch

    const result = await uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(256),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      sleep: noSleep,
    })
    expect(initCount).toBe(2) // был реинит
    expect(result.uuid).toBe('VID')
  })
})

describe('uploadVideoResumable — retry / ошибки', () => {
  it('сетевой сбой PUT → повтор с backoff и успех', async () => {
    let putCount = 0
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res(201, {}, { Location: 'h/x?upload_id=UP' })
      if (init?.method === 'PUT') {
        putCount += 1
        if (putCount === 1) throw new Error('network down')
        return res(200, doneBody('VID'))
      }
      return res(404)
    }) as InstanceFetch

    const result = await uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(256),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      sleep: noSleep,
    })
    expect(putCount).toBe(2)
    expect(result.uuid).toBe('VID')
  })

  it('жёсткая 422 → PeertubeUploadError без повторов, resume-state сохранён', async () => {
    let putCount = 0
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res(201, {}, { Location: 'h/x?upload_id=UP' })
      if (init?.method === 'PUT') {
        putCount += 1
        return res(422)
      }
      return res(404)
    }) as InstanceFetch

    await expect(
      uploadVideoResumable({
        host: 'h',
        address: 'ADDR',
        accessToken: 'AT',
        file: makeFile(256),
        metadata: META,
        videoKey: 'VK',
        chunkSize: 256,
        fetchInstance,
        sleep: noSleep,
      })
    ).rejects.toMatchObject({ status: 422, cancelled: false })
    expect(putCount).toBe(1) // без повторов
    // resume-state НЕ вычищен (можно продолжить позже)
    expect(localStorage.getItem(resumableStorageKey('h', 'ADDR', 'VK'))).not.toBeNull()
  })
})

describe('uploadVideoResumable — отмена', () => {
  it('abort между чанками → DELETE на инстансе, throw cancelled, state вычищен', async () => {
    const controller = new AbortController()
    let deleted = false
    let putCount = 0
    const fetchInstance = (async (_p: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res(201, {}, { Location: 'h/x?upload_id=UP' })
      if (init?.method === 'DELETE') {
        deleted = true
        return res(204)
      }
      if (init?.method === 'PUT') {
        putCount += 1
        return res(308) // всегда «продолжать», чтобы дойти до отмены
      }
      return res(404)
    }) as InstanceFetch

    const promise = uploadVideoResumable({
      host: 'h',
      address: 'ADDR',
      accessToken: 'AT',
      file: makeFile(1024),
      metadata: META,
      videoKey: 'VK',
      chunkSize: 256,
      fetchInstance,
      signal: controller.signal,
      sleep: noSleep,
      onProgress: () => controller.abort(), // прерываем после первого принятого чанка
    })

    await expect(promise).rejects.toMatchObject({
      name: 'PeertubeUploadError',
      cancelled: true,
    })
    expect(deleted).toBe(true)
    expect(putCount).toBeGreaterThanOrEqual(1)
    expect(localStorage.getItem(resumableStorageKey('h', 'ADDR', 'VK'))).toBeNull()
  })

  it('пустой файл → peertube_empty_file до всяких сетевых вызовов', async () => {
    const fetchInstance = vi.fn() as unknown as InstanceFetch
    await expect(
      uploadVideoResumable({
        host: 'h',
        address: 'ADDR',
        accessToken: 'AT',
        file: makeFile(0),
        metadata: META,
        fetchInstance,
        sleep: noSleep,
      })
    ).rejects.toThrow('peertube_empty_file')
    expect(fetchInstance).not.toHaveBeenCalled()
  })
})
