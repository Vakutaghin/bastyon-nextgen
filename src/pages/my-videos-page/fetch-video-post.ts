/**
 * Пост с видео для окна поста — свежий с ноды (оценки, комментарии), как у
 * ссылки на пост в чате (use-post-by-txid).
 */

import { getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { adaptPostData, type AdaptedPost } from '@/helpers/common/post-mapper'

type RawPost = Parameters<typeof adaptPostData>[0]

/** Нода отдаёт массив, `{ data }`, `{ contents }` или `{ data: { contents } }`. */
function firstPost(raw: unknown): RawPost | null {
  if (!raw || typeof raw !== 'object') return null
  const wrapper = raw as { data?: unknown; contents?: unknown }
  const nested = wrapper.data as { contents?: unknown } | undefined
  const list = [raw, wrapper.data, wrapper.contents, nested?.contents].find(Array.isArray) as
    | unknown[]
    | undefined
  const first = list?.[0]
  return first && typeof first === 'object' ? (first as RawPost) : null
}

/** null — нода поста не знает. */
export async function fetchVideoPost(txid: string): Promise<AdaptedPost | null> {
  const raw = await getByPRCWithAuth({
    method: rpcEndpoints.getRawTransactionWithMessageById,
    parameters: [[txid]],
  })
  const post = firstPost(raw)
  return post ? adaptPostData(post, 0) : null
}
