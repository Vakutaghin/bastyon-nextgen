// Свежие ролики подписок для «Новые ролики подписок — сами»: первая страница
// ленты подписок только с видео, как вкладка «Подписки» раздела «Видео».

import { buildSubscriptionsFeedQuery } from '@/composables/helpers/feed-queries'
import { extractPostsFromResponse } from '@/composables/use-feed'
import { offlineSourceFromPost } from './offline-source'
import { postTimeMs } from './offline-auto'
import type { OfflineSource } from './offline-job'

/** Сколько постов подписок смотреть за проверку. */
const PAGE = 20

export interface SubscriptionVideo {
  source: OfflineSource
  /** Когда пост опубликован, мс. */
  time: number
  type?: string
  videoUrl?: string
  timestamp?: string
}

export async function fetchSubscriptionVideos(address: string): Promise<SubscriptionVideo[]> {
  const response = await buildSubscriptionsFeedQuery({
    currentTxid: '',
    count: PAGE,
    lang: '',
    allTags: [],
    contentTypes: ['video'],
    userAddress: address,
    topFirst: false,
    depth: 0,
  })
  return extractPostsFromResponse(response).flatMap((post) => {
    const source = offlineSourceFromPost(post)
    return source
      ? [
          {
            source,
            time: postTimeMs(post),
            type: post.type,
            videoUrl: post.videoUrl,
            timestamp: post.timestamp,
          },
        ]
      : []
  })
}
