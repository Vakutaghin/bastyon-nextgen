<template>
  <SC_ImagesGrid v-if="images.length || !full">
    <SC_ImageThumb v-for="img in images" :key="img.id">
      <img :src="img.base64" :alt="t('postComposer.imageAlt')" />
      <SC_ImageRotate
        type="button"
        :aria-label="t('postComposer.rotateImage')"
        @click="emit('rotate', img.id)"
      >
        <RotateRightOutlined />
      </SC_ImageRotate>
      <SC_ImageEdit
        type="button"
        :aria-label="t('postComposer.editImage')"
        @click="openEditor(img)"
      >
        <EditOutlined />
      </SC_ImageEdit>
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

  <ImageEditorModal
    :open="!!editingId"
    :image="editingBase64"
    @apply="onEditApply"
    @close="editingId = null"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateRightOutlined, EditOutlined } from '@ant-design/icons-vue'

import {
  SC_AddTile,
  SC_ImageRemove,
  SC_ImageRotate,
  SC_ImageEdit,
  SC_ImagesGrid,
  SC_ImageThumb,
} from './composer-images.styled'
import ImageEditorModal from './image-editor-modal.vue'
import type { ComposerImage } from './use-post-images'

defineProps<{ images: ComposerImage[]; full: boolean }>()
const emit = defineEmits<{
  (e: 'add', files: File[]): void
  (e: 'remove', id: string): void
  (e: 'rotate', id: string): void
  (e: 'edit', payload: { id: string; base64: string }): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const dragover = ref(false)

// Редактор (crop/фильтры/поворот) — модалка по конкретной картинке.
const editingId = ref<string | null>(null)
const editingBase64 = ref<string>('')

const openEditor = (img: ComposerImage): void => {
  editingId.value = img.id
  editingBase64.value = img.base64
}

const onEditApply = (base64: string): void => {
  if (editingId.value) emit('edit', { id: editingId.value, base64 })
  editingId.value = null
}

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
