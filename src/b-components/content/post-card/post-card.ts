import { defineComponent, type PropType } from 'vue'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import Card from '@/components/card/card.vue'
import PostModal from '@/b-components/content/post-modal/post-modal.vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { ImageGallery } from '@/components/image-gallery'
import StarRating from '@/b-components/content/post-card/components/star-rating/star-rating.vue'
import PostCardComments from '@/b-components/content/post-card/components/post-card-comments/post-card-comments.vue'
import Avatar from '@/components/avatar/avatar.vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import PostCardHeader from '@/b-components/content/post-card/components/post-card-header/post-card-header.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import PostCardContent from '@/b-components/content/post-card/components/post-card-content/post-card-content.vue'
import PostCardCategoriesTags from '@/b-components/content/post-card/components/post-card-categories-tags/post-card-categories-tags.vue'
import PostCardVideoPlaceholder from '@/b-components/content/post-card/components/post-card-video-placeholder/post-card-video-placeholder.vue'
import { getYoutubeEmbedUrls } from '@/helpers/common/youtube-url'
import {
  SC_PostCard,
  SC_PostTitle,
  SC_PostActions,
  SC_PostCardYoutube,
  SC_RepostInnerCard,
  SC_RepostOriginalAuthor,
  SC_RepostOriginalAuthorInfo,
  SC_RepostOriginalAuthorName,
  SC_RepostOriginalAuthorTime,
  SC_RepostDeleted
} from './styled'

interface PostAuthor {
  name: string
  address: string
  avatar?: string | null
  reputation: number
  letter: string
  verified?: boolean
  subscribers_count?: number
  subscribes_count?: number
}

interface Post {
  id?: string | number
  hash?: string // Хеш поста (share ID для upvote)
  txid?: string // ID транзакции (альтернатива hash)
  author: PostAuthor
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
  myVal?: number // Оценка текущего пользователя
  videoUrl?: string // URL видео в формате peertube://host/videoid
  preview?: string // Текст превью для статей
  lastComment?: {
    id: string
    address: string
    authorName: string
    avatar: string | null
    time: number
    message: string
    children: number
    scoreUp: number
    scoreDown: number
  }
  /** txid оригинальной записи, если это репост */
  repost?: string
  /** Автор оригинальной записи (если есть) */
  repostAuthor?: {
    name: string
    address: string
    avatar?: string | null
  }
  /** Время публикации оригинала (unix sec) */
  repostOriginalTimestamp?: number
  /** Оригинальная запись удалена */
  repostDeleted?: boolean
}

export const postCardOptions = defineComponent({
  name: 'PostCard',
  components: {
    Card,
    PostModal,
    VideoPlayer,
    ImageGallery,
    StarRating,
    PostCardComments,
    Avatar,
    DeleteOutlined,
    PostCardHeader,
    PostCardImages,
    PostCardContent,
    PostCardCategoriesTags,
    PostCardVideoPlaceholder,
    SC_PostCard,
    SC_PostTitle,
    SC_PostActions,
    SC_PostCardYoutube,
    SC_RepostInnerCard,
    SC_RepostOriginalAuthor,
    SC_RepostOriginalAuthorInfo,
    SC_RepostOriginalAuthorName,
    SC_RepostOriginalAuthorTime,
    SC_RepostDeleted
  },
  setup() {
    const modalStore = useModalStore()
    const postsStore = usePostsStore()
    return { modalStore, postsStore }
  },
  props: {
    post: {
      type: Object as PropType<Post>,
      required: true
    },
    /** Максимальная длина текста до сворачивания (символов) */
    maxLength: {
      type: Number,
      default: 500
    },
    /** Максимальное количество блоков до сворачивания */
    maxBlocks: {
      type: Number,
      default: 3
    },
    /** Показывать ли текст полностью (отключает сворачивание) */
    showFull: {
      type: Boolean,
      default: false
    },
    authorOverride: {
      type: Object as PropType<any>,
      default: null
    }
  },
  emits: ['like', 'comment', 'share'],
  mounted() {
    // Регистрируем пост в store
    if (this.post.id !== undefined) {
      this.postsStore.registerPost(this.post)
    }
  },
  data() {
    return {
      isCollapsed: true
    }
  },
  computed: {
    isRepost(): boolean {
      return !!(this.post.repost)
    },
    postId(): string {
      return this.post.txid || this.post.hash || String(this.post.id || '')
    },
    isModalOpen(): boolean {
      return this.modalStore.postModal.isOpen &&
             this.modalStore.postModal.post?.id === this.post.id
    },
    isImageGalleryOpen: {
      get(): boolean {
        return this.modalStore.imageGallery.isOpen &&
               this.modalStore.imageGallery.images === this.post.images
      },
      set(value: boolean): void {
        if (!value) {
          this.modalStore.closeImageGallery()
        }
      }
    },
    galleryIndex(): number {
      return this.modalStore.imageGallery.index
    },
    /**
     * Получает средний рейтинг в звёздах (0-5) - computed свойство для реактивности
     */
    averageRating(): number {
      // Используем ratingStars из поста, если есть
      if (this.post.ratingStars != null) {
        return this.post.ratingStars
      }
      // Если ratingStars нет, но есть scoreSum и scoreCnt, вычисляем
      if (this.post.scoreCnt && this.post.scoreCnt > 0 && this.post.scoreSum != null && this.post.scoreSum !== undefined) {
        const averageRating = this.post.scoreSum / this.post.scoreCnt
        return Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
      }
      return 0
    },
    /**
     * Декодированный заголовок поста (если был URL-encoded)
     */
    decodedTitle(): string {
      if (!this.post.title) return ''
      return this.decodeUrlEncoded(this.post.title)
    },
    /**
     * Ссылки на YouTube embed для отображения под контентом поста.
     * Не показываем YouTube-эмбеды, если пост уже содержит внутриплатформенное видео.
     */
    /** Форматированная дата оригинала для блока репоста */
    originalAuthorFormattedTime(): string {
      const ts = this.post.repostOriginalTimestamp
      if (ts == null) return ''
      const date = new Date(ts * 1000)
      if (isNaN(date.getTime())) return ''
      const now = new Date()
      const isCurrentYear = date.getFullYear() === now.getFullYear()
      const time = date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      const dayMonth = date.toLocaleString('ru-RU', { day: 'numeric', month: 'long' })
      return isCurrentYear ? `${dayMonth}, ${time}` : `${dayMonth} ${date.getFullYear()}, ${time}`
    },
    youtubeEmbedUrls(): string[] {
      if (!this.post) return []
      const hasInPlatformVideo =
        (this.post.type === 'video' || this.post.type === 'audio') &&
        !!this.post.videoUrl
      if (hasInPlatformVideo) return []
      const fromContent = getYoutubeEmbedUrls(this.post.content)
      const fromPreview = getYoutubeEmbedUrls(this.post.preview)
      const seen = new Set(fromContent)
      fromPreview.forEach((url) => seen.add(url))
      return Array.from(seen)
    }
  },
  methods: {
    /**
     * Декодирует URL-encoded строку, если она была закодирована
     * Проверяет, является ли строка URL-encoded (содержит %XX паттерны)
     */
    decodeUrlEncoded(str: string): string {
      if (!str || typeof str !== 'string') return str

      // Проверяем, содержит ли строка URL-encoded символы (паттерн %XX)
      const urlEncodedPattern = /%[0-9A-Fa-f]{2}/g
      const hasUrlEncoding = urlEncodedPattern.test(str)

      if (hasUrlEncoding) {
        try {
          // Пытаемся декодировать
          const decoded = decodeURIComponent(str)
          // Проверяем, что декодирование прошло успешно и результат не содержит нечитаемых символов
          // Если декодированная строка содержит много нечитаемых символов, возможно это не URL-encoding
          if (decoded && decoded !== str) {
            return decoded
          }
        } catch (e) {
          // Если декодирование не удалось, возвращаем исходную строку
          return str
        }
      }

      return str
    },
    /**
     * Закрывает модалку
     */
    closePostModal(): void {
      this.modalStore.closePostModal()
    },
    getInitial(nameOrLetter?: string): string {
      if (!nameOrLetter) return '?'
      // If it's already a single letter, return it
      if (nameOrLetter.length === 1) return nameOrLetter.toUpperCase()
      // Otherwise get first letter of name
      return nameOrLetter.charAt(0).toUpperCase()
    },
    closeImageGallery(): void {
      this.modalStore.closeImageGallery()
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
    },
    handleRatingChange(rating: number): void {
      // Обновляем локальное состояние поста при изменении рейтинга
      this.post.myVal = rating
    },
    handleRatingError(error: Error): void {
      // Обработка ошибок при отправке рейтинга
      console.error('Failed to submit rating:', error)
    },
    /**
     * При сворачивании комментариев скроллим к карточке поста
     */
    onCommentsCollapsed(): void {
      this.$nextTick(() => {
        const ref = this.$refs.postCardRef as { $el?: HTMLElement } | HTMLElement | undefined
        const el = ref && ('$el' in ref ? ref.$el : ref)
        if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
          (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  }
})
