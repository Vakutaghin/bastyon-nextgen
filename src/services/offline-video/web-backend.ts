// Веб: очередь и загрузка — в воркере (web-worker.ts), файлы — в OPFS
// `offline/<id>/…`. Страница говорит с ним запросами (`rid` → ответ) и
// слушает события `progress` (не чаще 4 раз в секунду) и `changed`.
//
// - Воркер заводится при первом обращении: стор при старте подписывается и
//   читает список — тогда же продолжается то, что качалось при закрытии вкладки.
// - Файл отдаётся адресом `blob:` от `File` из OPFS: браузер читает его с
//   диска по мере надобности, в память целиком не грузит. Адрес держится,
//   пока ролик не удалён.
// - Tor, «только по Wi-Fi» и суточная квота Android здесь не бывают.

import type { Policy } from './download-core'
import type {
  OfflineBackend,
  OfflineChanged,
  OfflineFile,
  OfflineItem,
  OfflineProgress,
  OfflineUsage,
} from './types'
import type { WorkerCall, WorkerMessage } from './web-worker'

/** Что нужно от воркера; в тестах — подменный. */
export interface WorkerLike {
  postMessage(message: unknown): void
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  terminate(): void
}

export interface WebOfflineBackend extends OfflineBackend {
  readonly kind: 'web'
  /** Для проверок: куски поменьше, повторы быстрее. */
  setPolicy(policy: Partial<Policy>): Promise<void>
}

function mime(file: OfflineFile): string {
  if (file.endsWith('.mp4')) return 'video/mp4'
  if (file.endsWith('.jpg')) return 'image/jpeg'
  if (file.endsWith('.vtt')) return 'text/vtt'
  return 'application/octet-stream'
}

/** Как через JSON у Tauri: без Proxy от Vue (их не передать воркеру), без undefined. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createWebBackend(spawn: () => WorkerLike): WebOfflineBackend {
  let worker: WorkerLike | null = null
  let nextRid = 1
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  const progressListeners = new Set<(p: OfflineProgress) => void>()
  const changedListeners = new Set<(e: OfflineChanged) => void>()
  /** `<id>/<файл>` → адрес `blob:`. */
  const urls = new Map<string, Promise<string>>()
  let persistAsked = false

  function forget(id: string | null): void {
    for (const [key, url] of [...urls]) {
      if (id !== null && !key.startsWith(`${id}/`)) continue
      urls.delete(key)
      void url.then((u) => URL.revokeObjectURL(u)).catch(() => {})
    }
  }

  function notify<T>(listeners: Set<(v: T) => void>, value: T): void {
    for (const cb of [...listeners]) {
      try {
        cb(value)
      } catch {
        /* чужой обработчик не мешает остальным */
      }
    }
  }

  function onMessage(message: WorkerMessage): void {
    if ('rid' in message) {
      const call = pending.get(message.rid)
      if (!call) return
      pending.delete(message.rid)
      if (message.ok) call.resolve(message.value)
      else call.reject(new Error(message.error))
      return
    }
    if (message.event === 'progress') notify(progressListeners, message.data)
    else if (message.event === 'changed') {
      if (!message.data.item) forget(message.data.id)
      notify(changedListeners, message.data)
    }
  }

  function ensure(): WorkerLike {
    if (worker) return worker
    const w = spawn()
    w.onmessage = (e) => onMessage(e.data as WorkerMessage)
    // Воркер не загрузился (или упал) — ответов не будет; следующий вызов заведёт новый.
    w.onerror = () => {
      if (worker !== w) return
      worker = null
      w.terminate()
      for (const call of pending.values()) call.reject(new Error('offline_worker_failed'))
      pending.clear()
    }
    worker = w
    return w
  }

  function call<T>(message: WorkerCall): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const rid = nextRid++
      try {
        const w = ensure()
        pending.set(rid, { resolve: resolve as (v: unknown) => void, reject })
        w.postMessage({ ...message, rid })
      } catch (e) {
        pending.delete(rid)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  function askPersist(): void {
    if (persistAsked) return
    persistAsked = true
    try {
      // Без этого браузер может стереть скачанное, когда места мало. Ответ не важен.
      void navigator.storage?.persist?.().catch(() => {})
    } catch {
      /* нет StorageManager — живём как есть */
    }
  }

  return {
    kind: 'web',
    list: () => call<OfflineItem[]>({ op: 'list' }),
    enqueue(job, meta) {
      askPersist()
      return call<OfflineItem>({ op: 'enqueue', job: plain(job), meta: plain(meta) })
    },
    pause: (id) => call<void>({ op: 'pause', id }),
    resume: (id) => call<void>({ op: 'resume', id }),
    async remove(id) {
      await call<void>({ op: 'remove', id })
      forget(id)
    },
    patchMeta: (id, patch) =>
      call<OfflineItem>({ op: 'patchMeta', id, patch: plain(patch) as Record<string, unknown> }),
    usage: () => call<OfflineUsage>({ op: 'usage' }),
    async clear() {
      await call<void>({ op: 'clear' })
      forget(null)
    },
    fileUrl(id, file) {
      const key = `${id}/${file}`
      let url = urls.get(key)
      if (!url) {
        url = call<Blob>({ op: 'file', id, file }).then((blob) =>
          // Тип для `<video>`: у файла из OPFS его нет. Срез — та же запись на диске.
          URL.createObjectURL(blob.slice(0, blob.size, mime(file)))
        )
        urls.set(key, url)
        url.catch(() => {
          if (urls.get(key) === url) urls.delete(key)
        })
      }
      return url
    },
    async onProgress(cb) {
      ensure()
      progressListeners.add(cb)
      return () => progressListeners.delete(cb)
    },
    async onChanged(cb) {
      ensure()
      changedListeners.add(cb)
      return () => changedListeners.delete(cb)
    },
    setPolicy: (policy) => call<void>({ op: 'policy', policy }),
  }
}

export const webBackend: WebOfflineBackend = createWebBackend(
  () =>
    new Worker(new URL('./web-worker.ts', import.meta.url), {
      type: 'module',
      name: 'bastyon-offline',
    })
)
