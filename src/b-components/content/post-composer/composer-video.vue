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
    <SC_CoverRow v-if="cover">
      <SC_CoverThumb>
        <img v-if="cover.state.url" :src="cover.state.url" alt="" />
      </SC_CoverThumb>
      <SC_VideoName>{{ coverLabel }}</SC_VideoName>
      <SC_VideoAction type="button" :disabled="disabled" @click="coverOpen = true">{{
        t('videoCover.change')
      }}</SC_VideoAction>
    </SC_CoverRow>
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
    <SC_CoverRow v-if="cover">
      <SC_CoverThumb>
        <img v-if="cover.state.url" :src="cover.state.url" alt="" />
      </SC_CoverThumb>
      <SC_VideoName>{{ coverLabel }}</SC_VideoName>
      <SC_VideoAction type="button" :disabled="disabled" @click="coverOpen = true">{{
        t('videoCover.change')
      }}</SC_VideoAction>
    </SC_CoverRow>
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

  <Modal
    :open="coverOpen && !!cover && !!file"
    :title="t('videoCover.title')"
    :footer="null"
    :width="560"
    :z-index="Z_INDEX.MODAL"
    @cancel="coverOpen = false"
  >
    <SC_CoverDialog v-if="coverOpen && cover && file">
      <VideoCoverPicker
        :file="file"
        :cover="cover.state"
        :disabled="disabled"
        @pick="setCover"
        @retry="retryCover"
      />
      <SC_CoverDone type="button" @click="coverOpen = false">{{
        t('videoCover.done')
      }}</SC_CoverDone>
    </SC_CoverDialog>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'

import { PlayCircleOutlined, VideoCameraAddOutlined } from '@/components/icons'
import { useComposerVideo, type UploadedComposerVideo } from './use-composer-video'
import type { KeyPair } from '@/blockchain/types/keys'
import { Z_INDEX } from '@/styles/design-tokens'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import VideoCoverPicker from '@/b-components/video-studio/video-cover-picker.vue'
import {
  SC_CoverDialog,
  SC_CoverDone,
  SC_CoverRow,
  SC_CoverThumb,
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
  file,
  fileLabel,
  cover,
  busy,
  isAudio,
  errorText,
  start,
  cancel,
  retry,
  remove,
  restore,
  reset,
  setCover,
  retryCover,
} = useComposerVideo({
  getAuth: () => props.getAuth(),
  getTitle: () => props.getTitle(),
  onUploaded: (video) => emit('uploaded', video),
  onRemoved: () => emit('removed'),
  onAuthRequired: () => emit('auth-required'),
})

/** Окно выбора обложки. */
const coverOpen = ref(false)

const coverLabel = computed<string>(() => {
  const current = cover.value?.state
  if (!current) return ''
  if (current.status === 'error') return t('videoCover.saveFailed')
  switch (current.source) {
    case 'first':
      return t('videoCover.sourceFirst')
    case 'frame':
      return t('videoCover.sourceFrame', { time: formatDuration(current.time) })
    case 'image':
      return t('videoCover.sourceImage')
    default:
      return t('videoCover.serverPicks')
  }
})

restore(props.pointer)
// Пока видео грузится или обложка не на сервере, пост не публикуется.
watch(busy, (value) => emit('uploading', value))
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
