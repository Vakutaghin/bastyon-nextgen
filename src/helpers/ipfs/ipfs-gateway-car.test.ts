// Сетевой слой проверенного скачивания: какой запрос уходит на шлюз и как
// разбираются его ответы. Сам разбор CAR — в ipfs-verify.test.ts.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { appFetch } = vi.hoisted(() => ({ appFetch: vi.fn() }))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch }))

import { carUrl, fetchVerifiedEntity, inspectEntity, pathSegments } from './ipfs-gateway-car'
import { GatewayError, TransportError, VerifyError } from './ipfs-errors'
import type { Entity } from './ipfs-verify'
import type { IpfsTarget } from './ipfs-link'

const DEEP_V1 = 'bafybeib6r2qk4qrwf3f4otzo5qiyac7mfoqq2m4oyfy5ml6icssb52dul4'
const SITE_V1 = 'bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e'
const CAR_TYPE = 'application/vnd.ipld.car; version=1; order=dfs; dups=y'

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'src-tauri/src/ipfs/testdata', name)))
}

function carResponse(bytes: Uint8Array, type = CAR_TYPE, pieces = 3): Response {
  const step = Math.ceil(bytes.length / pieces)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += step) controller.enqueue(bytes.slice(i, i + step))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': type } })
}

async function bytesOf(entity: Entity): Promise<number[]> {
  if (entity.kind !== 'file') throw new Error('not a file')
  const out: number[] = []
  for await (const chunk of entity.chunks) out.push(...chunk)
  return out
}

const opts = { maxBytes: 1 << 20, maxReorderBytes: 1 << 20 }
const site = (path: string): IpfsTarget => ({ namespace: 'ipfs', root: SITE_V1, path })

beforeEach(() => {
  appFetch.mockReset()
})

describe('запрос к шлюзу', () => {
  it('CAR с trustless-шлюза: только сущность, порядок обхода, с повторами', () => {
    expect(carUrl('bafyroot', ['docs', 'my file.pdf'])).toBe(
      'https://trustless-gateway.link/ipfs/bafyroot/docs/my%20file.pdf' +
        '?format=car&dag-scope=entity&car-version=1&car-order=dfs&car-dups=y'
    )
    expect(carUrl('bafyroot', [])).toBe(
      'https://trustless-gateway.link/ipfs/bafyroot?format=car&dag-scope=entity&car-version=1&car-order=dfs&car-dups=y'
    )
  })

  it('путь из ссылки раскодируется, опасные сегменты отвергаются', () => {
    expect(pathSegments('docs/my%20file.pdf')).toEqual(['docs', 'my file.pdf'])
    expect(pathSegments('')).toEqual([])
    for (const bad of ['a/%2e%2e', 'a%2Fb', 'a%5Cb', 'x%0Ay', '%E0%A4%A']) {
      expect(() => pathSegments(bad), bad).toThrow(VerifyError)
    }
  })

  it('корень уходит в каноническом виде, IPNS не запрашивается', async () => {
    appFetch.mockResolvedValue(carResponse(fixture('site-v1.car')))
    await fetchVerifiedEntity(site('index.html'), opts)
    expect(appFetch.mock.calls[0]?.[0]).toBe(carUrl(SITE_V1, ['index.html']))

    await expect(
      fetchVerifiedEntity({ namespace: 'ipns', root: 'example.org', path: '' }, opts)
    ).rejects.toMatchObject({ code: 'unsupported' })
  })
})

describe('ответ шлюза', () => {
  it('файл собирается из CAR, пришедшего кусками', async () => {
    appFetch.mockResolvedValue(carResponse(fixture('site-v1.car')))
    const entity = await fetchVerifiedEntity(site('index.html'), opts)
    expect(new TextDecoder().decode(Uint8Array.from(await bytesOf(entity)))).toBe('<h1>hi</h1>\n')
  })

  it('без order=dfs блоки копятся — в пределах потолка', async () => {
    const car = fixture('deep-v1.car')
    appFetch.mockResolvedValue(carResponse(car, 'application/vnd.ipld.car; version=1'))
    const entity = await fetchVerifiedEntity({ namespace: 'ipfs', root: DEEP_V1, path: '' }, opts)
    expect(await bytesOf(entity)).toHaveLength(6000)
  })

  it('коды ответа: 429 и 504 — ошибка шлюза с кодом', async () => {
    appFetch.mockResolvedValue(new Response('slow down', { status: 429 }))
    await expect(fetchVerifiedEntity(site(''), opts)).rejects.toEqual(new GatewayError(429))
    appFetch.mockResolvedValue(new Response('timeout', { status: 504 }))
    await expect(fetchVerifiedEntity(site(''), opts)).rejects.toMatchObject({ status: 504 })
  })

  it('не CAR (страница ошибки с кодом 200) — не принимается', async () => {
    appFetch.mockResolvedValue(
      new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    )
    await expect(fetchVerifiedEntity(site(''), opts)).rejects.toMatchObject({ code: 'unsupported' })
    appFetch.mockResolvedValue(carResponse(new TextEncoder().encode('<html>504</html>')))
    await expect(fetchVerifiedEntity(site(''), opts)).rejects.toMatchObject({ code: 'malformed' })
  })

  it('сбой сети — ошибка связи, а не «испорченный файл»', async () => {
    appFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchVerifiedEntity(site(''), opts)).rejects.toBeInstanceOf(TransportError)
  })

  it('шлюз замолчал на минуту — обрыв с причиной «тишина»', async () => {
    vi.useFakeTimers()
    try {
      appFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          )
      )
      const pending = fetchVerifiedEntity(site(''), opts)
      const check = expect(pending).rejects.toMatchObject({ reason: 'timeout' })
      await vi.advanceTimersByTimeAsync(60_000)
      await check
    } finally {
      vi.useRealTimers()
    }
  })

  it('отмена пользователем проходит как AbortError', async () => {
    const controller = new AbortController()
    appFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    )
    const pending = fetchVerifiedEntity(site(''), { ...opts, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('inspectEntity', () => {
  it('каталог — без данных; файл — размер и первые байты', async () => {
    appFetch.mockResolvedValue(carResponse(fixture('site-v1.car')))
    expect(await inspectEntity(site(''), new AbortController().signal)).toEqual({
      kind: 'directory',
    })
    appFetch.mockResolvedValue(carResponse(fixture('site-v1.car')))
    const info = await inspectEntity(site('assets/app.js'), new AbortController().signal)
    expect(info).toMatchObject({ kind: 'file', size: 3000 })
    if (info.kind === 'file') expect(info.head.length).toBeLessThanOrEqual(512)
  })
})
