<template>
  <SC_PostModalWrapper>
    <Modal
      :open="isModalOpen"
      :title="t('postCard.postTitle')"
      :full-width="fullWidth"
      :centered="true"
      :closable="true"
      :mask-closable="true"
      :footer="null"
      :destroy-on-close="true"
      @cancel="closeModal"
    >
      <SC_PostModalContent v-if="isModalOpen && postData" :key="postData.id ?? postData.txid ?? ''">
        <PostCard
          :post="postData"
          :show-full="true"
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
        />
      </SC_PostModalContent>
    </Modal>
  </SC_PostModalWrapper>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import Modal from '@/components/modal/modal.vue'
import { SC_PostModalWrapper, SC_PostModalContent } from './styled'

const PostCard = defineAsyncComponent(
  () => import('@/b-components/content/post-card/post-card.vue')
)

withDefaults(defineProps<{ fullWidth?: boolean }>(), { fullWidth: true })

const emit = defineEmits<{
  close: []
  like: [postId: string | number]
  comment: [postId: string | number]
  share: [postId: string | number]
}>()

const { t } = useI18n()
const modalStore = useModalStore()
const postsStore = usePostsStore()
const { postModal } = storeToRefs(modalStore)

const isModalOpen = computed(() => postModal.value.isOpen)
const postData = computed(() => postModal.value.post)

function closeModal(): void {
  modalStore.closePostModal()
  emit('close')
}

function handleLike(postId: string | number): void {
  postsStore.likePost(postId)
  emit('like', postId)
}

function handleComment(postId: string | number): void {
  postsStore.commentPost(postId)
  emit('comment', postId)
}

function handleShare(postId: string | number): void {
  postsStore.sharePost(postId)
  emit('share', postId)
}
</script>
