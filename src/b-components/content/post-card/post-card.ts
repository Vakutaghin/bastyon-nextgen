import { defineComponent, type PropType } from 'vue'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import { useFiltersStore } from '@/stores/filters-store'
import { getByPRC } from '@/helpers/api/request'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import Card from '@/components/card/card.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Tag from '@/components/tag/tag.vue'
import Button from '@/components/button/button.vue'
import BlockContent from '@/b-components/content/block-content/block-content.vue'
import PostModal from '@/b-components/content/post-modal/post-modal.vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { ImageGallery } from '@/components/image-gallery'
import StarRating from '@/b-components/content/post-card/components/star-rating/star-rating.vue'
import { categoriesData } from '@/b-components/sidebar/sidebar-categories/categories-data'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import {
  PlayCircleFilled,
  ZoomInOutlined,
  BookOutlined,
  BookFilled,
  MessageOutlined
} from '@ant-design/icons-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import {
  SC_PostCard,
  SC_PostHeader,
  SC_PostImage,
  SC_ImageWrapper,
  SC_ImageOverlay,
  SC_ZoomIconCircle,
  SC_VideoPlaceholder,
  SC_PostTitle,
  SC_PostAuthor,
  SC_PostAuthorInfo,
  SC_PostAuthorName,
  SC_AuthorNameRow,
  SC_PostAuthorRep,
  SC_PostTime,
  SC_PostContent,
  SC_PostPreview,
  SC_PostCategoriesAndTags,
  SC_PostActions,
  SC_CommentsPreview,
  SC_CommentItem,
  SC_CommentAuthor,
  SC_CommentText,
  SC_CommentContent,
  SC_CommentMeta,
  SC_CommentDate,
  SC_CommentActions,
  SC_ChatBtn,
  SC_ShowCommentsBtn,
  SC_ShowCommentsBtnSecondary,
  SC_ShowCommentsBtnCollapse,
  SC_PostBookmark,
  SC_AuthorLinkWrap
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
}

import { editorjsToHtml } from '@/helpers/content/editorjs-parser'
import { isFavorite, addFavorite, removeFavorite } from '@/db/favorites-db'

export const postCardOptions = defineComponent({
  name: 'PostCard',
  components: {
    Card,
    Avatar,
    Tag,
    Button,
    BlockContent,
    PostModal,
    VideoPlayer,
    ImageGallery,
    StarRating,
    PlayCircleFilled,
    ZoomInOutlined,
    BookOutlined,
    BookFilled,
    MessageOutlined,
    SC_PostCard,
    SC_PostHeader,
    SC_PostAuthor,
    SC_PostAuthorInfo,
    SC_PostAuthorName,
    SC_AuthorNameRow,
    SC_PostAuthorRep,
    SC_PostTime,
    SC_PostImage,
    SC_ImageWrapper,
    SC_ImageOverlay,
    SC_ZoomIconCircle,
    SC_VideoPlaceholder,
    SC_PostTitle,
    SC_PostContent,
    SC_PostPreview,
    SC_PostCategoriesAndTags,
    SC_PostActions,
    SC_CommentsPreview,
    SC_CommentItem,
    SC_CommentAuthor,
    SC_CommentText,
    SC_CommentContent,
    SC_CommentMeta,
    SC_CommentDate,
    SC_CommentActions,
    SC_ChatBtn,
    SC_ShowCommentsBtn,
    SC_ShowCommentsBtnSecondary,
    SC_ShowCommentsBtnCollapse,
    SC_PostBookmark,
    SC_AuthorLinkWrap
  },
  setup() {
    const modalStore = useModalStore()
    const postsStore = usePostsStore()
    const filtersStore = useFiltersStore()
    return { modalStore, postsStore, filtersStore }
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
    this.checkBookmarkStatus()
  },
  data() {
    return {
      isCollapsed: true,
      isBookmarked: false,
      // Хранит информацию о соотношении сторон для каждого изображения
      imageAspectRatios: {} as Record<number, { width: number; height: number; useContain: boolean }>,
      /** Подгруженные комментарии поста (полный ответ бэкенда) */
      allComments: null as GetComment[] | null,
      allCommentsLoading: false,
      allCommentsError: null as Error | null,
      /** Сколько комментариев показывать (пагинация на фронте по 15) */
      visibleCommentsCount: 0,
      /** Комментарии развёрнуты (false = компактный вид: один превью + кнопка) */
      commentsCollapsed: false
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
     * Отформатированная репутация автора
     * До 1000 - число
     * После 1000 - 1K, 5.5K, 206.7K (макс 1 знак после точки)
     */
    formattedReputation(): string {
      const rep = this.displayAuthor.reputation || 0
      if (Math.abs(rep) < 1000) {
        return rep.toString()
      }
      const val = rep / 1000
      const rounded = Math.round(val * 10) / 10
      return `${rounded}K`
    },
    /**
     * Количество изображений в посте
     */
    imageCount(): number {
      return this.post.images ? this.post.images.length : 0
    },
    /**
     * Проверяет, является ли контент структурой блоков (Editor.js формат)
     */
    isBlockContent(): boolean {
      if (!this.post.content) {
        return false
      }

      try {
        // Пытаемся распарсить контент
        const parsed = typeof this.post.content === 'string'
          ? JSON.parse(this.post.content)
          : this.post.content

        // Проверяем наличие поля blocks с массивом
        return parsed &&
               typeof parsed === 'object' &&
               Array.isArray(parsed.blocks) &&
               parsed.blocks.length > 0
      } catch {
        // Если не JSON, значит обычный текст
        return false
      }
    },
    /**
     * Нужно ли сворачивать контент
     */
    shouldCollapse(): boolean {
      // Если showFull = true, никогда не сворачиваем
      if (this.showFull) {
        return false
      }

      if (!this.post.content) {
        return false
      }

      if (this.isBlockContent) {
        try {
          const parsed = typeof this.post.content === 'string'
            ? JSON.parse(this.post.content)
            : this.post.content

          // Сворачиваем если блоков больше maxBlocks
          return parsed.blocks && parsed.blocks.length > this.maxBlocks
        } catch {
          return false
        }
      } else {
        // Для обычного текста проверяем длину
        return String(this.post.content).length > this.maxLength
      }
    },
    /**
     * Обрезанный текст для предпросмотра
     */
    truncatedText(): string {
      if (!this.post.content) return ''
      const text = String(this.post.content)
      if (text.length <= this.maxLength) return text
      return text.substring(0, this.maxLength) + '...'
    },
    /**
     * Обрезанный контент блоков для предпросмотра
     */
    truncatedBlockContent(): string | null {
      if (!this.isBlockContent) return null

      try {
        const parsed = typeof this.post.content === 'string'
          ? JSON.parse(this.post.content)
          : this.post.content

        if (!parsed.blocks || parsed.blocks.length <= this.maxBlocks) {
          return this.post.content || null
        }

        // Берем только первые maxBlocks блоков
        const truncated = {
          ...parsed,
          blocks: parsed.blocks.slice(0, this.maxBlocks)
        }

        return JSON.stringify(truncated)
      } catch {
        return this.post.content || null
      }
    },
    /**
     * Форматированный текст для отображения (если не BlockContent)
     * Теперь поддерживает и Editor.js структуру, преобразуя её в HTML
     */
    formattedPlainText(): string {
      return editorjsToHtml(this.post.content || '')
    },

    /**
     * Форматированный текст превью
     * Если превью - это JSON Editor.js, то парсим его
     * Если обычный текст - форматируем
     */
    formattedPreview(): string {
      const preview = this.post.preview

      if (!preview) return ''

      // Для статей используем ограничение в 300 символов
      const MAX_PREVIEW_LENGTH = 300

      // Проверяем, похоже ли на JSON Editor.js
      const trimmed = preview.trim()
      let html = ''

      if (trimmed.startsWith('{"blocks":')) {
        try {
          // Проверяем валидность JSON перед передачей в editorjsToHtml
          JSON.parse(preview)
          html = editorjsToHtml(preview)
        } catch (e) {
          // Если JSON битый, editorjsToHtml попробует его восстановить через Regex
          html = editorjsToHtml(preview)
        }
      } else {
        // Если это обычный текст
        html = editorjsToHtml(preview)
      }

      // Если это HTML, нам нужно обрезать текст, но сохранить структуру тегов
      // Для простоты, мы можем обрезать текст до форматирования, если это обычный текст
      // Или использовать временный элемент для извлечения текста

      // Временное решение: удаляем HTML теги, обрезаем, и возвращаем как текст (или пытаемся сохранить)
      // Но лучше просто обрезать визуальный текст.

      // Создаем временный div для парсинга HTML и получения текста
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      let textContent = tempDiv.textContent || tempDiv.innerText || ''

      if (textContent.length > MAX_PREVIEW_LENGTH) {
        textContent = textContent.substring(0, MAX_PREVIEW_LENGTH) + '...'
        // Возвращаем как обычный текст, отформатированный в параграфы, так как обрезать HTML сложно
        // Используем editorjsToHtml для форматирования обычного текста (ссылки и т.д.)
        return editorjsToHtml(textContent)
      }

      return html
    },
    /**
     * Отформатированный обрезанный текст с преобразованными bastyon:// ссылками
     * Переносы строк (\n и <br />) преобразуются в параграфы <p>
     */
    formattedTruncatedText(): string {
      if (!this.post.content) return ''

      // Для статей используем ограничение в 300 символов
      const MAX_PREVIEW_LENGTH = 300

      // Для статей пытаемся распарсить как Editor.js и вернуть HTML
      // Это fallback на случай, если isBlockContent вернул false (например, из-за структуры),
      // но контент всё равно содержит JSON
      if (this.post.type === 'article') {
        let html = ''
        try {
          const parsed = typeof this.post.content === 'string'
            ? JSON.parse(this.post.content)
            : this.post.content

          if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) {
            // Обрезаем блоки, как в truncatedBlockContent
            // Но также применяем ограничение по символам
            const sliced = {
              ...parsed,
              blocks: parsed.blocks.slice(0, this.maxBlocks)
            }
            html = editorjsToHtml(sliced)
          }
        } catch (e) {
          // Если парсинг не удался, пробуем editorjsToHtml напрямую
        }

        if (!html) {
          html = editorjsToHtml(this.post.content)
        }

        // Если результат похож на HTML, возвращаем его
        if (html.trim().startsWith('<')) {
           // Применяем обрезку по символам
           const tempDiv = document.createElement('div')
           tempDiv.innerHTML = html
           let textContent = tempDiv.textContent || tempDiv.innerText || ''

           if (textContent.length > MAX_PREVIEW_LENGTH) {
             textContent = textContent.substring(0, MAX_PREVIEW_LENGTH) + '...'
             return editorjsToHtml(textContent)
           }
           return html
        }
      }

      let text = String(this.post.content)
      if (text.length > this.maxLength) {
        text = text.substring(0, this.maxLength) + '...'
      }

      // Преобразуем <br />, <br/>, <br> в \n для унификации
      text = text.replace(/<br\s*\/?>/gi, '\n')

      // Разбиваем по \n и оборачиваем каждую строку в <p>
      const lines = text.split('\n').filter((line) => line.trim() !== '')
      if (lines.length === 0) return ''

      return lines.map((line) => `<p>${formatBastyonLinks(line)}</p>`).join('')
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
     * Декодированные теги поста (если были URL-encoded)
     */
    decodedTags(): string[] {
      if (!this.post.tags || !Array.isArray(this.post.tags)) return []
      return this.post.tags.map(tag => this.decodeUrlEncoded(tag))
    },
    /**
     * Список элементов для отображения (категории + теги)
     */
    displayItems(): any[] {
      const tags = this.decodedTags
      if (!tags || tags.length === 0) return []

      const uniqueTags = Array.from(new Set(tags))
      const categories: any[] = []
      const remainingTags: any[] = []

      // Используем все категории из стора (включая кастомные и временные)
      const allCategories = this.filtersStore.allCategories

      // Находим категории
      for (const cat of allCategories) {
        // Проверяем, есть ли теги категории в тегах поста
        const matchingTags = cat.tags.filter(catTag =>
          uniqueTags.some(postTag => postTag.toLowerCase() === catTag.toLowerCase())
        )

        if (matchingTags.length > 0) {
          categories.push({
            type: 'category',
            id: cat.id,
            name: cat.name,
            icon: cat.icon
          })
        }
      }

      // Находим оставшиеся теги (те, которые не относятся ни к одной категории)
      uniqueTags.forEach(tag => {
        const isCategoryTag = allCategories.some(cat =>
          cat.tags.includes(tag.toLowerCase())
        )

        if (!isCategoryTag) {
          remainingTags.push({
            type: 'tag',
            name: tag
          })
        }
      })

      return [...categories, ...remainingTags]
    },
    /**
     * Текст кнопки "Показать полностью"
     */
    readMoreLabel(): string {
      return (this.post.type === 'article') ? 'Читать статью' : 'Показать полностью'
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
    },
    hasUserComments(): boolean {
      const lc = this.post.lastComment
      const cnt = this.post.comments || 0
      return !!lc && !!lc.message && cnt > 0
    },
    lastCommentMessageHtml(): string {
      const text = this.post.lastComment?.message || ''
      return formatBastyonLinks(text)
    },
    lastCommentProfileLink(): string {
      const lc = this.post.lastComment
      if (!lc) return '/'
      const name = (lc.authorName || '').toLowerCase()
      const address = lc.address || ''
      if (address) return '/' + address
      if (name) return '/' + name
      return '/'
    },
    lastCommentAvatarUrl(): string | null {
      const img = this.post.lastComment?.avatar || null
      if (!img) return null
      if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
        return img.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      }
      return `https://pocketnet.app:8092/i/${img}`
    },
    lastCommentInitial(): string {
      const name = this.post.lastComment?.authorName || ''
      return this.getInitial(name)
    },
    lastCommentDateOnly(): string {
      const t = this.post.lastComment?.time || 0
      if (!t) return ''
      const d = new Date(t * 1000)
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    },
    /** Общее количество комментариев поста (из данных поста) */
    totalCommentsCount(): number {
      return this.post.comments ?? 0
    },
    /** Фактическое количество комментариев из ответа API (без заблокированных и т.п.) */
    actualCommentsCount(): number {
      return this.allComments?.length ?? 0
    },
    /** Комментарии, видимые сейчас (первые visibleCommentsCount из allComments) */
    visibleComments(): GetComment[] {
      if (!this.allComments) return []
      return this.allComments.slice(0, this.visibleCommentsCount)
    },
    /** Сколько комментариев ещё не показано */
    remainingCommentsCount(): number {
      const total = this.actualCommentsCount
      return Math.max(0, total - this.visibleCommentsCount)
    },
    /** Число для кнопки "Показать следующие N" (15 или остаток) */
    nextCommentsPageSize(): number {
      const remaining = this.remainingCommentsCount
      return remaining <= 0 ? 0 : Math.min(15, remaining)
    },
    /** Показывать ли кнопку "Показать следующие N" */
    hasMoreCommentsToShow(): boolean {
      return this.remainingCommentsCount > 0
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
        console.error('[PostCard] Failed to open chat:', e)
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
     * Открывает модалку с полным постом
     */
    openPostModal(event?: Event): void {
      // Предотвращаем любое стандартное поведение и всплытие события
      if (event) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (event.cancelBubble !== undefined) {
          event.cancelBubble = true
        }
      }

      // Используем store для открытия модалки
      this.modalStore.openPostModal(this.post)
    },
    /**
     * Закрывает модалку
     */
    closePostModal(): void {
      this.modalStore.closePostModal()
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
      } else {
        const year = date.getFullYear()
        return `${dayMonth} ${year}, ${time}`
      }
    },
    getInitial(nameOrLetter?: string): string {
      if (!nameOrLetter) return '?'
      // If it's already a single letter, return it
      if (nameOrLetter.length === 1) return nameOrLetter.toUpperCase()
      // Otherwise get first letter of name
      return nameOrLetter.charAt(0).toUpperCase()
    },
    handleImageError(event: Event): void {
      // Скрываем изображение при ошибке загрузки
      const target = event.target as HTMLImageElement
      if (target) {
        target.style.display = 'none'
      }
    },
    handleImageLoad(event: Event, imageIndex: number): void {
      const target = event.target as HTMLImageElement
      if (!target) return

      const naturalWidth = target.naturalWidth
      const naturalHeight = target.naturalHeight

      if (naturalWidth === 0 || naturalHeight === 0) return

      // Вычисляем соотношение сторон (width/height)
      const aspectRatio = naturalWidth / naturalHeight
      // Если соотношение больше чем 1:1.5 (т.е. width/height > 1/1.5 или > 0.667)
      // То используем contain, иначе cover
      const useContain = aspectRatio > (1 / 1.5)

      // Сохраняем информацию о соотношении сторон
      this.imageAspectRatios[imageIndex] = {
        width: naturalWidth,
        height: naturalHeight,
        useContain
      }

      // Старая логика для ограничения высоты при соотношении сторон > 2:1 (только для одного изображения)
      if (this.imageCount === 1 && naturalHeight > naturalWidth * 2) {
        target.style.aspectRatio = '1 / 2'
        target.style.maxHeight = '500px'
      }
    },
    /**
     * Возвращает стили для обёртки изображения
     */
    getImageWrapperStyle(imageIndex: number): Record<string, string> {
      const imageInfo = this.imageAspectRatios[imageIndex]
      if (imageInfo && imageInfo.useContain) {
        // Если используем contain, добавляем светло-серый фон
        return {
          backgroundColor: '#f5f5f5'
        }
      }
      return {}
    },
    /**
     * Возвращает стили для изображения
     */
    getImageStyle(imageIndex: number): Record<string, string> {
      const imageInfo = this.imageAspectRatios[imageIndex]
      if (imageInfo && imageInfo.useContain) {
        return {
          objectFit: 'contain'
        }
      }
      return {
        objectFit: 'cover'
      }
    },
    openImageGallery(index: number): void {
      if (this.post.images && this.post.images.length > 0) {
        this.modalStore.openImageGallery(this.post.images, index)
      }
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
      // Можно показать уведомление пользователю
    },
    /**
     * Обработка клика по тегу или категории в посте.
     * Реализует логику фильтрации ленты по клику на элемент.
     *
     * @param item Объект тега или категории { type: 'category'|'tag', id?: string, name: string }
     */
    handleTagClick(item: any) {
      if (item.type === 'category') {
        // Если это уже существующая категория (системная или кастомная),
        // просто переключаем её выбор в фильтре.
        this.filtersStore.toggleCategorySelection(item.id)
      } else {
        // Если это обычный тег (не привязан к категории),
        // создаем временную категорию (которая исчезнет при перезагрузке)
        // и автоматически выбираем её.
        this.filtersStore.addTemporaryCategory(item.name)
      }
    },
    /**
     * Подгружает все комментарии поста через /rpc/getcomments
     */
    /**
     * @param showAll — если true, после загрузки показать все комментарии сразу; иначе первые 15
     */
    async loadAllComments(showAll = false): Promise<void> {
      if (!this.postId || this.allCommentsLoading) return
      this.allCommentsLoading = true
      this.allCommentsError = null
      try {
        const res = await getByPRC({
          method: 'getcomments',
          parameters: [this.postId, '', ''],
          options: { auth: false }
        })
        const typed = res as GetCommentsResponse
        if (typed.result === 'success' && Array.isArray(typed.data)) {
          this.allComments = typed.data
          this.visibleCommentsCount = showAll ? typed.data.length : Math.min(15, typed.data.length)
          this.commentsCollapsed = false
        }
      } catch (e) {
        this.allCommentsError = e instanceof Error ? e : new Error(String(e))
      } finally {
        this.allCommentsLoading = false
      }
    },
    /**
     * Свернуть комментарии в компактный вид (один превью + кнопка)
     * и проскроллить к верху поста, чтобы не теряться в ленте
     */
    collapseComments(): void {
      this.commentsCollapsed = true
      this.$nextTick(() => {
        const ref = this.$refs.postCardRef as { $el?: HTMLElement } | HTMLElement | undefined
        const el = ref && ('$el' in ref ? ref.$el : ref)
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    },
    /**
     * Развернуть комментарии (показать список из уже загруженных)
     */
    expandComments(): void {
      this.commentsCollapsed = false
    },
    /**
     * Показать следующую порцию комментариев (по 15)
     */
    showMoreComments(): void {
      if (!this.allComments) return
      this.visibleCommentsCount = Math.min(
        this.visibleCommentsCount + 15,
        this.allComments.length
      )
    },
    /**
     * Показать все комментарии сразу
     */
    showAllComments(): void {
      if (!this.allComments) return
      this.visibleCommentsCount = this.allComments.length
    },
    /**
     * Извлекает текст сообщения из поля msg комментария (JSON)
     */
    getCommentMessageText(comment: GetComment): string {
      try {
        const parsed = JSON.parse(comment.msg) as { message?: string }
        return parsed?.message ?? comment.msg
      } catch {
        return comment.msg
      }
    },
    /**
     * URL аватара автора комментария из getcomments
     */
    getCommentAvatarUrl(profile: GetComment['userprofile']): string | null {
      const i = profile?.i
      if (!i) return null
      if (typeof i === 'string' && (i.startsWith('http://') || i.startsWith('https://'))) {
        return i.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      }
      return `https://pocketnet.app:8092/i/${i}`
    },
    /**
     * Форматированная дата комментария (time — unix timestamp)
     */
    formatCommentDate(time: number): string {
      if (!time) return ''
      const d = new Date(time * 1000)
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    },
    /**
     * Ссылка на профиль автора комментария
     */
    getCommentProfileLink(comment: GetComment): string {
      const name = (comment.userprofile?.name || '').toLowerCase()
      const address = comment.address || ''
      if (address) return '/' + address
      if (name) return '/' + name
      return '/'
    },
    /**
     * HTML сообщения комментария (с форматированием ссылок)
     */
    formatCommentMessageHtml(comment: GetComment): string {
      return formatBastyonLinks(this.getCommentMessageText(comment))
    }
  }
})
