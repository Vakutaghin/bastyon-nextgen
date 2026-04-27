import { defineComponent, computed, ref } from 'vue'
import { Dropdown, Menu, Badge } from 'ant-design-vue'
import { HourglassOutlined } from '@ant-design/icons-vue'
import { SC_EventsWrapper } from './styled'
import { useAuthStore } from '@/blockchain'
import { usePendingRatingsStore, useCommentsStore, usePostsStore } from '@/stores'

type RatingPendingItem = {
  kind: 'rating'
  key: string
  shareId: string
  ratingValue: number
  postTitle?: string
}

type CommentPendingItem = {
  kind: 'comment'
  key: string
  postId: string
  message: string
  postTitle?: string
}

export type PendingHeaderItem = RatingPendingItem | CommentPendingItem

export const headerEventsOptions = defineComponent({
  name: 'HeaderEvents',
  components: {
    Dropdown,
    Menu,
    Badge,
    HourglassOutlined,
    SC_EventsWrapper,
  },
  setup() {
    const authStore = useAuthStore()
    const pendingStore = usePendingRatingsStore()
    const commentsStore = useCommentsStore()
    const postsStore = usePostsStore()
    pendingStore.init()
    const pendingCount = computed(() => pendingStore.count + commentsStore.pendingCount)

    const visible = ref(false)

    return { authStore, pendingStore, commentsStore, postsStore, pendingCount, visible }
  },
  computed: {
    isAuthenticated() {
      return this.authStore.isUserAuthenticated
    },
    pendingItems(): PendingHeaderItem[] {
      const items: PendingHeaderItem[] = []

      const keys = Array.from(this.pendingStore.items.keys())
      keys.forEach((k) => {
        const item = this.pendingStore.getPendingItem(k)
        if (item) {
          items.push({
            kind: 'rating',
            key: `rating:${item.shareId}`,
            shareId: item.shareId,
            ratingValue: item.ratingValue,
            postTitle: item.postTitle,
          })
        }
      })

      const pendingComments = this.commentsStore.allPending
      pendingComments.forEach((c) => {
        const post = this.postsStore.getPostByShareId(c.postId)
        const title = (post && post.title) || undefined
        items.push({
          kind: 'comment',
          key: `comment:${c.id}`,
          postId: c.postId,
          message: c.message,
          postTitle: title,
        })
      })

      return items
    },
    menuItems() {
      // Deprecated, kept for compatibility if needed, but we use custom template now
      const items: any[] = []
      return items
    }
  }
})
