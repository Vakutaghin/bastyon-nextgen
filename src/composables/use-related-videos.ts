/**
 * Связанные видео для пост-страницы: другие видео/аудио того же автора
 * (`getprofilefeed` с фильтром по типу). Текущий пост исключается.
 *
 * «Same-author» — самый надёжный сигнал релевантности без рекомендательного
 * движка; reuse существующего профильного фид-RPC.
 */

import { computed, unref, type MaybeRefOrGetter } from 'vue'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
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
        // Раскладка getprofilefeed — как в use-profile-feed (14 параметров):
        // адрес на индексе 10, перед ним зарезервированный ''. С 13 параметрами
        // (адрес на 9) нода отвечала «No profile address» и блок никогда не
        // показывался (K7, проверено живой пробой).
        parameters: [
          0, // height
          '', // txid
          limit + 6, // count — запас под исключение текущего поста
          uiStore.language, // lang
          [], // tagsfilter
          VIDEO_TYPES, // type
          [], // _param6
          [], // _param7
          [], // tagsexcluded
          '', // _param9 (reserved)
          address.value, // address
          '', // keyword
          '', // orderby
          'desc', // ascdesc
        ],
        cachehash: Date.now().toString(36) + Math.random().toString(36).substring(2),
        options: { ex: true },
      }) as Promise<GetProfileFeedResponse>,
    enabled: computed(() => !!address.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Рекомендации тоже уважают блок-лист (решение Р3 по S21).
  const { filterBlocked } = useBlockedAuthors()

  const videos = computed<AdaptedPost[]>(() => {
    const posts = extractPostsFromResponse(data.value)
    const ex = exclude.value
    return filterBlocked(
      posts.filter((p) => {
        const id = String(p.txid || p.hash || p.id || '')
        return id !== ex && (p.type === 'video' || p.type === 'audio')
      })
    ).slice(0, limit)
  })

  return { videos, isLoading, error }
}
