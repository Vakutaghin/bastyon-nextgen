// Обогащение постов: подгрузка контента репостов и рейтингов пользователя

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { generateCacheHash } from '@/helpers/common/cache-hash'
import { mergeRepostContent, type AdaptedPost } from './use-feed'

/**
 * Подгружает контент оригинальных записей для репостов
 * и мержит его в адаптированные посты.
 *
 * @param posts - список адаптированных постов (мутируется)
 * @param contents - сырые данные из API (для извлечения repost txid)
 */
export async function enrichRepostsWithContent(
  posts: AdaptedPost[],
  contents: any[],
): Promise<void> {
  const repostTxids = [...new Set(
    contents
      .filter((p: any) => p.repost)
      .map((p: any) => p.repost),
  )] as string[]

  if (repostTxids.length === 0) return

  try {
    const result: any = await getByPRCWithAuth({
      method: rpcEndpoints.getRawTransactionWithMessageById,
      parameters: [repostTxids],
      cachehash: generateCacheHash(),
      options: {},
      state: 1,
    })

    const originals = Array.isArray(result)
      ? result
      : (result?.data ?? result?.result ?? [])

    const originalMap = new Map(
      (Array.isArray(originals) ? originals : []).map((p: any) => [p.txid || p.hash || p.id, p]),
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
  getByPRCWithAuth({
    method: rpcEndpoints.getPageScores,
    parameters: [postIds, userAddress, []],
    cachehash: generateCacheHash(),
  }).then((scoresResponse: any) => {
    const scores = Array.isArray(scoresResponse)
      ? scoresResponse
      : (scoresResponse?.data || scoresResponse?.result || [])

    if (!Array.isArray(scores)) return

    scores.forEach((score: any) => {
      if (!score.posttxid || !score.value) return
      const post = allPosts.find((p) => p.txid === score.posttxid || p.hash === score.posttxid)
      if (post) post.myVal = score.value
    })
  }).catch((err) => {
    console.error('[enrichPostsWithScores] Ошибка загрузки оценок:', err)
  })
}
