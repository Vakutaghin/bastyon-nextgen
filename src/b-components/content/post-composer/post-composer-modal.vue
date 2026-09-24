<template>
  <Modal
    :open="modalStore.postComposerModal.isOpen"
    :title="modalTitle"
    :width="600"
    :centered="true"
    :footer="null"
    :closable="!publishing"
    :mask-closable="!publishing"
    :keyboard="!publishing"
    @cancel="onCancel"
  >
    <!-- v-if пересоздаёт композер при каждом открытии — чтобы префилл edit/repost инициализировался заново. -->
    <PostComposer
      v-if="modalStore.postComposerModal.isOpen"
      :mode="modalStore.postComposerModal.mode"
      :source="modalStore.postComposerModal.source"
      @published="onPublished"
      @busy-change="publishing = $event"
    />
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Modal from '@/components/modal/modal.vue'
import { useModalStore } from '@/stores'

import PostComposer from './post-composer.vue'

const { t } = useI18n()
const modalStore = useModalStore()

/**
 * Идёт публикация — крестик, маска и Esc не закрывают модалку (S29). Иначе
 * закрытая посреди отправки модалка оставляла черновик, и пользователь
 * публиковал пост второй раз.
 */
const publishing = ref(false)

const onCancel = (): void => {
  if (publishing.value) return
  modalStore.closePostComposerModal()
}

const onPublished = (): void => {
  publishing.value = false
  modalStore.closePostComposerModal()
}

const modalTitle = computed(() => {
  const mode = modalStore.postComposerModal.mode
  if (mode === 'edit') return t('postComposer.editTitle')
  if (mode === 'repost') return t('postComposer.repostTitle')
  return t('postComposer.title')
})
</script>
