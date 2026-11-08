// «Сохранить файлом» с ответом человеку: на компьютере и в браузере — тост,
// на телефоне ответ — само окно «Поделиться».

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { appToast } from '@/b-components/app-toast'
import { isMobile } from '@mobile/utils/platform'
import type { OfflineItem } from '@/services/offline-video/types'
import { offlineFileName, saveOfflineFile } from './save-offline-file'

export function useSaveOfflineFile() {
  const { t } = useI18n()
  /** id того, что сейчас сохраняется. */
  const saving = ref<string | null>(null)

  async function save(item: OfflineItem): Promise<void> {
    if (saving.value) return
    saving.value = item.id
    try {
      const result = await saveOfflineFile(item)
      if (result === 'saved' && !isMobile()) {
        appToast.success({ message: t('offlineVideo.savedFile', { name: offlineFileName(item) }) })
      } else if (result === 'failed') {
        appToast.error({ message: t('offlineVideo.saveFileFailed') })
      }
    } finally {
      saving.value = null
    }
  }

  return { saving, save }
}
