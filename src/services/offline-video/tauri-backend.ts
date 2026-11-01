// Компьютер: команды `offline_*` и события `offline://*` (src-tauri/src/offline).
// Файлы — по своей схеме `bastyon-offline://localhost/<id>/<файл>` (на Windows
// `http://bastyon-offline.localhost/…`): Rust отдаёт их по id с Range.

import type {
  OfflineBackend,
  OfflineChanged,
  OfflineItem,
  OfflineLocation,
  OfflineMoving,
  OfflineProgress,
  OfflineUsage,
} from './types'

const SCHEME = 'bastyon-offline'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

async function listen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<T>(event, (e) => cb(e.payload))
}

export const tauriBackend: OfflineBackend = {
  kind: 'tauri',
  list: () => call<OfflineItem[]>('offline_list'),
  enqueue: (job, meta) => call<OfflineItem>('offline_enqueue', { job, meta }),
  pause: (id) => call('offline_pause', { id }),
  resume: (id) => call('offline_resume', { id }),
  remove: (id) => call('offline_remove', { id }),
  patchMeta: (id, patch) => call<OfflineItem>('offline_patch_meta', { id, patch }),
  usage: () => call<OfflineUsage>('offline_usage'),
  clear: () => call('offline_clear'),
  async fileUrl(id, file) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(`${id}/${file}`, SCHEME)
  },
  location: () => call<OfflineLocation>('offline_location'),
  moveTo: (to) => call<OfflineLocation>('offline_move', { to }),
  onMoving: (cb) => listen<OfflineMoving>('offline://moving', cb),
  onProgress: (cb) => listen<OfflineProgress>('offline://progress', cb),
  onChanged: (cb) => listen<OfflineChanged>('offline://changed', cb),
}
