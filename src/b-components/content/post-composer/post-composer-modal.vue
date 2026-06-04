<template>
  <Modal
    :open="modalStore.postComposerModal.isOpen"
    :title="modalTitle"
    :width="600"
    :centered="true"
    :footer="null"
    @cancel="modalStore.closePostComposerModal()"
  >
    <!-- v-if пересоздаёт композер при каждом открытии — чтобы префилл edit/repost инициализировался заново. -->
    <PostComposer
      v-if="modalStore.postComposerModal.isOpen"
      :mode="modalStore.postComposerModal.mode"
      :source="modalStore.postComposerModal.source"
      @published="modalStore.closePostComposerModal()"
    />
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Modal from '@/components/modal/modal.vue'
import { useModalStore } from '@/stores'

import PostComposer from './post-composer.vue'

const { t } = useI18n()
const modalStore = useModalStore()

const modalTitle = computed(() => {
  const mode = modalStore.postComposerModal.mode
  if (mode === 'edit') return t('postComposer.editTitle')
  if (mode === 'repost') return t('postComposer.repostTitle')
  return t('postComposer.title')
})
</script>
