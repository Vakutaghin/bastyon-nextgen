<template>
  <SC_LightboxRoot>
    <VueEasyLightbox
      :visible="visible"
      :imgs="images"
      :index="index"
      @hide="handleHide"
      @index-change="onIndexChange"
    />
    <SC_DownloadBtn
      v-if="visible && currentImageUrl"
      type="button"
      :disabled="downloading"
      :title="t('postCard.downloadImage')"
      :aria-label="t('postCard.downloadImage')"
      @click="onDownload"
    >
      <DownloadOutlined />
    </SC_DownloadBtn>
  </SC_LightboxRoot>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DownloadOutlined } from '@ant-design/icons-vue'
import VueEasyLightbox from 'vue-easy-lightbox'
import { downloadMedia } from '@/helpers/common/download-media'
import { SC_LightboxRoot, SC_DownloadBtn } from './image-gallery.styled'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    images: unknown[]
    initialIndex?: number
  }>(),
  { visible: false, initialIndex: 0 }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  hide: []
}>()

const { t } = useI18n()
const index = ref(0)
const currentIndex = ref(0)
const downloading = ref(false)

function onIndexChange(_oldIndex: number, newIndex: number): void {
  currentIndex.value = newIndex
}

/** URL текущего изображения (элемент images — строка или объект `{ src }`). */
const currentImageUrl = computed<string>(() => {
  const item = props.images[currentIndex.value]
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const src = (item as Record<string, unknown>).src
    if (typeof src === 'string') return src
  }
  return ''
})

async function onDownload(): Promise<void> {
  const url = currentImageUrl.value
  if (!url || downloading.value) return
  downloading.value = true
  try {
    await downloadMedia(url)
  } finally {
    downloading.value = false
  }
}

let touchStartHandler: ((e: TouchEvent) => void) | null = null
let wheelHandler: ((e: WheelEvent) => void) | null = null

function preventPageZoom(): void {
  removeZoomPrevention()

  touchStartHandler = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault()
  }
  wheelHandler = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  }

  document.addEventListener('touchstart', touchStartHandler, { passive: false })
  document.addEventListener('wheel', wheelHandler, { passive: false })
}

function removeZoomPrevention(): void {
  if (touchStartHandler) {
    document.removeEventListener('touchstart', touchStartHandler)
    touchStartHandler = null
  }
  if (wheelHandler) {
    document.removeEventListener('wheel', wheelHandler)
    wheelHandler = null
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      index.value = props.initialIndex
      currentIndex.value = props.initialIndex
      preventPageZoom()
    } else {
      // Снимаем хендлеры в nextTick, чтобы они не мешали финальной обработке touch-события,
      // которое закрывает галерею.
      setTimeout(removeZoomPrevention, 0)
    }
  }
)

watch(
  () => props.initialIndex,
  (newVal) => {
    index.value = newVal
    currentIndex.value = newVal
  }
)

onBeforeUnmount(removeZoomPrevention)

function handleHide(): void {
  emit('update:visible', false)
  emit('hide')
}
</script>
