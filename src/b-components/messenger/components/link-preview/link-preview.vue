<template>
  <SC_LinkPreview v-if="preview" :href="preview.url" target="_blank" rel="noopener noreferrer">
    <SC_Body>
      <SC_SiteName v-if="preview.siteName || siteFromUrl">{{
        preview.siteName || siteFromUrl
      }}</SC_SiteName>
      <SC_Title v-if="preview.title">{{ preview.title }}</SC_Title>
      <SC_Description v-if="preview.description">{{ preview.description }}</SC_Description>
    </SC_Body>
    <SC_Thumb
      v-if="preview.imageUrl && !thumbFailed"
      :src="preview.imageUrl"
      :alt="preview.title || ''"
      loading="lazy"
      @error="thumbFailed = true"
    />
  </SC_LinkPreview>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useLinkPreview } from './use-link-preview'
import { SC_LinkPreview, SC_Body, SC_SiteName, SC_Title, SC_Description, SC_Thumb } from './styled'

const props = defineProps<{
  url: string
}>()

const urlRef = toRef(() => props.url)
const { preview } = useLinkPreview(urlRef)
const thumbFailed = ref(false)

const siteFromUrl = computed<string>(() => {
  try {
    return new URL(props.url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
})
</script>
