<template>
  <SC_DownloadBtn
    type="button"
    :disabled="busy"
    :title="t('postCard.downloadImage')"
    :aria-label="t('postCard.downloadImage')"
    data-testid="media-download"
    @click.stop="onDownload"
  >
    <LoadingOutlined v-if="busy" />
    <DownloadOutlined v-else />
  </SC_DownloadBtn>
  <SC_DownloadError v-if="failed" role="alert" @click.stop>
    {{ t('postCard.downloadImageFailed') }}
  </SC_DownloadError>
</template>

<script setup lang="ts">
// Кнопка «Скачать» в просмотрщике картинок (лента, чат): на компьютере —
// системный диалог «Сохранить», на телефоне — «Поделиться» (downloadMedia).
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { DownloadOutlined, LoadingOutlined } from '@/components/icons'
import { downloadMedia } from '@/helpers/common/download-media'
import { SC_DownloadBtn, SC_DownloadError } from './media-download-button.styled'

const props = defineProps<{
  src: string
  /** Имя файла; нет — из адреса. */
  name?: string
}>()

const { t } = useI18n()
const busy = ref(false)
const failed = ref(false)
let hideError: ReturnType<typeof setTimeout> | undefined

async function onDownload(): Promise<void> {
  if (!props.src || busy.value) return
  busy.value = true
  failed.value = false
  try {
    const result = await downloadMedia(props.src, props.name)
    if (result === 'failed') {
      failed.value = true
      clearTimeout(hideError)
      hideError = setTimeout(() => (failed.value = false), 5000)
    }
  } finally {
    busy.value = false
  }
}

watch(
  () => props.src,
  () => (failed.value = false)
)

onBeforeUnmount(() => clearTimeout(hideError))
</script>
