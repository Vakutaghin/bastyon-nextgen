<template>
  <SC_VideoMessage>
    <SC_VideoFrame :aspect="aspectRatio" :is-local="isLocal" :style="frameStyle">
      <!-- 1) Видео ещё не запустили — показываем poster + Play-кнопку -->
      <template v-if="!playerActive">
        <SC_Poster v-if="posterSrc" :src="posterSrc" :alt="alt" loading="lazy" />
        <SC_PosterPlaceholder v-else>🎬</SC_PosterPlaceholder>

        <SC_PlayOverlay v-if="!isLoading && !loadError" type="button" @click="startPlayback">
          <SC_PlayIcon />
        </SC_PlayOverlay>

        <SC_Spinner v-if="isLoading" />

        <SC_ErrorBadge v-if="loadError" type="button" @click="retry">
          <span aria-hidden="true">⚠️</span>
          <span>{{ t('chat.loadFailed') }}</span>
          <SC_RetryLink>{{ t('chat.retry') }}</SC_RetryLink>
        </SC_ErrorBadge>

        <SC_DurationBadge v-if="durationLabel">{{ durationLabel }}</SC_DurationBadge>
      </template>

      <!-- 2) Видео грузим/играем — показываем <video> -->
      <SC_Video
        v-else
        :src="resolvedSrc || undefined"
        :poster="posterSrc || undefined"
        controls
        autoplay
        playsinline
        @error="onVideoError"
      />

      <SC_ProgressBadge v-if="uploadProgress != null && uploadProgress < 100">
        {{ uploadProgress }}%
      </SC_ProgressBadge>
    </SC_VideoFrame>
  </SC_VideoMessage>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import {
  SC_VideoMessage,
  SC_VideoFrame,
  SC_Poster,
  SC_PosterPlaceholder,
  SC_Video,
  SC_PlayOverlay,
  SC_PlayIcon,
  SC_Spinner,
  SC_DurationBadge,
  SC_ProgressBadge,
  SC_ErrorBadge,
  SC_RetryLink,
} from './styled'

const props = defineProps<{
  message: Message
}>()

const { t } = useI18n()
const store = useMessengerStore()

const isLocal = computed(
  () => typeof props.message.url === 'string' && props.message.url.startsWith('blob:')
)
const uploadProgress = computed(() => {
  const p = props.message.info?.uploadProgress
  return typeof p === 'number' ? p : null
})

const w = computed(() => Number(props.message.info?.w) || 0)
const h = computed(() => Number(props.message.info?.h) || 0)

const aspectRatio = computed(() => {
  if (w.value > 0 && h.value > 0) return `${w.value} / ${h.value}`
  return '16 / 9'
})

const frameStyle = computed(() => {
  if (w.value > 0 && h.value > 0) {
    const maxW = Math.min(w.value, 320)
    return { width: `${maxW}px` }
  }
  return {}
})

const alt = computed(() => props.message.info?.name || 'video')

const posterSrc = computed<string | null>(() => {
  const info = props.message.info
  return info?.posterUrl || info?.thumbnail_url || null
})

const durationMs = computed<number>(() => {
  const d = props.message.info?.duration
  return typeof d === 'number' ? d : 0
})

const durationLabel = computed<string | null>(() => {
  if (!durationMs.value) return null
  const totalSec = Math.round(durationMs.value / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const needsDecrypt = computed(() => {
  if (isLocal.value) return false
  return !!props.message.info?.secrets
})

const playerActive = ref(false)
const resolvedSrc = ref<string | null>(null)
const isLoading = ref(false)
const loadError = ref(false)

const startPlayback = async () => {
  if (isLocal.value) {
    resolvedSrc.value = props.message.url || null
    playerActive.value = true
    return
  }
  if (!needsDecrypt.value) {
    resolvedSrc.value = props.message.info?.httpUrl || props.message.url || null
    playerActive.value = true
    return
  }
  if (resolvedSrc.value) {
    playerActive.value = true
    return
  }
  isLoading.value = true
  loadError.value = false
  try {
    const url = await store.fetchAndDecryptMedia(props.message, 'video/mp4')
    if (url) {
      resolvedSrc.value = url
      playerActive.value = true
    } else {
      loadError.value = true
    }
  } catch (_e) {
    loadError.value = true
  } finally {
    isLoading.value = false
  }
}

const onVideoError = () => {
  loadError.value = true
  playerActive.value = false
}

const retry = () => {
  resolvedSrc.value = null
  loadError.value = false
  startPlayback()
}

watch(
  () => props.message.id,
  () => {
    resolvedSrc.value = null
    loadError.value = false
    playerActive.value = false
  }
)
</script>
