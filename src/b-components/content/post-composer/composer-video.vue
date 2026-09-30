<template>
  <SC_VideoPick v-if="state === 'idle'" :class="{ disabled }">
    <input type="file" :accept="ACCEPT" :disabled="disabled" @change="onPick" />
    <VideoCameraAddOutlined />
    {{ t('postComposer.videoUpload') }}
  </SC_VideoPick>

  <SC_VideoPanel v-else-if="state === 'uploading'" role="status">
    <SC_VideoRow>
      <SC_VideoName>{{ fileLabel }}</SC_VideoName>
      <SC_VideoAction type="button" :disabled="disabled" @click="cancel">{{
        t('postComposer.videoCancel')
      }}</SC_VideoAction>
    </SC_VideoRow>
    <SC_Progress
      :value="percent"
      max="100"
      :aria-label="t('postComposer.videoUploading', { percent })"
    />
    <SC_VideoHint>
      {{ t('postComposer.videoUploading', { percent }) }} · {{ t('postComposer.videoKeepOpen') }}
    </SC_VideoHint>
  </SC_VideoPanel>

  <SC_VideoPanel v-else-if="state === 'done'">
    <SC_VideoRow>
      <PlayCircleOutlined />
      <SC_VideoName>
        {{ isAudio ? t('postComposer.audioAttached') : t('postComposer.videoAttached')
        }}<template v-if="fileLabel"> · {{ fileLabel }}</template>
      </SC_VideoName>
      <SC_VideoAction type="button" :disabled="disabled" @click="remove">{{
        t('postComposer.videoRemove')
      }}</SC_VideoAction>
    </SC_VideoRow>
  </SC_VideoPanel>

  <SC_VideoErrorPanel v-else role="alert">
    <SC_VideoRow>
      <SC_VideoName>{{ errorText }}</SC_VideoName>
      <SC_VideoAction type="button" :disabled="disabled" @click="retry">{{
        t('postComposer.videoRetry')
      }}</SC_VideoAction>
      <SC_VideoAction type="button" :disabled="disabled" @click="reset">{{
        t('postComposer.videoCancel')
      }}</SC_VideoAction>
    </SC_VideoRow>
  </SC_VideoErrorPanel>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { PlayCircleOutlined, VideoCameraAddOutlined } from '@/components/icons'
import { useComposerVideo, type UploadedComposerVideo } from './use-composer-video'
import type { KeyPair } from '@/blockchain/types/keys'
import {
  SC_Progress,
  SC_VideoAction,
  SC_VideoErrorPanel,
  SC_VideoHint,
  SC_VideoName,
  SC_VideoPanel,
  SC_VideoPick,
  SC_VideoRow,
} from './composer-video.styled'

/** Видео и аудио: MIME плюс расширения на случай пустого MIME (mkv и т. п.). */
const ACCEPT = 'video/*,audio/*,.mkv,.mov,.avi,.webm,.m4a,.flac,.ogg'

const props = defineProps<{
  /** Указатель в посте: пусто — композер сбросился, панель возвращается к выбору файла. */
  pointer: string
  getAuth: () => { keyPair: KeyPair; address: string } | null
  getTitle: () => string
  /** Идёт публикация поста: видео не выбрать, не убрать и не перезалить. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'uploaded', video: UploadedComposerVideo): void
  (e: 'removed'): void
  (e: 'uploading', active: boolean): void
  (e: 'auth-required'): void
}>()

const { t } = useI18n()

const {
  state,
  percent,
  fileLabel,
  isAudio,
  errorText,
  start,
  cancel,
  retry,
  remove,
  restore,
  reset,
} = useComposerVideo({
  getAuth: () => props.getAuth(),
  getTitle: () => props.getTitle(),
  onUploaded: (video) => emit('uploaded', video),
  onRemoved: () => emit('removed'),
  onAuthRequired: () => emit('auth-required'),
})

restore(props.pointer)
watch(state, (value) => emit('uploading', value === 'uploading'))
watch(
  () => props.pointer,
  (pointer) => {
    // Черновик читается уже после открытия окна: видео из него приходит
    // позже, и без этого панель снова предлагала выбрать файл.
    if (pointer) restore(pointer)
    else if (state.value === 'done') reset()
  }
)
onBeforeUnmount(reset)

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (picked) void start(picked)
}
</script>
