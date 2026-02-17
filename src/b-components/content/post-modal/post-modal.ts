import { defineComponent, defineAsyncComponent, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import Modal from '@/components/modal/modal.vue'
import {
  SC_PostModalWrapper,
  SC_PostModalContent
} from './styled'

const PostCard = defineAsyncComponent(() => import('@/b-components/content/post-card/post-card.vue'))

interface Post {
  id?: string | number
  author: {
    name: string
    avatar?: string | null
    reputation: number
    letter: string
  }
  title?: string
  content?: string
  timestamp: string
  likes?: number
  comments?: number
  shares?: number
  tags?: string[]
  type?: string
  category?: string
  images?: string[]
  ratingStars?: number
  scoreCnt?: number
  scoreSum?: number
}

export const postModalOptions = defineComponent({
  name: 'PostModal',
  components: {
    Modal,
    PostCard,
    SC_PostModalWrapper,
    SC_PostModalContent
  },
  props: {
    /** Почти на всю ширину экрана. По умолчанию true для модалки поста. */
    fullWidth: {
      type: Boolean,
      default: true
    }
  },
  emits: ['close', 'like', 'comment', 'share'],
  setup() {
    const modalStore = useModalStore()
    const postsStore = usePostsStore()
    const { postModal } = storeToRefs(modalStore)
    const isModalOpen = computed(() => postModal.value.isOpen)
    const postData = computed(() => postModal.value.post)
    return {
      modalStore,
      postsStore,
      isModalOpen,
      postData
    }
  },
  methods: {
    closeModal(): void {
      this.modalStore.closePostModal()
      this.$emit('close')
    },
    handleLike(postId: string | number): void {
      this.postsStore.likePost(postId)
      this.$emit('like', postId)
    },
    handleComment(postId: string | number): void {
      this.postsStore.commentPost(postId)
      this.$emit('comment', postId)
    },
    handleShare(postId: string | number): void {
      this.postsStore.sharePost(postId)
      this.$emit('share', postId)
    }
  }
})
