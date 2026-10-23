// Посты канала — лента профиля автора (getprofilefeed), как на его странице:
// все языки, свежие первыми, страница продолжается от txid последнего поста.

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallWithAuth } from '@/helpers/api/request'
import { extractPostsFromResponse, type AdaptedPost } from '@/composables/use-feed'
import {
  fetchAndMergeRepostOriginals,
  preloadLastCommentAuthors,
} from '@/composables/helpers/feed-enrichment'
import type { GetProfileFeedData } from '@/types/rpc-responses/get-profile-feed'

export interface ChannelPage {
  /** Свежие первыми. */
  posts: AdaptedPost[]
  /** Нода отдала полную страницу — дальше могут быть ещё. */
  hasMore: boolean
}

/**
 * Страница постов автора.
 * @param fromTxid — продолжить после этого поста; пусто — с самого свежего.
 */
export async function fetchChannelPage(
  address: string,
  count: number,
  fromTxid = ''
): Promise<ChannelPage> {
  const response = await rpcCallWithAuth<GetProfileFeedData>({
    method: rpcEndpoints.getProfileFeed,
    parameters: [
      0, // height
      fromTxid,
      count,
      '', // lang: все языки, как на странице профиля
      [], // tagsfilter
      [], // type
      [],
      [],
      [], // tagsexcluded
      '',
      address,
      '', // keyword
      '', // orderby
      'desc',
    ],
    cachehash: Date.now().toString(36) + Math.random().toString(36).slice(2),
    options: { ex: true },
  })
  const contents = response?.contents ?? []
  await preloadLastCommentAuthors(contents)
  // В ответе бывает и профиль автора — extractPostsFromResponse берёт только посты.
  const posts = extractPostsFromResponse(
    response as unknown as Parameters<typeof extractPostsFromResponse>[0]
  ).filter((p) => p.author.address === address && p.txid !== fromTxid)
  await fetchAndMergeRepostOriginals(
    posts,
    contents as Parameters<typeof fetchAndMergeRepostOriginals>[1]
  )
  return { posts, hasMore: contents.length >= count && posts.length > 0 }
}
