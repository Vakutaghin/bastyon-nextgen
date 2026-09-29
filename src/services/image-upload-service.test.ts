import { describe, it, expect, vi, beforeEach } from 'vitest'

const { instanceFetch, resolveHost, resolveHosts } = vi.hoisted(() => ({
  instanceFetch: vi.fn(),
  resolveHost: vi.fn(),
  resolveHosts: vi.fn(),
}))

vi.mock('@/services/peertube/peertube-host', () => ({
  resolvePeertubeHost: resolveHost,
  resolvePeertubeHosts: resolveHosts,
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
  withHttpsScheme,
  dataUrlToBlob,
  peertubeImageProvider,
  resetImageUploadSessionForTests,
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
  resolveHosts.mockResolvedValue(['host.app'])
  resetImageUploadSessionForTests()
})

describe('withHttpsScheme', () => {
  it('оставляет http/https как есть; достраивает https для бессхемного', () => {
    expect(withHttpsScheme('https://x/y.jpg')).toBe('https://x/y.jpg')
    expect(withHttpsScheme('http://x/y.jpg')).toBe('http://x/y.jpg')
    expect(withHttpsScheme('cdn.x/y.jpg')).toBe('https://cdn.x/y.jpg')
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
      if (path === 'api/v1/oauth-clients/local')
        return jsonRes({ client_id: 'c', client_secret: 's' })
      if (path === 'api/v1/users/token') return jsonRes({ access_token: 'T' })
      return jsonRes({}, 404)
    })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_404')
  })

  it('нет url в ответе → peertube_upload_no_url', async () => {
    instanceFetch.mockImplementation(async (_host: string, path: string) => {
      if (path === 'api/v1/oauth-clients/local')
        return jsonRes({ client_id: 'c', client_secret: 's' })
      if (path === 'api/v1/users/token') return jsonRes({ access_token: 'T' })
      if (path === 'api/v1/images/upload') return jsonRes({})
      return jsonRes({}, 404)
    })
    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_upload_no_url')
  })
})

/**
 * Инстансы загрузки: host → ответ users/token (код ошибки или токен со сроком)
 * и ответы images/upload по очереди (код ошибки или url).
 */
function instances(
  spec: Record<string, { token: number | string; ttl?: number; upload?: Array<number | string> }>
): void {
  const uploads = new Map<string, number>()
  instanceFetch.mockImplementation(async (host: string, path: string) => {
    const s = spec[host]
    if (!s) return jsonRes({}, 404)
    if (path === 'api/v1/oauth-clients/local')
      return jsonRes({ client_id: 'c', client_secret: 's' })
    if (path === 'api/v1/users/token') {
      if (typeof s.token === 'number') return jsonRes({ code: 'invalid_grant' }, s.token)
      return jsonRes({ access_token: s.token, expires_in: s.ttl ?? 86399 })
    }
    if (path === 'api/v1/images/upload') {
      const n = uploads.get(host) ?? 0
      uploads.set(host, n + 1)
      const answers = s.upload ?? [`${host}/img.jpg`]
      const answer = answers[Math.min(n, answers.length - 1)]!
      return typeof answer === 'number' ? jsonRes({}, answer) : jsonRes({ url: answer })
    }
    return jsonRes({}, 404)
  })
}

/** На какие хосты уходили запросы к этому эндпоинту. */
const hostsOf = (path: string): string[] =>
  instanceFetch.mock.calls.filter((c) => c[1] === path).map((c) => c[0] as string)

describe('peertubeImageProvider: хост без общего аккаунта', () => {
  it('нода выбрала хост, где test_bastyon нет (400) → берётся следующий хост загрузки', async () => {
    resolveHost.mockResolvedValue('pt1000')
    resolveHosts.mockResolvedValue(['pt101', 'pt1000'])
    instances({ pt1000: { token: 400 }, pt101: { token: 'T101' } })

    await expect(peertubeImageProvider.upload(DATA_URL)).resolves.toBe('https://pt101/img.jpg')
    expect(hostsOf('api/v1/users/token')).toEqual(['pt1000', 'pt101'])
    const upload = instanceFetch.mock.calls.find((c) => c[1] === 'api/v1/images/upload')!
    expect(upload[0]).toBe('pt101')
    expect(((upload[2] as RequestInit).headers as Record<string, string>).Authorization).toBe(
      'Bearer T101'
    )
  })

  it('следующей картинке не нужны ни выбор хоста, ни новый токен', async () => {
    resolveHost.mockResolvedValue('pt1000')
    resolveHosts.mockResolvedValue(['pt101', 'pt1000'])
    instances({ pt1000: { token: 400 }, pt101: { token: 'T101' } })
    await peertubeImageProvider.upload(DATA_URL)
    vi.clearAllMocks()

    await expect(peertubeImageProvider.upload(DATA_URL)).resolves.toBe('https://pt101/img.jpg')
    expect(resolveHost).not.toHaveBeenCalled()
    expect(resolveHosts).not.toHaveBeenCalled()
    expect(hostsOf('api/v1/users/token')).toEqual([])
    expect(hostsOf('api/v1/images/upload')).toEqual(['pt101'])
  })

  it('истёкший токен запрашивается заново, и сработавший хост пробуется первым', async () => {
    resolveHost.mockResolvedValue('pt1000')
    resolveHosts.mockResolvedValue(['pt1000', 'pt101'])
    instances({ pt1000: { token: 400 }, pt101: { token: 'T', ttl: 0 } })
    await peertubeImageProvider.upload(DATA_URL)
    vi.clearAllMocks()

    await peertubeImageProvider.upload(DATA_URL)
    expect(hostsOf('api/v1/users/token')).toEqual(['pt101'])
  })

  it('401 на загрузке → новый токен того же хоста и ещё одна попытка', async () => {
    instances({ 'host.app': { token: 'T', upload: [401, 'host.app/ok.jpg'] } })

    await expect(peertubeImageProvider.upload(DATA_URL)).resolves.toBe('https://host.app/ok.jpg')
    expect(hostsOf('api/v1/users/token')).toEqual(['host.app', 'host.app'])
    expect(hostsOf('api/v1/images/upload')).toHaveLength(2)
  })

  it('ни один хост не выдал токен → ошибка последнего', async () => {
    resolveHost.mockResolvedValue('a')
    resolveHosts.mockResolvedValue(['a', 'b'])
    instances({ a: { token: 400 }, b: { token: 400 } })

    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_image_token_400')
    expect(hostsOf('api/v1/users/token')).toEqual(['a', 'b'])
  })

  it('нода не назвала ни одного хоста → peertube_no_host', async () => {
    resolveHost.mockRejectedValue(new Error('peertube_no_host'))
    resolveHosts.mockRejectedValue(new Error('network'))

    await expect(peertubeImageProvider.upload(DATA_URL)).rejects.toThrow('peertube_no_host')
    expect(instanceFetch).not.toHaveBeenCalled()
  })

  it('peertube/best не ответил → хватает хостов из peertube/roys', async () => {
    resolveHost.mockRejectedValue(new Error('timeout'))
    resolveHosts.mockResolvedValue(['pt101'])
    instances({ pt101: { token: 'T' } })

    await expect(peertubeImageProvider.upload(DATA_URL)).resolves.toBe('https://pt101/img.jpg')
  })
})
