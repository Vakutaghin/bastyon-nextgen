<template>
  <SC_PostModalWrapper>
    <Modal
      class="post-modal"
      :open="isModalOpen"
      :full-width="fullWidth"
      :centered="true"
      :closable="true"
      :mask-closable="true"
      :footer="null"
      :destroy-on-close="true"
      :z-index="zIndex"
      @cancel="closeModal"
    >
      <template #title>
        <SC_PostModalTitle>
          {{ t('postCard.postTitle') }}
          <!-- Тот же пост отдельной страницей: у неё свой адрес, им можно поделиться. -->
          <SC_OpenPageLink
            v-if="pagePath"
            :href="pageHref"
            :title="t('postCard.openAsPage')"
            :aria-label="t('postCard.openAsPage')"
            data-testid="post-modal-open-page"
            @click="openAsPage"
          >
            <ExpandOutlined />
          </SC_OpenPageLink>
        </SC_PostModalTitle>
      </template>
      <SC_PostModalContent v-if="isModalOpen && postData" :key="postData.id ?? postData.txid ?? ''">
        <PostCard
          :post="postData"
          :show-full="true"
          :in-modal="true"
          :autoplay-video="postModal.autoplay"
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
        />
      </SC_PostModalContent>
    </Modal>
  </SC_PostModalWrapper>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import Modal from '@/components/modal/modal.vue'
import { isPageOverlaid } from '@/composables/use-page-overlay'
import { Z_INDEX } from '@/styles/design-tokens'
import { ExpandOutlined } from '@/components/icons'
import { getPostShareId } from '@/b-components/content/post-card/helpers'
import {
  SC_PostModalWrapper,
  SC_PostModalContent,
  SC_PostModalTitle,
  SC_OpenPageLink,
} from './styled'

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
/** Над полноэкранным мессенджером: иначе пост из канала открывался под ним, невидимым. */
const zIndex = computed<number | undefined>(() =>
  isPageOverlaid.value ? Z_INDEX.MODAL_OVER_MESSENGER : undefined
)
const postData = computed(() => postModal.value.post)

const route = useRoute()
const router = useRouter()

const pagePath = computed<string>(() => {
  const post = postData.value
  // Пост ещё в мемпуле: страницы у него пока нет.
  if (!post || (post as { pending?: boolean }).pending) return ''
  const id = getPostShareId(post)
  return id ? `/post/${id}` : ''
})
const pageHref = computed<string>(() => (pagePath.value ? router.resolve(pagePath.value).href : ''))

function closeModal(): void {
  modalStore.closePostModal()
  emit('close')
}

/** Обычный клик — страница поста в этом окне приложения; с Ctrl/Cmd — как у ссылки. */
function openAsPage(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  void router.push(pagePath.value)
}

// Из окна ушли на другую страницу (автор, тег, меншен, страница поста): окно
// закрывается, иначе оно оставалось висеть поверх новой страницы.
watch(
  () => route.fullPath,
  () => {
    if (!isModalOpen.value) return
    modalStore.closePostModal({ restoreScroll: false })
    emit('close')
  }
)

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
