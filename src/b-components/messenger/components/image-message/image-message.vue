<template>
  <SC_ImageMessage>
    <SC_ImageFrame
      :aspect="aspectRatio"
      :is-local="isLocal"
      :style="frameStyle"
      @click="openLightbox"
    >
      <SC_Image
        v-if="resolvedSrc && !decryptFailed"
        :src="resolvedSrc"
        :alt="alt"
        loading="lazy"
        @error="onImageError"
      />
      <SC_Spinner v-else-if="isLoading" />
      <SC_ErrorBadge v-else-if="decryptFailed" type="button" @click.stop="retry">
        <span aria-hidden="true">⚠️</span>
        <span>Не удалось загрузить</span>
        <span style="opacity: 0.8; text-decoration: underline">повторить</span>
      </SC_ErrorBadge>

      <SC_ProgressBadge v-if="uploadProgress != null && uploadProgress < 100">
        {{ uploadProgress }}%
      </SC_ProgressBadge>
    </SC_ImageFrame>

    <Teleport to="body">
      <SC_Lightbox v-if="lightboxOpen" @click.self="closeLightbox">
        <SC_LightboxImg :src="resolvedSrc || ''" :alt="alt" @click.stop />
      </SC_Lightbox>
    </Teleport>
  </SC_ImageMessage>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import {
  SC_ImageMessage,
  SC_ImageFrame,
  SC_Image,
  SC_Spinner,
  SC_ProgressBadge,
  SC_ErrorBadge,
  SC_Lightbox,
  SC_LightboxImg,
} from './styled'

const props = defineProps<{
  message: Message
}>()

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
  return '4 / 3'
})

const frameStyle = computed(() => {
  if (w.value > 0 && h.value > 0) {
    // max-width (а не width): даём картинке расти до собственной ширины оригинала,
    // но клампим до 280px и не позволяем вылезать за bubble (max-width: 100% в styled).
    const maxW = Math.min(w.value, 280)
    return { maxWidth: `${maxW}px` }
  }
  return {}
})

const alt = computed(() => props.message.info?.name || 'image')

const resolvedSrc = ref<string | null>(null)
const isLoading = ref(false)
const decryptFailed = ref(false)
const lightboxOpen = ref(false)

const needsDecrypt = computed(() => {
  if (isLocal.value) return false
  return !!props.message.info?.secrets
})

const ensureSrc = async () => {
  if (resolvedSrc.value || isLoading.value) return
  if (isLocal.value) {
    resolvedSrc.value = props.message.url || null
    return
  }
  if (!needsDecrypt.value) {
    // Не зашифровано — браузер сам подтянет mxc/http
    resolvedSrc.value = props.message.info?.httpUrl || props.message.url || null
    return
  }
  isLoading.value = true
  decryptFailed.value = false
  try {
    const url = await store.fetchAndDecryptMedia(props.message, 'image/jpeg')
    if (url) resolvedSrc.value = url
    else decryptFailed.value = true
  } catch (_e) {
    decryptFailed.value = true
  } finally {
    isLoading.value = false
  }
}

const onImageError = () => {
  decryptFailed.value = true
}

const retry = () => {
  resolvedSrc.value = null
  decryptFailed.value = false
  ensureSrc()
}

const openLightbox = () => {
  if (!resolvedSrc.value) return
  lightboxOpen.value = true
}

const closeLightbox = () => {
  lightboxOpen.value = false
}

const onEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && lightboxOpen.value) closeLightbox()
}

watch(
  () => props.message.id,
  () => {
    resolvedSrc.value = null
    decryptFailed.value = false
    ensureSrc()
  },
  { immediate: true }
)

watch(lightboxOpen, (open) => {
  if (open) document.addEventListener('keydown', onEsc)
  else document.removeEventListener('keydown', onEsc)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onEsc)
})
</script>
