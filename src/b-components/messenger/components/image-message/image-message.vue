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
        @load="onImageLoad"
        @error="onImageError"
      />
      <SC_Spinner v-else-if="isLoading" />
      <SC_ErrorBadge v-else-if="decryptFailed" type="button" @click.stop="retry">
        <span aria-hidden="true">⚠️</span>
        <span>{{ t('chat.loadFailed') }}</span>
        <SC_RetryLink>{{ t('chat.retry') }}</SC_RetryLink>
      </SC_ErrorBadge>

      <SC_ProgressBadge v-if="uploadProgress != null && uploadProgress < 100">
        {{ uploadProgress }}%
      </SC_ProgressBadge>
    </SC_ImageFrame>

    <Teleport to="body">
      <SC_Lightbox v-if="lightboxOpen" @click.self="closeLightbox">
        <SC_LightboxImg :src="resolvedSrc || ''" :alt="alt" @click.stop />
        <MediaDownloadButton v-if="downloadSrc" :src="downloadSrc" :name="downloadName" />
      </SC_Lightbox>
    </Teleport>
  </SC_ImageMessage>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import { useTorMedia } from '@/composables/use-tor-media'
import { useCloseOnBack } from '@/composables/use-back-button'
import MediaDownloadButton from '@/components/media-download-button/media-download-button.vue'
import {
  SC_ImageMessage,
  SC_ImageFrame,
  SC_Image,
  SC_Spinner,
  SC_ProgressBadge,
  SC_ErrorBadge,
  SC_RetryLink,
  SC_Lightbox,
  SC_LightboxImg,
} from './styled'

const props = defineProps<{
  message: Message
}>()

const { t } = useI18n()
const store = useMessengerStore()
const { mediaBlocked } = useTorMedia()

const isLocal = computed(
  () => typeof props.message.url === 'string' && props.message.url.startsWith('blob:')
)
const uploadProgress = computed(() => {
  const p = props.message.info?.uploadProgress
  return typeof p === 'number' ? p : null
})

const MAX_WIDTH = 280

/** Размер у загруженной картинки — когда его нет в сообщении (старые клиенты не шлют). */
const loadedSize = ref<{ w: number; h: number } | null>(null)

const size = computed<{ w: number; h: number } | null>(() => {
  const w = Number(props.message.info?.w) || 0
  const h = Number(props.message.info?.h) || 0
  if (w > 0 && h > 0) return { w, h }
  return loadedSize.value
})

const aspectRatio = computed(() => (size.value ? `${size.value.w} / ${size.value.h}` : '4 / 3'))

// Ширина рамки задана сразу, до загрузки: пузырь сообщения сжимается по
// содержимому, и с одной лишь max-width рамка, пока картинка качается и
// расшифровывается, была шириной со спиннер, а потом вырастала. За пузырь
// не вылезает — max-width: 100% в styled.
const frameStyle = computed(() =>
  size.value ? { width: `${Math.min(size.value.w, MAX_WIDTH)}px` } : {}
)

const alt = computed(() => props.message.info?.name || 'image')

const resolvedSrc = ref<string | null>(null)
const isLoading = ref(false)
const decryptFailed = ref(false)
const lightboxOpen = ref(false)
/** Что сохраняет «Скачать» в просмотрщике: расшифрованная картинка или её адрес. */
const downloadSrc = computed<string>(() => resolvedSrc.value ?? '')
const downloadName = computed<string>(() => String(alt.value))

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
  if (!needsDecrypt.value && !mediaBlocked.value) {
    // Не зашифровано — браузер сам подтянет mxc/http
    resolvedSrc.value = props.message.info?.httpUrl || props.message.url || null
    return
  }
  // Зашифровано — или Tor: webview не грузит <img> сам (CSP), тянем через
  // matrixFetch (torified) в blob (V21). Незашифрованное fetchAndDecryptMedia
  // пропускает как есть.
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

const onImageLoad = (e: Event) => {
  if (size.value) return
  const img = e.target as HTMLImageElement
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    loadedSize.value = { w: img.naturalWidth, h: img.naturalHeight }
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

// На window в фазе захвата и без всплытия: иначе Escape доходит до
// мессенджера (messenger-wrapper) и закрывает заодно и чат.
const onEsc = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !lightboxOpen.value) return
  e.preventDefault()
  e.stopPropagation()
  closeLightbox()
}

watch(
  () => props.message.id,
  () => {
    resolvedSrc.value = null
    loadedSize.value = null
    decryptFailed.value = false
    ensureSrc()
  },
  { immediate: true }
)

watch(lightboxOpen, (open) => {
  if (open) window.addEventListener('keydown', onEsc, true)
  else window.removeEventListener('keydown', onEsc, true)
})
// «Назад» на Android — тоже только картинку.
useCloseOnBack(lightboxOpen, closeLightbox)

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc, true)
})
</script>
