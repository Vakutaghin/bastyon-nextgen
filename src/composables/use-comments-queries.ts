/**
 * Composables для работы с комментариями через Vue Query
 */

import { useRpcQuery } from './use-rpc-query'
import type { GetCommentsResponse } from '@/types/rpc-responses/get-comments'
import type { GetLastCommentsResponse } from '@/types/rpc-responses/get-last-comments'

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
      method: 'getcomments',
      parameters: postId ? [postId, parentId, address] : [],
      options: { auth: false }
    },
    {
      enabled: enabled && !!postId,
      staleTime: 1 * 60 * 1000, // 1 минута - комментарии часто обновляются
      gcTime: 5 * 60 * 1000,
    }
  )
}

/**
 * Загружает последние комментарии
 *
 * Параметры getlastcomments: [limit, '', lang] — лимит (строка), пустая строка, язык (например "ru").
 *
 * @param enabled - Включен ли запрос
 */
export function useLastComments(enabled: boolean = true) {
  const parameters: [string, string, string] = ['20', '', 'ru']
  return useRpcQuery<GetLastCommentsResponse>(
    ['comments', 'last', ...parameters],
    {
      method: 'getlastcomments',
      parameters,
      options: { auth: false }
    },
    {
      enabled,
      staleTime: 1 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }
  )
}
