/**
 * Связанные видео для пост-страницы: другие видео/аудио того же автора
 * (`getprofilefeed` с фильтром по типу). Текущий пост исключается.
 *
 * «Same-author» — самый надёжный сигнал релевантности без рекомендательного
 * движка; reuse существующего профильного фид-RPC.
 */

import { computed, unref, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useUIStore } from '@/stores/ui-store'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import type { GetProfileFeedResponse } from '@/types/rpc-responses/get-profile-feed'

const VIDEO_TYPES = ['video', 'audio']

function resolve<T>(v: MaybeRefOrGetter<T>): T {
  return typeof v === 'function' ? (v as () => T)() : unref(v)
}

export function useRelatedVideos(
  authorAddress: MaybeRefOrGetter<string | null | undefined>,
  excludeTxid: MaybeRefOrGetter<string | null | undefined>,
  limit = 6
) {
  const uiStore = useUIStore()
  const address = computed(() => resolve(authorAddress) || '')
  const exclude = computed(() => resolve(excludeTxid) || '')

  const { data, isLoading, error } = useQuery<GetProfileFeedResponse>({
    queryKey: computed(() => ['related-videos', address.value, uiStore.language]),
    queryFn: () =>
      getByPRCWithAuth({
        method: rpcEndpoints.getProfileFeed,
        parameters: [
          0,
          '',
          limit + 6, // запас под исключение текущего поста
          uiStore.language,
          [],
          VIDEO_TYPES,
          [],
          [],
          [],
          address.value,
          '',
          '',
          'desc',
        ],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: { ex: true },
      }) as Promise<GetProfileFeedResponse>,
    enabled: computed(() => !!address.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const videos = computed<AdaptedPost[]>(() => {
    const posts = extractPostsFromResponse(data.value)
    const ex = exclude.value
    return posts
      .filter((p) => {
        const id = String(p.txid || p.hash || p.id || '')
        return id !== ex && (p.type === 'video' || p.type === 'audio')
      })
      .slice(0, limit)
  })

  return { videos, isLoading, error }
}
