// Адрес файла скачанного ролика (обложка, аватар) для `<img>`: у бэкенда он
// асинхронный (в вебе — blob из OPFS).

import { ref, watch, type Ref } from 'vue'
import { offlineBackend } from '@/services/offline-video/backend'
import type { OfflineFile, OfflineItem } from '@/services/offline-video/types'

export function useOfflineFile(
  item: () => OfflineItem | null | undefined,
  file: OfflineFile
): Ref<string | null> {
  const url = ref<string | null>(null)
  let token = 0
  watch(
    () => {
      const it = item()
      const has =
        file === 'thumb.jpg' ? it?.meta.thumb : file === 'avatar.jpg' ? it?.meta.avatar : true
      return it && has ? it.id : null
    },
    async (id) => {
      const mine = ++token
      url.value = null
      if (!id) return
      const backend = await offlineBackend()
      const next = backend ? await backend.fileUrl(id, file).catch(() => null) : null
      if (mine === token) url.value = next
    },
    { immediate: true }
  )
  return url
}
