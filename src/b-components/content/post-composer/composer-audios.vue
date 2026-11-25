<template>
  <SC_Audios data-testid="composer-audios">
    <SC_List ref="listRef">
      <SC_Item
        v-for="(item, index) in items"
        :key="item.id"
        :class="{ dragging: dragIndex === index, failed: item.status === 'error' }"
        data-testid="composer-audio"
      >
        <SC_Row>
          <template v-if="many">
            <SC_Handle
              type="button"
              :disabled="disabled"
              :aria-label="t('collections.editor.move', { n: index + 1 })"
              @pointerdown="!disabled && onPointerDown($event, index)"
              @keydown="onHandleKey($event, index)"
            >
              <DragHandleIcon />
            </SC_Handle>
            <SC_Number>{{ index + 1 }}</SC_Number>
            <SC_TitleInput
              :value="item.title"
              :maxlength="MAX_AUDIO_TITLE"
              :placeholder="t('media.partN', { n: index + 1 })"
              :aria-label="t('postComposer.audioPartTitle', { n: index + 1 })"
              :disabled="disabled"
              @input="emit('rename', item.id, ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template v-else>
            <SoundOutlined />
            <SC_Name>{{ item.title || t('postComposer.audioAttached') }}</SC_Name>
          </template>
          <SC_Status>{{ statusOf(item) }}</SC_Status>
          <SC_Action
            v-if="item.status === 'error'"
            type="button"
            :disabled="disabled"
            @click="emit('retry', item.id)"
          >
            {{ t('postComposer.videoRetry') }}
          </SC_Action>
          <SC_Remove
            v-if="!keepLast || many"
            type="button"
            :aria-label="t('postComposer.audioRemove', { title: item.title || index + 1 })"
            :disabled="disabled"
            @click="emit('remove', item.id)"
          >
            <CloseOutlined />
          </SC_Remove>
        </SC_Row>
        <SC_Progress
          v-if="item.status === 'uploading'"
          :value="item.percent"
          max="100"
          :aria-label="t('postComposer.videoUploading', { percent: item.percent })"
        />
        <SC_Error v-if="item.error" role="alert">{{ item.error }}</SC_Error>
      </SC_Item>
    </SC_List>

    <SC_Foot>
      <SC_Add v-if="!full" :class="{ disabled }">
        <input
          type="file"
          multiple
          :accept="AUDIO_ACCEPT"
          :disabled="disabled"
          :aria-label="t('postComposer.audioAdd')"
          data-testid="composer-audio-add"
          @change="onPick"
        />
        <PlusOutlined />
        {{ t('postComposer.audioAdd') }}
      </SC_Add>
      <SC_Hint v-if="uploading">{{ t('postComposer.videoKeepOpen') }}</SC_Hint>
    </SC_Foot>

    <SC_CoverRow v-if="cover">
      <SC_CoverThumb>
        <img v-if="cover.state.url" :src="cover.state.url" alt="" />
      </SC_CoverThumb>
      <SC_CoverName>{{ coverLabel }}</SC_CoverName>
      <SC_Action type="button" :disabled="disabled" @click="coverOpen = true">
        {{ t('videoCover.change') }}
      </SC_Action>
    </SC_CoverRow>

    <!-- Прежний Bastyon знает у поста одну запись. -->
    <SC_Hint v-if="many" data-testid="composer-audios-hint">
      {{ t('postComposer.audiosLegacyHint') }}
    </SC_Hint>

    <Modal
      :open="coverOpen && !!cover"
      :title="t('videoCover.title')"
      :footer="null"
      :width="560"
      @cancel="coverOpen = false"
    >
      <SC_CoverDialog v-if="coverOpen && cover">
        <VideoCoverPicker
          :media="null"
          :cover="cover.state"
          :disabled="disabled"
          @pick="onCover"
          @retry="emit('retry-cover')"
        />
        <SC_CoverDone type="button" @click="coverOpen = false">
          {{ t('videoCover.done') }}
        </SC_CoverDone>
      </SC_CoverDialog>
    </Modal>
  </SC_Audios>
</template>

<script setup lang="ts">
// Записи аудио-поста: одна строкой, несколько — списком с названиями, порядок
// меняется за ручку. Состояние — в use-composer-audios.

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Modal from '@/components/modal'
import { CloseOutlined, DragHandleIcon, PlusOutlined, SoundOutlined } from '@/components/icons'
import { usePointerReorder } from '@/b-components/media/collection-editor/use-pointer-reorder'
import VideoCoverPicker from '@/b-components/video-studio/video-cover-picker.vue'
import type { CoverSource, VideoCover } from '@/b-components/video-studio/video-cover'
import { formatFileSize } from '@/b-components/video-uploader/utils/video-formatter'
import { MAX_AUDIO_TITLE } from '@/helpers/content/post-audios'
import { formatDuration } from '@/services/media/media-post'
import { AUDIO_ACCEPT } from './audio-file'
import type { ComposerAudio } from './use-composer-audios'
import {
  SC_Action,
  SC_Add,
  SC_Audios,
  SC_CoverName,
  SC_Error,
  SC_Foot,
  SC_Handle,
  SC_Hint,
  SC_Item,
  SC_List,
  SC_Name,
  SC_Number,
  SC_Remove,
  SC_Row,
  SC_Status,
  SC_TitleInput,
} from './composer-audios.styled'
import {
  SC_CoverDialog,
  SC_CoverDone,
  SC_CoverRow,
  SC_CoverThumb,
  SC_Progress,
} from './composer-video.styled'

const props = defineProps<{
  items: ComposerAudio[]
  cover: VideoCover | null
  /** Больше записей не поместится. */
  full: boolean
  uploading: boolean
  /** Последнюю запись не убрать: сеть не даёт сменить тип опубликованного поста. */
  keepLast?: boolean
  /** Идёт публикация поста: список не меняется. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  add: [files: File[]]
  remove: [id: string]
  retry: [id: string]
  rename: [id: string, title: string]
  move: [from: number, to: number]
  'set-cover': [image: Blob, source: CoverSource, time: number]
  'retry-cover': []
}>()

const { t } = useI18n()
const coverOpen = ref(false)
const listRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const many = computed(() => props.items.length > 1)

const { dragIndex, onPointerDown, onHandleKey } = usePointerReorder(
  listRef,
  (from, to) => {
    if (!props.disabled) emit('move', from, to)
  },
  () => props.items.length
)

function statusOf(item: ComposerAudio): string {
  switch (item.status) {
    case 'queued':
      return t('postComposer.audioQueued')
    case 'uploading':
      return `${item.percent}%`
    case 'error':
      return ''
    default:
      return formatDuration(item.duration) || (item.size ? formatFileSize(item.size) : '')
  }
}

const coverLabel = computed<string>(() => {
  const state = props.cover?.state
  if (!state) return ''
  if (state.status === 'error') return t('videoCover.saveFailed')
  if (state.source === 'image') return t('videoCover.sourceImage')
  if (state.source === 'server') return t('videoCover.sourceServer')
  return t('videoCover.serverPicks')
})

function onCover(image: Blob, source: CoverSource, time = 0): void {
  emit('set-cover', image, source, time)
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // тот же файл можно выбрать снова
  if (files.length) emit('add', files)
}
</script>
