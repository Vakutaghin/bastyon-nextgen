/**
 * Загрузка списка комментариев к посту через RPC `getcomments`.
 * Управляет:
 * - allComments (массив) / allCommentsLoading / allCommentsError
 * - visibleCommentsCount (страничный лимит)
 * - commentsCollapsed (свёрнут ли блок)
 * - commentsSortOrder
 *
 * После каждой загрузки вызывает commentsStore.reconcileWithServer — снимает
 * локальные pending/edited/deleted-метки, если сервер уже знает о них.
 */

import { ref, type Ref } from 'vue'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { useAuthStore } from '@/blockchain'
import { useCommentsStore } from '@/stores'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import { COMMENTS_PAGE_SIZE, COMMENTS_ALREADY_SHOWN, COMMENT_LOAD_TIMEOUT_MS } from '../consts'
import type { CommentsSortOrder } from '../types'

export interface UseCommentsLoaderOptions {
  postId: Ref<string>
  /** Колбэк для получения текущей длины sortedComments — нужен для visibleCommentsCount. */
  getSortedLength: () => number
}

export function useCommentsLoader(opts: UseCommentsLoaderOptions) {
  const allComments = ref<GetComment[] | null>(null)
  const allCommentsLoading = ref(false)
  const allCommentsError = ref<Error | null>(null)
  const visibleCommentsCount = ref(0)
  const commentsCollapsed = ref(false)
  const commentsSortOrder = ref<CommentsSortOrder>('newest')

  const loadAllCommentsInternal = async (showAll = false): Promise<void> => {
    if (!opts.postId.value) return
    allCommentsError.value = null
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Таймаут загрузки комментариев')),
          COMMENT_LOAD_TIMEOUT_MS
        )
      })
      const authStore = useAuthStore()
      const userAddress = authStore.getUserAddress ?? ''
      const res = await Promise.race([
        getByPRC({
          method: rpcEndpoints.getComments,
          parameters: [opts.postId.value, '', userAddress],
          cachehash: Date.now().toString(36) + Math.random().toString(36).slice(2),
          options: { auth: authStore.isUserAuthenticated },
        }),
        timeoutPromise,
      ])
      let list: GetComment[] = []
      if (Array.isArray(res)) {
        list = res as GetComment[]
      } else if (res && typeof res === 'object' && 'data' in res) {
        const data = (res as GetCommentsResponse).data
        list = Array.isArray(data) ? data : []
      }
      allComments.value = list
      // Согласовываем локальные оверрайды с серверными данными:
      // если сервер уже знает о наших правках/удалениях/созданиях — снимаем локальные метки.
      useCommentsStore().reconcileWithServer(opts.postId.value, list)
      // visibleCount учитывает pending: иначе свежеотправленный коммент при пустом сервере
      // (len = 0, visibleCount = 0) не показался бы вовсе.
      const total = opts.getSortedLength()
      const initialVisible = COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE
      visibleCommentsCount.value = showAll ? total : Math.min(initialVisible, total)
      commentsCollapsed.value = false
    } catch (e) {
      allCommentsError.value = e instanceof Error ? e : new Error(String(e))
    }
  }

  const loadAllComments = async (showAll = false): Promise<void> => {
    if (!opts.postId.value || allCommentsLoading.value) return
    allCommentsLoading.value = true
    try {
      await loadAllCommentsInternal(showAll)
    } finally {
      allCommentsLoading.value = false
    }
  }

  // --- Навигация / пагинация ---
  const collapseComments = (): void => {
    commentsCollapsed.value = true
  }
  const expandComments = (): void => {
    commentsCollapsed.value = false
  }
  const setCommentsSortOrder = (event: Event): void => {
    const value = (event.target as HTMLSelectElement)?.value
    if (value === 'interesting' || value === 'newest' || value === 'oldest') {
      commentsSortOrder.value = value
    }
  }
  const showMoreComments = (): void => {
    if (!allComments.value) return
    visibleCommentsCount.value = Math.min(
      visibleCommentsCount.value + COMMENTS_PAGE_SIZE,
      allComments.value.length
    )
  }
  const showAllComments = (): void => {
    if (!allComments.value) return
    visibleCommentsCount.value = allComments.value.length
  }

  return {
    allComments,
    allCommentsLoading,
    allCommentsError,
    visibleCommentsCount,
    commentsCollapsed,
    commentsSortOrder,
    loadAllComments,
    collapseComments,
    expandComments,
    setCommentsSortOrder,
    showMoreComments,
    showAllComments,
  }
}
