import { defineStore } from 'pinia'
import { useQueryClient } from '@tanstack/vue-query'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import { useFiltersStore } from './filters-store'

/**
 * @deprecated Используйте composables из @/composables вместо этого store
 * Например: useHierarchicalStrip, useTopFeed, useProfileFeed
 *
 * Этот store оставлен для обратной совместимости.
 * Все запросы теперь управляются через Vue Query.
 */

interface AdaptedPost {
  id: string | number
  hash?: string // Хеш поста (share ID для upvote)
  txid?: string // ID транзакции (альтернатива hash)
  author: {
    name: string
    address: string
    avatar: string | null
    reputation: number
    letter: string
    subscribers_count?: number
    subscribes_count?: number
  }
  title: string
  content: string
  timestamp: string
  likes: number
  comments: number
  shares: number
  tags: string[]
  type: string
  category: string
  images: string[]
  ratingStars: number
  scoreCnt: number
  scoreSum?: number
  videoUrl?: string
}

export const useFeedStore = defineStore('feed', {
  state: () => ({
    feedData: null as GetTopFeedResponse | GetHierarchicalStripResponse | null,
    posts: [] as AdaptedPost[],
    loading: false,
    error: null as string | null,
    scrollPosition: 0,
    cachedPostsData: null as AdaptedPost[] | null,
    cachedFeedDataHash: null as string | null
  }),

  getters: {
    /**
     * Получает адаптированные посты из feedData
     */
    postsData(): AdaptedPost[] {
      if (!this.feedData) {
        this.cachedPostsData = null
        this.cachedFeedDataHash = null
        return []
      }

      // Создаем простой хеш для проверки изменений
      // Включаем в хеш также активные фильтры для инвалидации при изменении сортировки
      const filtersStore = useFiltersStore()
      const feedDataHash = JSON.stringify({
        feedData: this.feedData,
        orderby: filtersStore.orderby,
        ascdesc: filtersStore.ascdesc
      })

      // Если данные не изменились, возвращаем кешированные
      if (this.cachedPostsData && this.cachedFeedDataHash === feedDataHash) {
        return this.cachedPostsData
      }

      let rawPosts: any[] = []

      // API может возвращать данные в разных форматах
      if (Array.isArray(this.feedData)) {
        rawPosts = this.feedData
      } else if (this.feedData.data && this.feedData.data.contents && Array.isArray(this.feedData.data.contents)) {
        rawPosts = this.feedData.data.contents
      } else if (this.feedData.data && Array.isArray(this.feedData.data)) {
        rawPosts = this.feedData.data
      } else if (this.feedData.result && Array.isArray(this.feedData.result)) {
        rawPosts = this.feedData.result
      } else if ((this.feedData as any).posts && Array.isArray((this.feedData as any).posts)) {
        rawPosts = (this.feedData as any).posts
      } else if ((this.feedData as any).contents && Array.isArray((this.feedData as any).contents)) {
        rawPosts = (this.feedData as any).contents
      } else {
        this.cachedPostsData = null
        this.cachedFeedDataHash = null
        return []
      }

      // Преобразуем данные API в формат, ожидаемый PostCard
      const adapted = rawPosts.map((post, index) => this.adaptPostData(post, index))

      // Применяем сортировку на основе активных фильтров
      const sorted = this.applySorting(adapted)

      // Кешируем результат
      this.cachedPostsData = sorted
      this.cachedFeedDataHash = feedDataHash

      return sorted
    }
  },

  actions: {
    /**
     * Адаптирует данные поста из API в формат компонента
     */
    adaptPostData(post: any, index: number): AdaptedPost {
      const authorName = post.userprofile?.name ||
                        post.address ||
                        'Неизвестный автор'

      const avatar = post.userprofile?.i || null
      const reputation = post.userprofile?.reputation || 0
      const title = post.c || ''
      const content = post.m || ''
      const timestamp = post.time
        ? new Date(post.time * 1000).toISOString()
        : new Date().toISOString()
      const likes = post.scoreCnt || 0
      const comments = post.comments || 0
      const shares = post.reposted || 0
      const tags = Array.isArray(post.t) ? post.t : []
      const images = Array.isArray(post.i) ? post.i : []
      const videoUrl = post.u || post.s?.v || undefined

      let ratingStars = 0
      if (post.scoreCnt > 0 && post.scoreSum !== undefined && post.scoreSum !== null) {
        const averageRating = post.scoreSum / post.scoreCnt
        ratingStars = Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
      }

      return {
        id: post.id || post.txid || post.hash || index,
        hash: post.hash || post.txid || post.id,
        txid: post.txid || post.hash || post.id,
        author: {
          name: authorName,
          address: post.address || '',
          avatar: avatar,
          reputation: reputation,
          verified: Array.isArray(post.userprofile?.badges)
        ? (post.userprofile.badges as any[]).includes('verificated') ||
          (post.userprofile.badges as any[]).includes('verified')
        : (() => {
            const flags = (post.userprofile as any)?.flags
            const real = (flags && (flags as any).real) ?? (post.userprofile as any)?.real
            return real === 1 || real === '1' || real === true || real === 'true'
          })(),
          letter: authorName.charAt(0).toUpperCase(),
          subscribers_count: post.userprofile?.subscribers_count,
          subscribes_count: post.userprofile?.subscribes_count
        },
        title: title,
        content: content,
        timestamp: timestamp,
        likes: likes,
        comments: comments,
        shares: shares,
        tags: tags,
        type: post.type || '',
        category: post.type || '',
        images: images,
        ratingStars: ratingStars,
        scoreCnt: post.scoreCnt || 0,
        scoreSum: post.scoreSum,
        videoUrl: videoUrl
      }
    },

    /**
     * Загружает hierarchical strip
     * @deprecated Используйте useHierarchicalStrip из @/composables
     *
     * Этот метод теперь использует Vue Query для кэширования.
     * Для инвалидации кэша используйте queryClient.invalidateQueries(['feed'])
     */
    async loadHierarchicalStrip(offset: number = 0, limit: number = 20): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // Используем Vue Query для получения данных
        const queryClient = useQueryClient()
        const queryKey = ['feed', 'hierarchical-strip', offset, limit]

        // Пытаемся получить данные из кэша
        const cachedData = queryClient.getQueryData<GetHierarchicalStripResponse>(queryKey)

        if (cachedData) {
          this.feedData = cachedData
          this.loading = false
          return
        }

        // Если данных нет в кэше, делаем запрос через Vue Query
        // Импортируем динамически для избежания циклических зависимостей
        const { useHierarchicalStrip } = await import('@/composables/use-feed-queries')

        // Для использования в action нужно использовать другой подход
        // Вместо этого используем прямой запрос, но с инвалидацией через Vue Query
        const { getByPRC } = await import('@/helpers/api/request')

        const response = await getByPRC({
          method: 'gethierarchicalstrip',
          parameters: [offset, '', limit, 'ru', [], [], [], [], []],
          cachehash: Date.now().toString(36) + Math.random().toString(36).substr(2),
          options: {
            ex: true
          },
          state: 1
        })

        if (response) {
          const data = response as GetHierarchicalStripResponse
          this.feedData = data

          // Сохраняем в кэш Vue Query
          queryClient.setQueryData(queryKey, data)
        }
      } catch (err: any) {
        this.error = err.message || 'Ошибка загрузки ленты'
      } finally {
        this.loading = false
      }
    },

    /**
     * Загружает больше постов
     */
    async loadMorePosts(): Promise<void> {
      // Здесь будет логика загрузки дополнительных постов
      // Пока просто перезагружаем с увеличенным offset
      const currentOffset = this.postsData.length
      await this.loadHierarchicalStrip(currentOffset, 20)
    },

    /**
     * Сохраняет позицию скролла
     */
    saveScrollPosition(): void {
      this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
    },

    /**
     * Восстанавливает позицию скролла
     */
    restoreScrollPosition(): void {
      window.scrollTo({
        top: this.scrollPosition,
        left: 0,
        behavior: 'instant'
      })
    },

    /**
     * Обновляет лайки поста
     * @deprecated Используйте инвалидацию через queryClient.invalidateQueries(['feed'])
     */
    updatePostLikes(postId: string | number, likes: number): void {
      const post = this.postsData.find((p) => p.id === postId)
      if (post) {
        post.likes = likes
        // Инвалидируем кеш
        this.cachedFeedDataHash = null

        // Инвалидируем кэш Vue Query
        const queryClient = useQueryClient()
        queryClient.invalidateQueries({ queryKey: ['feed'] })
      }
    },

    /**
     * Обновляет шары поста
     * @deprecated Используйте инвалидацию через queryClient.invalidateQueries(['feed'])
     */
    updatePostShares(postId: string | number, shares: number): void {
      const post = this.postsData.find((p) => p.id === postId)
      if (post) {
        post.shares = shares
        // Инвалидируем кеш
        this.cachedFeedDataHash = null

        // Инвалидируем кэш Vue Query
        const queryClient = useQueryClient()
        queryClient.invalidateQueries({ queryKey: ['feed'] })
      }
    },

    /**
     * Применяет сортировку к постам на основе активных фильтров
     */
    applySorting(posts: AdaptedPost[]): AdaptedPost[] {
      const filtersStore = useFiltersStore()
      const orderby = filtersStore.orderby
      const ascdesc = filtersStore.ascdesc

      // Создаем копию массива для сортировки
      const sorted = [...posts]

      // Применяем сортировку
      sorted.sort((a, b) => {
        let comparison = 0

        switch (orderby) {
          case 'score':
            // Сортировка по популярности (scoreSum / scoreCnt или scoreSum)
            const scoreA = a.scoreCnt > 0 ? (a.scoreSum || 0) / a.scoreCnt : 0
            const scoreB = b.scoreCnt > 0 ? (b.scoreSum || 0) / b.scoreCnt : 0
            comparison = scoreA - scoreB
            break

          case 'id':
            // Сортировка по дате (id обычно соответствует времени)
            const idA = typeof a.id === 'number' ? a.id : parseInt(String(a.id)) || 0
            const idB = typeof b.id === 'number' ? b.id : parseInt(String(b.id)) || 0
            comparison = idA - idB
            break

          case 'comment':
            // Сортировка по количеству комментариев
            comparison = a.comments - b.comments
            break

          default:
            // По умолчанию сортировка по дате
            const defaultIdA = typeof a.id === 'number' ? a.id : parseInt(String(a.id)) || 0
            const defaultIdB = typeof b.id === 'number' ? b.id : parseInt(String(b.id)) || 0
            comparison = defaultIdA - defaultIdB
        }

        // Применяем направление сортировки
        return ascdesc === 'asc' ? comparison : -comparison
      })

      return sorted
    }
  }
})
