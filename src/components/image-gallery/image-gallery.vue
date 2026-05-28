<template>
  <VueEasyLightbox :visible="visible" :imgs="images" :index="index" @hide="handleHide" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import VueEasyLightbox from 'vue-easy-lightbox'

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

const index = ref(0)

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
  }
)

onBeforeUnmount(removeZoomPrevention)

function handleHide(): void {
  emit('update:visible', false)
  emit('hide')
}
</script>

<style scoped src="./image-gallery.styles.css"></style>
