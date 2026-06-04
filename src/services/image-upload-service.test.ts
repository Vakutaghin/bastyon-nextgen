import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchHttp: vi.fn(),
  appFetch: vi.fn(),
}))

vi.mock('@/helpers/api/request', () => ({
  fetchHttp: mocks.fetchHttp,
  appFetch: mocks.appFetch,
}))

import {
  normalizeImageUrl,
  peertubeImageProvider,
  uploadImage,
  uploadImages,
  type ImageUploadProvider,
} from './image-upload-service'

const DATA_URL = 'data:image/png;base64,AAAA'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeImageUrl', () => {
  it('оставляет http/https как есть', () => {
    expect(normalizeImageUrl('https://x/y.jpg')).toBe('https://x/y.jpg')
    expect(normalizeImageUrl('http://x/y.jpg')).toBe('http://x/y.jpg')
  })
  it('достраивает https для URL без схемы', () => {
    expect(normalizeImageUrl('cdn.x/y.jpg')).toBe('https://cdn.x/y.jpg')
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

describe('peertubeImageProvider', () => {
  it('резолвит host, постит base64, нормализует url', async () => {
    mocks.fetchHttp.mockResolvedValue({ host: 'pt.example' })
    mocks.appFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'pt.example/static/img/1.jpg' }),
    })

    const url = await peertubeImageProvider.upload(DATA_URL)

    expect(mocks.fetchHttp).toHaveBeenCalledWith({
      path: 'peertube/best',
      data: { type: 'upload' },
    })
    const [calledUrl, init] = mocks.appFetch.mock.calls[0]
    expect(String(calledUrl)).toContain('/api/v1/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ base64: DATA_URL, Action: 'upload' })
    expect(url).toBe('https://pt.example/static/img/1.jpg')
  })

  it('бросает при отсутствии host', async () => {
    mocks.fetchHttp.mockResolvedValue({})
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_no_host')
  })

  it('бросает при не-ok ответе', async () => {
    mocks.fetchHttp.mockResolvedValue({ host: 'pt.example' })
    mocks.appFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_500')
  })

  it('бросает при отсутствии url в ответе', async () => {
    mocks.fetchHttp.mockResolvedValue({ host: 'pt.example' })
    mocks.appFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_no_url')
  })
})
