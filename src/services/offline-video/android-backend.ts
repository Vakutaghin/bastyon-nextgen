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
  OfflineMeta,
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
  addListener(
    event: 'progress' | 'changed',
    cb: (payload: unknown) => void
  ): Promise<PluginListenerHandle>
}

const OfflineVideo = registerPlugin<OfflineVideoPlugin>('OfflineVideo')

/** Перехват WebView в MainActivity (OfflineWebViewClient). */
const PREFIX = '/_offline_/'

async function listen<T>(
  event: 'progress' | 'changed',
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
  onProgress: (cb) => listen<OfflineProgress>('progress', cb),
  onChanged: (cb) =>
    listen<OfflineChanged>('changed', (e) => cb({ id: e.id, item: e.item ?? null })),
}
