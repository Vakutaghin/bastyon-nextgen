<template>
  <SC_BlockImage>
    <SC_BlockImageImg :src="imageUrl" :alt="imageAlt" @error="imageError = true" />
    <SC_BlockImageCaption v-if="imageCaption">
      {{ decodedCaption }}
    </SC_BlockImageCaption>
  </SC_BlockImage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { SC_BlockImage, SC_BlockImageImg, SC_BlockImageCaption } from './styled'

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

const imageError = ref(false)

const imageUrl = computed<string>(
  () => props.block.data.url || props.block.data.file?.url || props.block.data.src || ''
)
const imageAlt = computed<string>(() => props.block.data.caption || props.block.data.alt || '')
const imageCaption = computed<string>(
  () => props.block.data.caption || props.block.data.captionText || ''
)
const decodedCaption = computed<string>(() => {
  try {
    return decodeURIComponent(String(imageCaption.value))
  } catch {
    return String(imageCaption.value)
  }
})
</script>
