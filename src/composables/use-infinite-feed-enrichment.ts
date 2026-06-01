// Обогащение постов: подгрузка контента репостов и рейтингов пользователя

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallWithAuth } from '@/helpers/api/request'
import { generateCacheHash } from '@/helpers/common/cache-hash'
import { mergeRepostContent, type AdaptedPost } from './use-feed'
import type { GetPageScore } from '@/types/rpc-responses/get-page-scores'

/** Сырой пост из API с минимальным набором полей, нужных для enrichment. */
interface RawContentLike {
  repost?: string
  txid?: string
  hash?: string
  id?: string | number
}

/**
 * Подгружает контент оригинальных записей для репостов
 * и мержит его в адаптированные посты.
 *
 * @param posts - список адаптированных постов (мутируется)
 * @param contents - сырые данные из API (для извлечения repost txid)
 */
export async function enrichRepostsWithContent(
  posts: AdaptedPost[],
  contents: RawContentLike[],
): Promise<void> {
  const repostTxids = [...new Set(
    contents
      .filter((p) => p.repost)
      .map((p) => p.repost),
  )] as string[]

  if (repostTxids.length === 0) return

  try {
    const result = await rpcCallWithAuth<RawContentLike[]>({
      method: rpcEndpoints.getRawTransactionWithMessageById,
      parameters: [repostTxids],
      cachehash: generateCacheHash(),
      options: {},
      state: 1,
    })

    const originals = Array.isArray(result) ? result : []

    const originalMap = new Map(
      (Array.isArray(originals) ? originals : []).map((p) => [p.txid || p.hash || p.id, p]),
    )

    posts.forEach((adapted) => {
      if (!adapted.repost) return
      const orig = originalMap.get(adapted.repost)
      if (orig) mergeRepostContent(adapted, orig)
    })
  } catch (err) {
    console.error('[enrichRepostsWithContent] Ошибка загрузки контента репостов:', err)
  }
}

/**
 * Подгружает оценки текущего пользователя для постов (getPageScores).
 * Обновляет поле myVal в каждом посте.
 *
 * @param posts - ref-массив всех постов (мутируется)
 * @param postsToEnrich - новые посты, для которых нужны оценки
 * @param userAddress - адрес текущего пользователя
 */
export function enrichPostsWithScores(
  allPosts: AdaptedPost[],
  postsToEnrich: AdaptedPost[],
  userAddress: string,
): void {
  if (!userAddress || postsToEnrich.length === 0) return

  const postIds = postsToEnrich
    .map((p) => p.txid || p.hash)
    .filter(Boolean) as string[]

  if (postIds.length === 0) return

  // Запускаем асинхронно, не блокируя UI
  rpcCallWithAuth<GetPageScore[]>({
    method: rpcEndpoints.getPageScores,
    parameters: [postIds, userAddress, []],
    cachehash: generateCacheHash(),
  }).then((scores) => {

    if (!Array.isArray(scores)) return

    scores.forEach((score) => {
      if (!score.posttxid || !score.value) return
      const post = allPosts.find((p) => p.txid === score.posttxid || p.hash === score.posttxid)
      if (post) post.myVal = score.value as number
    })
  }).catch((err) => {
    console.error('[enrichPostsWithScores] Ошибка загрузки оценок:', err)
  })
}
