<template>
  <Modal
    :open="open"
    :footer="null"
    :width="620"
    :centered="true"
    :z-index="3000"
    :title="t('header.pendingPostPreviewTitle')"
    @cancel="close"
  >
    <SC_PreviewNote :confirmed="confirmed">
      <CheckCircleOutlined v-if="confirmed" />
      <ClockCircleOutlined v-else />
      <span>{{
        t(confirmed ? 'header.pendingPostConfirmedNote' : 'header.pendingPostPreviewNote')
      }}</span>
    </SC_PreviewNote>

    <SC_PreviewBody v-if="adapted">
      <!-- Та же карточка, что и в ленте: show-full + сама рисует бейдж
           «не опубликовано» по adapted.pending. -->
      <PostCard :post="adapted" show-full />
    </SC_PreviewBody>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import { pendingPostToAdapted } from '@/composables/pending-post-adapter'
import type { PendingPost } from '@/stores/pending-posts-store'
import type { AdaptedPost } from '@/composables/use-feed'
import { SC_PreviewNote, SC_PreviewBody } from './styled'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  post: PendingPost | null
  author: AdaptedPost['author'] | null
  /** Пост подтвердился сетью, пока модалка открыта: пометка меняется, бейдж снимается. */
  confirmed?: boolean
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const adapted = computed<AdaptedPost | null>(() => {
  if (!props.post || !props.author) return null
  const a = pendingPostToAdapted(props.post, props.author)
  return props.confirmed ? { ...a, pending: false } : a
})

function close(): void {
  emit('update:open', false)
}
</script>
