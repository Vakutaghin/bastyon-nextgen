<template>
  <SC_PostImage :image-count="imageCount">
    <SC_ImageWrapper
      v-for="(imageUrl, idx) in images"
      :key="idx"
      :image-count="imageCount"
      :style="getImageWrapperStyle(idx)"
      @click.stop="openImageGallery(idx)"
    >
      <img
        :src="imageUrl"
        :alt="t('postCard.imageAlt', { index: idx + 1 })"
        :style="getImageStyle(idx)"
        loading="lazy"
        decoding="async"
        @error="handleImageError"
        @load="(e) => handleImageLoad(e, idx)"
      />
      <SC_ImageOverlay @click.stop="openImageGallery(idx)">
        <SC_ZoomIconCircle>
          <ZoomInOutlined />
        </SC_ZoomIconCircle>
      </SC_ImageOverlay>
    </SC_ImageWrapper>
  </SC_PostImage>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ZoomInOutlined } from '@ant-design/icons-vue'
import { useModalStore } from '@/stores/modal-store'
import { SC_PostImage, SC_ImageWrapper, SC_ImageOverlay, SC_ZoomIconCircle } from './styled'

const props = defineProps<{ images: string[] }>()

const { t } = useI18n()
const modalStore = useModalStore()

const imageAspectRatios = reactive<
  Record<number, { width: number; height: number; useContain: boolean }>
>({})

const imageCount = computed<number>(() => props.images?.length ?? 0)

function handleImageError(event: Event): void {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}

function handleImageLoad(event: Event, imageIndex: number): void {
  const target = event.target as HTMLImageElement | null
  if (!target) return

  const naturalWidth = target.naturalWidth
  const naturalHeight = target.naturalHeight
  if (naturalWidth === 0 || naturalHeight === 0) return

  const aspectRatio = naturalWidth / naturalHeight
  const useContain = aspectRatio > 1 / 1.5

  imageAspectRatios[imageIndex] = { width: naturalWidth, height: naturalHeight, useContain }

  // Очень высокое изображение (портрет) в одиночной карточке — ограничиваем высоту.
  if (imageCount.value === 1 && naturalHeight > naturalWidth * 2) {
    target.style.aspectRatio = '1 / 2'
    target.style.maxHeight = '500px'
  }
}

function getImageWrapperStyle(imageIndex: number): Record<string, string> {
  const info = imageAspectRatios[imageIndex]
  if (info?.useContain) return { backgroundColor: 'var(--color-bg-tertiary)' }
  return {}
}

function getImageStyle(imageIndex: number): Record<string, string> {
  const info = imageAspectRatios[imageIndex]
  return { objectFit: info?.useContain ? 'contain' : 'cover' }
}

function openImageGallery(index: number): void {
  if (props.images && props.images.length > 0) {
    modalStore.openImageGallery(props.images, index)
  }
}
</script>
