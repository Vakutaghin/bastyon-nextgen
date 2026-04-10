import { defineStore } from 'pinia'
import { useQueryClient } from '@tanstack/vue-query'

import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useFiltersStore } from './filters-store'
import { adaptPostData, extractRawPosts, type AdaptedPost } from '@/helpers/common/post-mapper'


/**
 * @deprecated Используйте composables из @/composables вместо этого store
 * Например: useHierarchicalStrip, useTopFeed, useProfileFeed
 *
 * Этот store оставлен для обратной совместимости.
 * Все запросы теперь управляются через Vue Query.
 */

export const useFeedStore = defineStore('feed', {
  state: () => ({
    feedData: null as GetTopFeedResponse | GetHierarchicalStripResponse | null,
    posts: [] as AdaptedPost[],
    loading: false,
    error: null as string | null,
    scrollPosition: 0,
  }),

  getters: {
    /**
     * Получает адаптированные посты из feedData.
     * Pinia getter уже является computed — ручное кеширование не нужно.
     */
    postsData(): AdaptedPost[] {
      if (!this.feedData) return []

      const rawPosts = extractRawPosts(this.feedData)
      if (rawPosts.length === 0) return []

      const adapted = rawPosts.map((post, index) => adaptPostData(post, index))
      return this.applySorting(adapted)
    }
  },

  actions: {
    /**
     * @deprecated Используйте adaptPostData из @/helpers/common/post-mapper
     */
    adaptPostData: adaptPostData,

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

        // Для использования в action нужно использовать другой подход
        // Вместо этого используем прямой запрос, но с инвалидацией через Vue Query
        const { getByPRC } = await import('@/helpers/api/request')

        const response = await getByPRC({
          method: rpcEndpoints.getHierarchicalStrip,
          parameters: [offset, '', limit, 'ru', [], [], [], [], []],
          cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
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
