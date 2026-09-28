/**
 * Composables для работы с комментариями через Vue Query
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { preloadUserNames } from '@/services/user-names'
import { useRpcQuery } from './use-rpc-query'
import type { GetCommentsResponse } from '@/types/rpc-responses/get-comments'
import type {
  GetLastComment,
  GetLastCommentsResponse,
} from '@/types/rpc-responses/get-last-comments'
import { i18n } from '@/i18n'

/**
 * Загружает комментарии к посту
 *
 * @param postId - ID поста (txid)
 * @param parentId - ID родительского комментария ('' для всех комментариев)
 * @param address - Адрес пользователя для фильтрации (опционально)
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { data: comments, isLoading } = useComments(postId)
 * ```
 */
export function useComments(
  postId: string | null | undefined,
  parentId: string = '',
  address: string = '',
  enabled: boolean = true
) {
  return useRpcQuery<GetCommentsResponse>(
    ['comments', postId, parentId, address],
    {
      method: rpcEndpoints.getComments,
      parameters: postId ? [postId, parentId, address] : [],
      options: { auth: false },
    },
    {
      enabled: enabled && !!postId,
      staleTime: 1 * 60 * 1000, // 1 минута - комментарии часто обновляются
      gcTime: 5 * 60 * 1000,
    }
  )
}

/**
 * Как часто обновлять «Последние комментарии». Нода отдаёт в них 10 свежих
 * комментариев и листать назад не умеет, поэтому подгрузка тут — это новые
 * комментарии. Старый клиент перезапрашивал виджет на каждом блоке, а блок в
 * сети — раз в минуту (по нему же прокси сбрасывает свой кэш этого метода).
 */
export const LAST_COMMENTS_REFRESH_MS = 60 * 1000

/**
 * Загружает последние комментарии
 *
 * Параметры getlastcomments: [limit, '', lang] — лимит (строка), пустая строка, язык интерфейса.
 * Обновляется раз в минуту, пока вкладка видна (в фоне vue-query интервал
 * пропускает — как старый клиент, который обновлял виджет только в фокусе).
 * Имена авторов догружаются до показа, чтобы новые строки не мелькали адресом.
 *
 * @param enabled - Включен ли запрос
 */
export function useLastComments(enabled: boolean = true) {
  // Язык — интерфейса, а не всегда 'ru' (S62); смена языка перезапрашивает.
  const parameters = (): [string, string, string] => ['20', '', String(i18n.global.locale.value)]
  return useQuery<GetLastCommentsResponse>({
    queryKey: computed(() => ['comments', 'last', ...parameters()]),
    queryFn: async () => {
      const response = (await getByPRC({
        method: rpcEndpoints.getLastComments,
        parameters: parameters(),
        options: { auth: false },
      })) as GetLastCommentsResponse
      const comments = Array.isArray(response?.data) ? response.data : []
      await preloadUserNames(comments.flatMap((c) => [c.address, lastCommentRecipient(c)]))
      return response
    },
    enabled,
    staleTime: LAST_COMMENTS_REFRESH_MS,
    gcTime: 5 * 60 * 1000,
    refetchInterval: LAST_COMMENTS_REFRESH_MS,
  })
}

/**
 * Кому адресован комментарий из «Последних»: автору комментария, на который
 * ответили, иначе автору ветки, иначе автору поста. Себе — никому ('').
 */
export function lastCommentRecipient(c: GetLastComment): string {
  for (const to of [c.addressCommentAnswer, c.addressCommentParent, c.addressContent]) {
    if (to && to !== c.address) return to
  }
  return ''
}
