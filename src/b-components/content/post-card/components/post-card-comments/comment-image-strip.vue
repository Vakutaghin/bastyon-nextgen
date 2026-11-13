<template>
  <SC_ReplyImages v-if="images.length || processing" data-testid="comment-images">
    <SC_ReplyImageThumb v-for="image in images" :key="image.id" data-testid="comment-image">
      <img :src="image.src" :alt="t('comments.imageAlt')" decoding="async" />
      <SC_ReplyImageRemove
        type="button"
        :title="t('comments.removeImage')"
        :aria-label="t('comments.removeImage')"
        :disabled="locked"
        data-testid="comment-image-remove"
        @click.stop.prevent="emit('remove', image.id)"
      >
        <CloseOutlined />
      </SC_ReplyImageRemove>
    </SC_ReplyImageThumb>
    <SC_ReplyImageThumb v-for="n in processing" :key="'processing-' + n" class="is-processing">
      <LoadingOutlined spin />
    </SC_ReplyImageThumb>
  </SC_ReplyImages>
</template>

<script setup lang="ts">
// Картинки формы комментария: миниатюры с кнопкой «убрать» и место под те,
// что ещё сжимаются.
import { useI18n } from 'vue-i18n'
import { CloseOutlined, LoadingOutlined } from '@/components/icons'
import type { CommentImage } from './composables/use-comment-images'
import { SC_ReplyImages, SC_ReplyImageThumb, SC_ReplyImageRemove } from './styled'

defineProps<{
  images: CommentImage[]
  /** Сколько картинок ещё сжимается. */
  processing: number
  /** Картинки грузятся — убирать нельзя. */
  locked?: boolean
}>()
const emit = defineEmits<{ remove: [id: string] }>()

const { t } = useI18n()
</script>
