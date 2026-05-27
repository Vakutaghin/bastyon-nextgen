// Дополнение постов смежными данными после основной загрузки:
//  1. Контент оригинальных записей для репостов (getrawtransactionwithmessagebyid).
//  2. Оценки текущего пользователя (getpagescores) — для подсветки «уже голосовал».

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { mergeRepostContent, type AdaptedPost } from '../use-feed'

const freshCacheHash = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2)

/**
 * Загружает оригинальные посты для репостов и мерджит их в адаптированные посты на месте.
 * Не возвращает ничего — мутирует переданные `adaptedPosts`.
 */
export async function fetchAndMergeRepostOriginals(
  adaptedPosts: AdaptedPost[],
  rawContents: any[]
): Promise<void> {
  const repostTxids = [
    ...new Set(rawContents.filter((p: any) => p.repost).map((p: any) => p.repost)),
  ] as string[]

  if (repostTxids.length === 0) return

  try {
    const result: any = await getByPRCWithAuth({
      method: rpcEndpoints.getRawTransactionWithMessageById,
      parameters: [repostTxids],
      cachehash: freshCacheHash(),
      options: {},
      state: 1,
    })

    const originals = Array.isArray(result) ? result : (result?.data ?? result?.result ?? [])
    const originalMap = new Map(
      (Array.isArray(originals) ? originals : []).map((p: any) => [p.txid || p.hash || p.id, p])
    )

    adaptedPosts.forEach((adapted) => {
      if (!adapted.repost) return
      const orig = originalMap.get(adapted.repost)
      if (orig) mergeRepostContent(adapted, orig)
    })
  } catch (err) {
    console.error('[feed-enrichment] Failed to fetch repost content:', err)
  }
}

/**
 * Подгружает оценки текущего пользователя через getpagescores и проставляет `myVal`
 * найденным постам в `targetPool` (обычно — общий список всех загруженных постов).
 * Запускается асинхронно (fire-and-forget) — основной UI не блокируется.
 *
 * `targetPool` — общий список, чтобы найти посты не только в свежей странице (на случай
 * если они приехали несколькими батчами и оценка пришла на старые).
 */
export function enrichWithUserScores(
  postsToEnrich: AdaptedPost[],
  targetPool: AdaptedPost[],
  userAddress: string
): void {
  const postIds = postsToEnrich.map((p) => p.txid || p.hash).filter(Boolean) as string[]
  if (postIds.length === 0) return

  getByPRCWithAuth({
    method: rpcEndpoints.getPageScores,
    parameters: [postIds, userAddress, []],
    cachehash: freshCacheHash(),
  })
    .then((scoresResponse: any) => {
      // RPC может вернуть массив напрямую / {data} / {result}.
      const scores = Array.isArray(scoresResponse)
        ? scoresResponse
        : scoresResponse?.data || scoresResponse?.result || []

      if (!Array.isArray(scores)) return
      scores.forEach((score: any) => {
        if (!score.posttxid || !score.value) return
        const post = targetPool.find((p) => p.txid === score.posttxid || p.hash === score.posttxid)
        if (post) post.myVal = score.value
      })
    })
    .catch((err) => {
      console.error('[feed-enrichment] Failed to fetch scores:', err)
    })
}
