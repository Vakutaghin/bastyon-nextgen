import { describe, it, expect, vi, beforeEach } from 'vitest'

const { instanceFetch, resolveHost } = vi.hoisted(() => ({
  instanceFetch: vi.fn(),
  resolveHost: vi.fn(),
}))

vi.mock('@/services/peertube/peertube-host', () => ({
  resolvePeertubeHost: resolveHost,
}))

vi.mock('@/services/peertube/peertube-instance', () => ({
  peertubeInstanceFetch: instanceFetch,
  serializeForm: (d: Record<string, unknown>) =>
    Object.entries(d)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${v}`)
      .join('&'),
}))

import {
  normalizeImageUrl,
  dataUrlToBlob,
  peertubeImageProvider,
  uploadImage,
  uploadImages,
  type ImageUploadProvider,
} from './image-upload-service'

const DATA_URL = 'data:image/png;base64,AAAA'

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  resolveHost.mockResolvedValue('host.app')
})

describe('normalizeImageUrl', () => {
  it('оставляет http/https как есть; достраивает https для бессхемного', () => {
    expect(normalizeImageUrl('https://x/y.jpg')).toBe('https://x/y.jpg')
    expect(normalizeImageUrl('http://x/y.jpg')).toBe('http://x/y.jpg')
    expect(normalizeImageUrl('cdn.x/y.jpg')).toBe('https://cdn.x/y.jpg')
  })
})

describe('dataUrlToBlob', () => {
  it('извлекает MIME и байты из data-URL', () => {
    const blob = dataUrlToBlob(DATA_URL) // 'AAAA' → 3 нулевых байта
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(3)
  })
})

describe('uploadImage (цепочка провайдеров)', () => {
  const ok: ImageUploadProvider = { name: 'ok', upload: vi.fn(async () => 'https://ok/1.jpg') }
  const fail: ImageUploadProvider = {
    name: 'fail',
    upload: vi.fn(async () => {
      throw new Error('boom')
    }),
  }

  it('не-data:image возвращается как есть (уже URL)', async () => {
    await expect(uploadImage('https://x/y.jpg', [ok])).resolves.toBe('https://x/y.jpg')
    expect(ok.upload).not.toHaveBeenCalled()
  })

  it('возвращает результат первого успешного провайдера', async () => {
    await expect(uploadImage(DATA_URL, [ok])).resolves.toBe('https://ok/1.jpg')
  })

  it('падает на первом → пробует следующий', async () => {
    await expect(uploadImage(DATA_URL, [fail, ok])).resolves.toBe('https://ok/1.jpg')
    expect(fail.upload).toHaveBeenCalled()
    expect(ok.upload).toHaveBeenCalled()
  })

  it('все провайдеры упали → пробрасывает последнюю ошибку', async () => {
    await expect(uploadImage(DATA_URL, [fail])).rejects.toThrow('boom')
  })
})

describe('uploadImages', () => {
  it('сохраняет порядок и пропускает готовые URL', async () => {
    const p: ImageUploadProvider = { name: 'p', upload: vi.fn(async () => 'https://up/x.jpg') }
    const result = await uploadImages([DATA_URL, 'https://existing/y.jpg'], [p])
    expect(result).toEqual(['https://up/x.jpg', 'https://existing/y.jpg'])
  })
})

describe('peertubeImageProvider (реальный контракт)', () => {
  it('резолв хоста → токен (oauth+users/token) → multipart images/upload → нормализованный url', async () => {
    instanceFetch.mockImplementation(async (_host: string, path: string) => {
      if (path === 'api/v1/oauth-clients/local')
        return jsonRes({ client_id: 'cid', client_secret: 'csec' })
      if (path === 'api/v1/users/token') return jsonRes({ access_token: 'IMGTOK' })
      if (path === 'api/v1/images/upload') return jsonRes({ url: 'cdn.host/pic.jpg' })
      return jsonRes({ error: 'not_found' }, 404)
    })

    const url = await peertubeImageProvider.upload(DATA_URL)
    expect(url).toBe('https://cdn.host/pic.jpg')

    // правильный эндпоинт + Bearer + multipart FormData (а НЕ голый /api/v1/ с JSON)
    const uploadCall = instanceFetch.mock.calls.find((c) => c[1] === 'api/v1/images/upload')
    expect(uploadCall).toBeDefined()
    const init = uploadCall![2] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer IMGTOK')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('404 на images/upload → падает с кодом', async () => {
    instanceFetch.mockImplementation(async (_host: string, path: string) => {
      if (path === 'api/v1/oauth-clients/local') return jsonRes({ client_id: 'c', client_secret: 's' })
      if (path === 'api/v1/users/token') return jsonRes({ access_token: 'T' })
      return jsonRes({}, 404)
    })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_404')
  })

  it('нет url в ответе → peertube_upload_no_url', async () => {
    instanceFetch.mockImplementation(async (_host: string, path: string) => {
      if (path === 'api/v1/oauth-clients/local') return jsonRes({ client_id: 'c', client_secret: 's' })
      if (path === 'api/v1/users/token') return jsonRes({ access_token: 'T' })
      if (path === 'api/v1/images/upload') return jsonRes({})
      return jsonRes({}, 404)
    })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_no_url')
  })
})
