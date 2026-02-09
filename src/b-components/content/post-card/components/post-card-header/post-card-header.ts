import { defineComponent, type PropType } from 'vue'
import Avatar from '@/components/avatar/avatar.vue'
import { BookOutlined, BookFilled, MessageOutlined } from '@ant-design/icons-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { isFavorite, addFavorite, removeFavorite } from '@/db/favorites-db'
import {
  SC_PostHeader,
  SC_PostAuthor,
  SC_PostAuthorInfo,
  SC_PostAuthorName,
  SC_AuthorNameRow,
  SC_PostAuthorRep,
  SC_PostTime,
  SC_ChatBtn,
  SC_PostBookmark,
  SC_AuthorLinkWrap
} from './styled'

export interface PostAuthor {
  name: string
  address: string
  avatar?: string | null
  reputation: number
  letter: string
  verified?: boolean
  subscribers_count?: number
  subscribes_count?: number
}

export interface PostHeaderPost {
  id?: string | number
  txid?: string
  hash?: string
  author: PostAuthor
  timestamp: string
}

export const postCardHeaderOptions = defineComponent({
  name: 'PostCardHeader',
  components: {
    Avatar,
    BookOutlined,
    BookFilled,
    MessageOutlined,
    SC_PostHeader,
    SC_PostAuthor,
    SC_PostAuthorInfo,
    SC_PostAuthorName,
    SC_AuthorNameRow,
    SC_PostAuthorRep,
    SC_PostTime,
    SC_ChatBtn,
    SC_PostBookmark,
    SC_AuthorLinkWrap
  },
  props: {
    post: {
      type: Object as PropType<PostHeaderPost>,
      required: true
    },
    authorOverride: {
      type: Object as PropType<any>,
      default: null
    }
  },
  mounted() {
    this.checkBookmarkStatus()
  },
  data() {
    return {
      isBookmarked: false
    }
  },
  watch: {
    post: {
      handler() {
        this.checkBookmarkStatus()
      },
      deep: true
    }
  },
  computed: {
    postId(): string {
      return this.post.txid || this.post.hash || String(this.post.id || '')
    },
    formattedReputation(): string {
      const rep = this.displayAuthor.reputation || 0
      if (Math.abs(rep) < 1000) {
        return rep.toString()
      }
      const val = rep / 1000
      const rounded = Math.round(val * 10) / 10
      return `${rounded}K`
    },
    displayAuthor(): PostAuthor {
      const defaultAuthor = this.post?.author || {
        name: 'Unknown',
        address: '',
        avatar: null,
        reputation: 0,
        letter: '?',
        verified: false
      }

      if (this.authorOverride && this.authorOverride.name) {
        return {
          ...defaultAuthor,
          name: this.authorOverride.name,
          address: this.authorOverride.address || defaultAuthor.address,
          avatar: this.authorOverride.avatar || defaultAuthor.avatar,
          reputation: this.authorOverride.reputation !== undefined ? this.authorOverride.reputation : defaultAuthor.reputation,
          letter: this.authorOverride.letter || defaultAuthor.letter,
          verified: this.authorOverride.verified !== undefined ? this.authorOverride.verified : defaultAuthor.verified
        }
      }
      return defaultAuthor
    }
  },
  methods: {
    async startChatWithAuthor(event: Event) {
      event.preventDefault()
      event.stopPropagation()
      const address = this.displayAuthor?.address
      if (!address) return
      try {
        const messengerStore = useMessengerStore()
        const preloadedProfile = {
          address,
          name: this.displayAuthor?.name,
          i: this.displayAuthor?.avatar || undefined,
          reputation: this.displayAuthor?.reputation,
          subscribers_count: this.displayAuthor?.subscribers_count,
          subscribes_count: this.displayAuthor?.subscribes_count,
          hash: '',
          id: 0
        }
        await messengerStore.openInviteWithAddress(address, preloadedProfile)
      } catch (e) {
        console.error('[PostCardHeader] Failed to open chat:', e)
      }
    },
    async checkBookmarkStatus() {
      if (!this.postId) return
      this.isBookmarked = await isFavorite(this.postId)
    },
    async toggleBookmark(event: Event) {
      event.preventDefault()
      event.stopPropagation()
      if (!this.postId) return
      if (this.isBookmarked) {
        await removeFavorite(this.postId)
        this.isBookmarked = false
      } else {
        await addFavorite(this.postId)
        this.isBookmarked = true
      }
    },
    formatTime(timestamp: string): string {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return ''
      const now = new Date()
      const isCurrentYear = date.getFullYear() === now.getFullYear()
      const time = date.toLocaleString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })
      const dayMonth = date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long'
      })
      if (isCurrentYear) {
        return `${dayMonth}, ${time}`
      }
      const year = date.getFullYear()
      return `${dayMonth} ${year}, ${time}`
    }
  }
})
