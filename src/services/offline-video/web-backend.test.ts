// Страница ↔ воркер: запросы по rid, ошибки кодами, события, адреса blob:
// (один на файл, отзываются при удалении), persist() при первой загрузке.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OfflineChanged, OfflineItem, OfflineJob, OfflineMeta } from './types'
import { createWebBackend, type WorkerLike } from './web-backend'
import type { WorkerMessage, WorkerRequest } from './web-worker'

class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  sent: WorkerRequest[] = []
  terminated = false

  postMessage(message: unknown): void {
    // Как structured clone: Proxy и функции сюда не доходят.
    this.sent.push(structuredClone(message) as WorkerRequest)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: WorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  reply(index: number, value: unknown): void {
    const req = this.sent[index]
    if (!req) throw new Error(`no request #${index}`)
    this.emit({ rid: req.rid, ok: true, value })
  }

  fail(index: number, error: string): void {
    const req = this.sent[index]
    if (!req) throw new Error(`no request #${index}`)
    this.emit({ rid: req.rid, ok: false, error })
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

const job: OfflineJob = {
  id: 'u-360',
  sources: ['https://a.test/v.mp4'],
  fileName: 'v.mp4',
  sha256Urls: [],
  extras: [],
  size: 10,
}

const meta = {
  id: 'u-360',
  peertubeUrl: 'peertube://a.test/u',
  kind: 'video',
  uuid: 'u',
  title: 't',
  author: { address: 'x' },
  height: 360,
  size: 10,
  createdAt: 1,
  accounts: ['x'],
} as OfflineMeta

const item = { id: 'u-360', meta, state: { status: 'done', received: 10, total: 10 } }

describe('webBackend', () => {
  let workers: FakeWorker[]
  let created: string[]
  let revoked: string[]
  let persist: ReturnType<typeof vi.fn>

  beforeEach(() => {
    workers = []
    created = []
    revoked = []
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:test/${++n}`
      created.push(`${url} ${(blob as Blob).type}`)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url)
    })
    persist = vi.fn(() => Promise.resolve(true))
    Object.defineProperty(navigator, 'storage', {
      value: { persist },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function backend() {
    return createWebBackend(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
  }

  it('воркер заводится при первом обращении, ответы — по rid', async () => {
    const b = backend()
    expect(workers).toHaveLength(0)
    const list = b.list()
    const usage = b.usage()
    const w = workers[0] as FakeWorker
    expect(w.sent.map((r) => r.op)).toEqual(['list', 'usage'])
    expect(w.sent[0]?.rid).not.toBe(w.sent[1]?.rid)
    // Ответы в обратном порядке — каждый своему.
    w.reply(1, { used: 5, free: null })
    w.reply(0, [item])
    await expect(list).resolves.toEqual([item])
    await expect(usage).resolves.toEqual({ used: 5, free: null })
    expect(workers).toHaveLength(1)
  })

  it('ошибка воркера — Error с кодом', async () => {
    const b = backend()
    const p = b.resume('u-360')
    ;(workers[0] as FakeWorker).fail(0, 'not_found')
    await expect(p).rejects.toThrow('not_found')
  })

  it('enqueue: persist() один раз, задание — простым объектом', async () => {
    const b = backend()
    const reactiveLike = new Proxy({ ...job }, {})
    const p1 = b.enqueue(reactiveLike, meta)
    const p2 = b.enqueue({ ...job, id: 'w-144' }, { ...meta, id: 'w-144' })
    const w = workers[0] as FakeWorker
    expect(persist).toHaveBeenCalledTimes(1)
    expect(w.sent[0]).toMatchObject({ op: 'enqueue', job, meta })
    w.reply(0, item)
    w.reply(1, { ...item, id: 'w-144' })
    await expect(p1).resolves.toEqual(item)
    await p2
  })

  it('patchMeta передаёт null (убрать поле)', async () => {
    const b = backend()
    void b.patchMeta('u-360', { authorDeleted: null, accounts: ['x', 'y'] })
    expect((workers[0] as FakeWorker).sent[0]).toMatchObject({
      op: 'patchMeta',
      id: 'u-360',
      patch: { authorDeleted: null, accounts: ['x', 'y'] },
    })
  })

  it('события расходятся подписчикам, отписка работает', async () => {
    const b = backend()
    const progress: unknown[] = []
    const changed: OfflineChanged[] = []
    const offProgress = await b.onProgress((p) => progress.push(p))
    await b.onChanged((e) => changed.push(e))
    const w = workers[0] as FakeWorker
    w.emit({ event: 'progress', data: { id: 'u-360', received: 1, total: 10 } })
    w.emit({ event: 'changed', data: { id: 'u-360', item: item as OfflineItem } })
    offProgress()
    w.emit({ event: 'progress', data: { id: 'u-360', received: 2, total: 10 } })
    expect(progress).toEqual([{ id: 'u-360', received: 1, total: 10 }])
    expect(changed).toEqual([{ id: 'u-360', item }])
  })

  it('fileUrl: blob: с типом, один на файл, отзывается при удалении', async () => {
    const b = backend()
    const first = b.fileUrl('u-360', 'video.mp4')
    const second = b.fileUrl('u-360', 'video.mp4')
    const w = workers[0] as FakeWorker
    // Второй запрос воркеру не ушёл.
    expect(w.sent.filter((r) => r.op === 'file')).toHaveLength(1)
    w.reply(0, new Blob(['0123456789']))
    expect(await first).toBe('blob:test/1')
    expect(await second).toBe('blob:test/1')
    expect(created).toEqual(['blob:test/1 video/mp4'])

    const thumb = b.fileUrl('u-360', 'thumb.jpg')
    w.reply(1, new Blob(['jpg']))
    expect(await thumb).toBe('blob:test/2')
    expect(created[1]).toBe('blob:test/2 image/jpeg')

    const removing = b.remove('u-360')
    w.reply(2, null)
    await removing
    await tick()
    expect(revoked.sort()).toEqual(['blob:test/1', 'blob:test/2'])
    // После удаления — снова к воркеру.
    void b.fileUrl('u-360', 'video.mp4')
    expect(w.sent[3]).toMatchObject({ op: 'file', id: 'u-360', file: 'video.mp4' })
  })

  it('fileUrl: отказ не запоминается; удаление из другой вкладки отзывает адрес', async () => {
    const b = backend()
    const missing = b.fileUrl('u-360', 'video.mp4')
    const w = workers[0] as FakeWorker
    w.fail(0, 'not_found')
    await expect(missing).rejects.toThrow('not_found')
    await tick()
    const again = b.fileUrl('u-360', 'video.mp4')
    w.reply(1, new Blob(['x']))
    await expect(again).resolves.toBe('blob:test/1')
    w.emit({ event: 'changed', data: { id: 'u-360', item: null } })
    await tick()
    expect(revoked).toEqual(['blob:test/1'])
  })

  it('воркер не загрузился — ждущие запросы отказывают, следующий заводит новый', async () => {
    const b = backend()
    const p = b.list()
    const w = workers[0] as FakeWorker
    w.onerror?.(new Event('error'))
    await expect(p).rejects.toThrow('offline_worker_failed')
    expect(w.terminated).toBe(true)
    void b.list()
    expect(workers).toHaveLength(2)
  })
})
