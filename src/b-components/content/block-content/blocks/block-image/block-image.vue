<template>
  <SC_BlockImage>
    <SC_BlockImageButton
      v-if="openImage && imageUrl && !imageError"
      type="button"
      :aria-label="t('postCard.openImage')"
      data-testid="article-image"
      @click.stop="openImage(imageUrl)"
    >
      <TorImage :src="imageUrl" :alt="imageAlt" @error="imageError = true" />
    </SC_BlockImageButton>
    <TorImage v-else :src="imageUrl" :alt="imageAlt" @error="imageError = true" />
    <SC_BlockImageCaption v-if="imageCaption">
      {{ decodedCaption }}
    </SC_BlockImageCaption>
  </SC_BlockImage>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TorImage from '@/components/tor-image'
import { OPEN_ARTICLE_IMAGE, articleImageUrl } from '../../article-images'
import { SC_BlockImage, SC_BlockImageButton, SC_BlockImageCaption } from './styled'
import { safeDecode } from '@/helpers/content/safe-decode'

interface BlockImageData {
  url?: string
  src?: string
  caption?: string
  captionText?: string
  alt?: string
  file?: { url?: string }
}

interface BlockImageBlock {
  type: string
  id: string
  data: BlockImageData
}

const props = defineProps<{
  block: BlockImageBlock
  index?: number
}>()

const { t } = useI18n()
const imageError = ref(false)
/** Просмотрщик статьи (block-content); вне статьи картинка просто картинка. */
const openImage = inject(OPEN_ARTICLE_IMAGE, null)

const imageUrl = computed<string>(() => articleImageUrl(props.block.data))
const imageAlt = computed<string>(() => props.block.data.caption || props.block.data.alt || '')
const imageCaption = computed<string>(
  () => props.block.data.caption || props.block.data.captionText || ''
)
const decodedCaption = computed<string>(() => {
  return safeDecode(String(imageCaption.value))
})
</script>
