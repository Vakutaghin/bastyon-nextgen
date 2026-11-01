// Android: плагин OfflineVideo (android/app/src/main/java/com/bastyon/app/plugins/offline).
// Качает и ведёт список служба переднего плана, страница только читает и
// подписана на события `progress` и `changed` — те же, что `offline://*` у
// компьютера. Файлы — по адресу `https://localhost/_offline_/<id>/<файл>`:
// его отвечает свой перехват WebView с честным Range (перемотка, файлы > 2 ГБ),
// путей к файлам странице не видно. Фоновому звуку (ExoPlayer) — `file://`.
// Ошибки плагина — код в `message` и `code`: `invalid_id`, `not_found`, …

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type {
  OfflineBackend,
  OfflineChanged,
  OfflineItem,
  OfflineJob,
  OfflineLocation,
  OfflineMeta,
  OfflineMoving,
  OfflineProgress,
} from './types'

interface OfflineVideoPlugin {
  list(): Promise<{ items?: OfflineItem[] }>
  enqueue(o: { job: OfflineJob; meta: OfflineMeta }): Promise<OfflineItem>
  pause(o: { id: string }): Promise<void>
  resume(o: { id: string }): Promise<void>
  remove(o: { id: string }): Promise<void>
  patchMeta(o: { id: string; patch: Record<string, unknown> }): Promise<OfflineItem>
  usage(): Promise<{ used?: number; free?: number | null }>
  clear(): Promise<void>
  nativePath(o: { id: string }): Promise<{ path?: string }>
  setWifiOnly(o: { on: boolean }): Promise<void>
  network(): Promise<{ unmetered?: boolean }>
  storage(): Promise<AndroidStorage>
  moveStorage(o: { target: string }): Promise<AndroidStorage>
  addListener(
    event: 'progress' | 'changed' | 'moving',
    cb: (payload: unknown) => void
  ): Promise<PluginListenerHandle>
}

/** Ответ `storage()` службы; −1 — свободное место не узнать. */
interface AndroidStorage {
  current?: 'internal' | 'sd'
  internalFree?: number
  sd?: { free?: number } | null
  sdUnavailable?: boolean
}

const OfflineVideo = registerPlugin<OfflineVideoPlugin>('OfflineVideo')

const bytes = (n: number | undefined): number | null => (typeof n === 'number' && n >= 0 ? n : null)

/** Ответ службы — в общий вид. */
export function fromAndroidStorage(s: AndroidStorage): OfflineLocation {
  const current = s.current === 'sd' ? 'sd' : 'internal'
  const sd = s.sd ? { free: bytes(s.sd.free) } : null
  return {
    current,
    isDefault: current === 'internal',
    unavailable: s.sdUnavailable ? true : null,
    free: current === 'sd' ? (sd?.free ?? null) : bytes(s.internalFree),
    sd,
  }
}

/** Перехват WebView в MainActivity (OfflineWebViewClient). */
const PREFIX = '/_offline_/'

async function listen<T>(
  event: 'progress' | 'changed' | 'moving',
  cb: (payload: T) => void
): Promise<() => void> {
  const handle = await OfflineVideo.addListener(event, (payload) => cb(payload as T))
  return () => void handle.remove()
}

export const androidBackend: OfflineBackend = {
  kind: 'android',
  list: async () => (await OfflineVideo.list()).items ?? [],
  enqueue: (job, meta) => OfflineVideo.enqueue({ job, meta }),
  pause: (id) => OfflineVideo.pause({ id }),
  resume: (id) => OfflineVideo.resume({ id }),
  remove: (id) => OfflineVideo.remove({ id }),
  patchMeta: (id, patch) => OfflineVideo.patchMeta({ id, patch }),
  async usage() {
    const { used, free } = await OfflineVideo.usage()
    return { used: used ?? 0, free: typeof free === 'number' ? free : null }
  },
  clear: () => OfflineVideo.clear(),
  // Имя файла — как есть: `captions/ru.vtt` со слешем, перехват ждёт его так.
  fileUrl: async (id, file) =>
    `${window.location.origin}${PREFIX}${encodeURIComponent(id)}/${file}`,
  async nativeUrl(id) {
    const { path } = await OfflineVideo.nativePath({ id })
    if (!path) return null
    return `file://${path.split('/').map(encodeURIComponent).join('/')}`
  },
  setWifiOnly: (on) => OfflineVideo.setWifiOnly({ on }),
  unmetered: async () => (await OfflineVideo.network()).unmetered !== false,
  location: async () => fromAndroidStorage(await OfflineVideo.storage()),
  moveTo: async (target) =>
    fromAndroidStorage(await OfflineVideo.moveStorage({ target: target ?? 'internal' })),
  onMoving: (cb) => listen<OfflineMoving>('moving', cb),
  onProgress: (cb) => listen<OfflineProgress>('progress', cb),
  onChanged: (cb) =>
    listen<OfflineChanged>('changed', (e) => cb({ id: e.id, item: e.item ?? null })),
}
