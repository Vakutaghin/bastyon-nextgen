import { defineComponent, defineAsyncComponent, type PropType } from 'vue'
import { useModalStore } from '@/stores/modal-store'
import { Modal as AModal } from 'ant-design-vue'
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
    'a-modal': AModal,
    PostCard,
    SC_PostModalWrapper,
    SC_PostModalContent
  },
  setup() {
    const modalStore = useModalStore()
    return { modalStore }
  },
  props: {
    /** Открыта ли модалка */
    isOpen: {
      type: Boolean,
      default: false
    },
    /** Данные поста для отображения */
    post: {
      type: Object as PropType<Post | null>,
      default: null
    }
  },
  emits: ['close', 'like', 'comment', 'share'],
  watch: {
    isOpen(newVal) {
      if (newVal && this.post) {
        this.modalStore.openPostModal(this.post)
      } else if (!newVal) {
        this.modalStore.closePostModal()
      }
    },
    post: {
      handler(newVal) {
        if (newVal && this.isOpen) {
          this.modalStore.openPostModal(newVal)
        }
      },
      immediate: true
    }
  },
  computed: {
    isModalOpen: {
      get(): boolean {
        return this.modalStore.postModal.isOpen
      },
      set(value: boolean): void {
        if (!value) {
          this.closeModal()
        }
      }
    },
    postData(): Post | null {
      return this.modalStore.postModal.post
    }
  },
  methods: {
    closeModal(): void {
      this.modalStore.closePostModal()
      this.$emit('close')
    },
    handleLike(postId: string | number): void {
      this.$emit('like', postId)
    },
    handleComment(postId: string | number): void {
      this.$emit('comment', postId)
    },
    handleShare(postId: string | number): void {
      this.$emit('share', postId)
    }
  }
})
