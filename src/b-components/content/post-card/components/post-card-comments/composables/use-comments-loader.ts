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
 *
 * Перезагрузка уже открытого списка (WS, «Обновить», свой новый комментарий)
 * — `reloadComments`: сколько показано, столько и остаётся. Раньше она шла как
 * первая загрузка и сворачивала раскрытое «Загрузить ещё» обратно до 16.
 */

import { ref, type Ref } from 'vue'
import { useCommentsStore } from '@/stores'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { fetchComments } from '../helpers/fetch-comments'
import { COMMENTS_PAGE_SIZE, COMMENTS_ALREADY_SHOWN, COMMENT_LOAD_TIMEOUT_MS } from '../consts'
import type { CommentsSortOrder } from '../types'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { t } from '@/i18n'

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
  // Порядок, с которого открывается обсуждение, берём из настроек: в самом
  // посте переключатель по-прежнему меняет его для этого поста.
  const commentsSortOrder = ref<CommentsSortOrder>(useAppPreferencesStore().commentsOrder)

  const loadAllCommentsInternal = async (showAll = false, keepView = false): Promise<void> => {
    if (!opts.postId.value) return
    allCommentsError.value = null
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(t('commentsMsg.loadTimeout'))), COMMENT_LOAD_TIMEOUT_MS)
      })
      const list = await Promise.race([
        fetchComments(
          opts.postId.value,
          '',
          Date.now().toString(36) + Math.random().toString(36).slice(2)
        ),
        timeoutPromise,
      ])
      const shownBefore = opts.getSortedLength()
      allComments.value = list
      // Согласовываем локальные оверрайды с серверными данными:
      // если сервер уже знает о наших правках/удалениях/созданиях — снимаем локальные метки.
      useCommentsStore().reconcileWithServer(opts.postId.value, list)
      // visibleCount учитывает pending: иначе свежеотправленный коммент при пустом сервере
      // (len = 0, visibleCount = 0) не показался бы вовсе.
      const total = opts.getSortedLength()
      const initialVisible = COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE
      const firstPage = showAll ? total : Math.min(initialVisible, total)
      if (keepView) {
        // Новые встают по сортировке и внутрь показанного: окно растёт на
        // столько же, чтобы показанные не уехали под «Загрузить ещё».
        const added = Math.max(0, total - shownBefore)
        visibleCommentsCount.value = Math.min(
          total,
          Math.max(visibleCommentsCount.value + added, firstPage)
        )
        return
      }
      visibleCommentsCount.value = firstPage
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

  /** Обновить открытый список, не сворачивая показанное. */
  const reloadComments = async (): Promise<void> => {
    if (!opts.postId.value || allCommentsLoading.value) return
    if (allComments.value === null) return loadAllComments(false)
    allCommentsLoading.value = true
    try {
      await loadAllCommentsInternal(false, true)
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
  const setCommentsSortOrder = (value: unknown): void => {
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
    reloadComments,
    collapseComments,
    expandComments,
    setCommentsSortOrder,
    showMoreComments,
    showAllComments,
  }
}
