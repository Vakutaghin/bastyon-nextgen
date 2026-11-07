<template>
  <!-- Ролик по просьбе мини-приложения (videos.opendialog): тот же блок загрузки,
       что в окне поста, — выбор файла, прогресс, отмена, повтор, обложка.
       «Прикрепить» отдаёт приложению указатель; закрыть окно во время загрузки —
       прервать её. Монтируется только на время запроса (src.vue, v-if). -->
  <Modal
    :open="true"
    :title="t('miniapps.videoTitle', { name: appName })"
    :mask-closable="false"
    :width="520"
    centered
    @cancel="close"
  >
    <SC_Wrap>
      <SC_Lead>{{ t('miniapps.videoLead') }}</SC_Lead>
      <ComposerVideo
        :pointer="uploaded?.link ?? ''"
        :get-auth="getAuth"
        :get-title="noTitle"
        :accept="VIDEO_ONLY"
        :pick-label="t('videoStudio.pick')"
        @uploaded="onUploaded"
        @removed="uploaded = null"
        @uploading="(active: boolean) => (busy = active)"
        @auth-required="close"
      />
    </SC_Wrap>
    <template #footer>
      <Button @click="close">{{ t('miniapps.cancel') }}</Button>
      <Button type="primary" :disabled="!uploaded || busy" @click="attach">
        {{ t('miniapps.videoAttach') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import ComposerVideo from '@/b-components/content/post-composer/composer-video.vue'
import type { UploadedComposerVideo } from '@/b-components/content/post-composer/use-composer-video'
import {
  resolveVideoDialog,
  videoDialogAppName,
  type VideoDialogResult,
} from './video-dialog-controller'
import { SC_Lead, SC_Wrap } from './mini-app-video-dialog.styled'

/** Прежний клиент открывал загрузку видео (`isAudio: false`): звук приложению не нужен. */
const VIDEO_ONLY = 'video/*,.mkv,.mov,.avi,.webm'

const { t } = useI18n()
const authStore = useAuthStore()

const appName = videoDialogAppName.value
const uploaded = ref<VideoDialogResult | null>(null)
/** Ролик грузится или обложка ещё уходит на сервер. */
const busy = ref(false)

function getAuth() {
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress
  return keyPair && address ? { keyPair, address } : null
}

/** Имя ролика на сервере — из имени файла. */
const noTitle = () => ''

function onUploaded(video: UploadedComposerVideo): void {
  uploaded.value = { link: video.pointer, name: video.title }
}

function attach(): void {
  if (uploaded.value && !busy.value) resolveVideoDialog(uploaded.value)
}

/** Закрыть без ролика; идущая загрузка прервётся вместе с окном. */
function close(): void {
  resolveVideoDialog(null)
}
</script>
