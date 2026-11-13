<template>
  <SC_AttachImageBtn
    type="button"
    :title="t('comments.attachImage')"
    :aria-label="t('comments.attachImage')"
    :disabled="disabled"
    data-testid="comment-attach-image"
    @click.stop.prevent="inputRef?.click()"
  >
    <PictureOutlined />
  </SC_AttachImageBtn>
  <input
    ref="inputRef"
    type="file"
    accept="image/*"
    multiple
    hidden
    data-testid="comment-image-input"
    @change="onChange"
  />
</template>

<script setup lang="ts">
// Кнопка «Прикрепить картинку» формы комментария: открывает выбор файлов.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PictureOutlined } from '@/components/icons'
import { SC_AttachImageBtn } from './styled'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ files: [files: File[]] }>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)

function onChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // тот же файл можно выбрать ещё раз
  if (files.length) emit('files', files)
}
</script>
