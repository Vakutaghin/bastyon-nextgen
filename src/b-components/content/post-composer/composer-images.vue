<template>
  <SC_ImagesGrid v-if="images.length || !full">
    <SC_ImageThumb v-for="img in images" :key="img.id">
      <img :src="img.base64" :alt="t('postComposer.imageAlt')" />
      <SC_ImageRemove
        type="button"
        :aria-label="t('postComposer.removeImage')"
        @click="emit('remove', img.id)"
      >
        ×
      </SC_ImageRemove>
    </SC_ImageThumb>

    <SC_AddTile
      v-if="!full"
      :dragover="dragover"
      :aria-label="t('postComposer.addImages')"
      @dragover.prevent="dragover = true"
      @dragleave.prevent="dragover = false"
      @drop.prevent="onDrop"
    >
      +
      <input ref="inputRef" type="file" accept="image/*" multiple @change="onChange" />
    </SC_AddTile>
  </SC_ImagesGrid>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SC_AddTile, SC_ImageRemove, SC_ImagesGrid, SC_ImageThumb } from './composer-images.styled'
import type { ComposerImage } from './use-post-images'

defineProps<{ images: ComposerImage[]; full: boolean }>()
const emit = defineEmits<{ (e: 'add', files: File[]): void; (e: 'remove', id: string): void }>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const dragover = ref(false)

const onChange = (e: Event): void => {
  const input = e.target as HTMLInputElement
  if (input.files?.length) emit('add', Array.from(input.files))
  input.value = '' // позволяем повторно выбрать тот же файл
}

const onDrop = (e: DragEvent): void => {
  dragover.value = false
  const files = e.dataTransfer?.files
  if (files?.length) emit('add', Array.from(files))
}
</script>
