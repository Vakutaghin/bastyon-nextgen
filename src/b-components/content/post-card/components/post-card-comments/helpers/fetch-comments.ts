/**
 * Комментарии поста или ветка ответов через RPC `getcomments`.
 *
 * Третьим параметром нода берёт адрес читателя и по нему проставляет myScore —
 * как он сам оценил каждый комментарий. Но на адрес, которого ещё нет в
 * блокчейне (вошёл, а регистрация не подтверждена), нода отвечает пустым
 * списком. Тогда запрос повторяется без адреса: комментарии видны, а своих
 * оценок у такого аккаунта всё равно нет. Зарегистрированному (профиль с id)
 * пустой ответ верим — комментариев действительно нет.
 */

import { useAuthStore } from '@/blockchain'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import type { GetComment, GetCommentsResponse } from '@/types/rpc-responses/get-comments'

function toList(res: unknown): GetComment[] {
  if (Array.isArray(res)) return res as GetComment[]
  if (res && typeof res === 'object' && 'data' in res) {
    const data = (res as GetCommentsResponse).data
    return Array.isArray(data) ? data : []
  }
  return []
}

/** Профиль этого адреса уже в блокчейне: у незарегистрированного нет id. */
function isRegistered(address: string): boolean {
  const profile = useAuthStore().getUserProfile as { address?: string; id?: number } | null
  return !!profile?.id && profile.address === address
}

/** parentId — '' для корневых комментариев, id комментария — для его ответов. */
export async function fetchComments(
  postId: string,
  parentId: string,
  cachehash: string
): Promise<GetComment[]> {
  const authStore = useAuthStore()
  const address = authStore.getUserAddress ?? ''
  const load = async (viewer: string, hash: string): Promise<GetComment[]> =>
    toList(
      await getByPRC({
        method: rpcEndpoints.getComments,
        parameters: [postId, parentId, viewer],
        cachehash: hash,
        options: { auth: authStore.isUserAuthenticated },
      })
    )

  const list = await load(address, cachehash)
  if (list.length || !address || isRegistered(address)) return list
  return load('', `${cachehash}-anon`)
}
