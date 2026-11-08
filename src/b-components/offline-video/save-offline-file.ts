// «Сохранить файлом»: скачанное лежит в данных приложения (так его видит
// плеер без сети), а этим действием — копия обычным файлом, куда человек
// выберет: системный диалог «Сохранить» на компьютере, «Поделиться» на
// телефоне, диалог сохранения или загрузка в браузере. Файл идёт кусками —
// большой ролик в памяти целиком не держим.

import { offlineBackend } from '@/services/offline-video/backend'
import type { OfflineItem } from '@/services/offline-video/types'
import { openSaveSink } from '@/helpers/ipfs/ipfs-save-sinks'
import { safeFileName, type SaveResult } from '@/helpers/common/save-to-device'

/** Имя файла: название поста; звук — .m4a, ролик — .mp4. */
export function offlineFileName(item: OfflineItem): string {
  const mime = item.meta.kind === 'audio' ? 'audio/mp4' : 'video/mp4'
  return safeFileName(item.meta.title || item.meta.uuid, mime, item.meta.uuid || 'bastyon')
}

/** Вызывать прямо по нажатию: браузеру диалог сохранения нужен в жесте пользователя. */
export async function saveOfflineFile(item: OfflineItem): Promise<SaveResult> {
  let sink: Awaited<ReturnType<typeof openSaveSink>>
  try {
    sink = await openSaveSink(offlineFileName(item))
  } catch {
    return 'failed'
  }
  if (!sink) return 'cancelled'
  try {
    const size = item.state.total || item.meta.size || 0
    if (size > sink.maxBytes) throw new Error('too big')
    const backend = await offlineBackend()
    if (!backend) throw new Error('no backend')
    const res = await fetch(await backend.fileUrl(item.id, 'video.mp4'))
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) await sink.write(value)
    }
    await sink.close()
    return 'saved'
  } catch {
    await sink.abort()
    return 'failed'
  }
}
