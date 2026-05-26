<template>
  <SC_FileMessage>
    <SC_FileIcon>{{ icon }}</SC_FileIcon>

    <SC_FileBody>
      <SC_FileName :title="fileName">{{ fileName }}</SC_FileName>
      <SC_FileMeta>
        <span>{{ sizeLabel }}</span>
        <SC_Progress v-if="uploadProgress != null && uploadProgress < 100"
          >· загрузка {{ uploadProgress }}%</SC_Progress
        >
        <SC_ErrorText v-else-if="downloadError">· ошибка скачивания</SC_ErrorText>
      </SC_FileMeta>
    </SC_FileBody>

    <SC_DownloadButton
      v-if="canDownload"
      type="button"
      :title="'Скачать'"
      :disabled="isDownloading"
      @click="onDownload"
    >
      <SC_Spinner v-if="isDownloading" />
      <span v-else>⬇</span>
    </SC_DownloadButton>
  </SC_FileMessage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import { iconForMime, formatFileSize } from './helpers'
import {
  SC_FileMessage,
  SC_FileIcon,
  SC_FileBody,
  SC_FileName,
  SC_FileMeta,
  SC_DownloadButton,
  SC_Spinner,
  SC_Progress,
  SC_ErrorText,
} from './styled'

const props = defineProps<{
  message: Message
}>()

const store = useMessengerStore()

const fileName = computed<string>(() => props.message.info?.name || 'file')
const mimetype = computed<string>(() => props.message.info?.mimetype || 'application/octet-stream')
const size = computed<number>(() => Number(props.message.info?.size) || 0)
const sizeLabel = computed(() => formatFileSize(size.value))
const icon = computed(() => iconForMime(mimetype.value, fileName.value))

const uploadProgress = computed(() => {
  const p = props.message.info?.uploadProgress
  return typeof p === 'number' ? p : null
})

const isLocal = computed(() => {
  // Локальное (отправляющееся) сообщение пока без url
  return (
    !props.message.url ||
    (typeof props.message.url === 'string' && props.message.url.startsWith('blob:'))
  )
})

const canDownload = computed(() => !isLocal.value || !!props.message.url)

const isDownloading = ref(false)
const downloadError = ref(false)

const triggerBrowserDownload = (objectUrl: string, name: string) => {
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const onDownload = async () => {
  if (!canDownload.value) return
  isDownloading.value = true
  downloadError.value = false
  try {
    const url = await store.fetchAndDecryptMedia(props.message, mimetype.value)
    if (!url) {
      downloadError.value = true
      return
    }
    triggerBrowserDownload(url, fileName.value)
  } catch (_e) {
    downloadError.value = true
  } finally {
    isDownloading.value = false
  }
}
</script>
