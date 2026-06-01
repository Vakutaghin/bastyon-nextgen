/**
 * Ответы второго уровня: загрузка по требованию, expand/collapse,
 * примешивание pending-ответов из commentsStore к серверным.
 */

import { computed, ref, type Ref } from 'vue'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { useAuthStore } from '@/blockchain'
import { useCommentsStore } from '@/stores'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import { pendingToGetComment } from '../helpers/pending-comments'

export interface UseCommentsRepliesOptions {
  postId: Ref<string>
}

export function useCommentsReplies(opts: UseCommentsRepliesOptions) {
  const repliesByParentId = ref<Record<string, GetComment[]>>({})
  const repliesLoading = ref<Record<string, boolean>>({})
  const repliesExpanded = ref<Record<string, boolean>>({})

  const loadReplies = async (commentId: string): Promise<void> => {
    if (!opts.postId.value || repliesLoading.value[commentId]) return
    repliesLoading.value = { ...repliesLoading.value, [commentId]: true }
    repliesExpanded.value = { ...repliesExpanded.value, [commentId]: true }
    const authStore = useAuthStore()
    const userAddress = authStore.getUserAddress ?? ''
    try {
      const res = await getByPRC({
        method: rpcEndpoints.getComments,
        parameters: [opts.postId.value, commentId, userAddress],
        cachehash: `replies-${commentId}-${Date.now()}`,
        options: { auth: authStore.isUserAuthenticated },
      })
      let list: GetComment[] = []
      if (Array.isArray(res)) {
        list = res as GetComment[]
      } else if (res && typeof res === 'object' && 'data' in res) {
        const data = (res as GetCommentsResponse).data
        list = Array.isArray(data) ? data : []
      }
      repliesByParentId.value = { ...repliesByParentId.value, [commentId]: list }
    } catch {
      repliesByParentId.value = { ...repliesByParentId.value, [commentId]: [] }
    } finally {
      repliesLoading.value = { ...repliesLoading.value, [commentId]: false }
    }
  }

  const toggleRepliesExpanded = (commentId: string): void => {
    repliesExpanded.value = {
      ...repliesExpanded.value,
      [commentId]: !repliesExpanded.value[commentId],
    }
  }

  const isRepliesExpanded = (commentId: string): boolean => !!repliesExpanded.value[commentId]
  const isRepliesLoading = (commentId: string): boolean => !!repliesLoading.value[commentId]

  /**
   * Карта «parentId → ответы» (реальные + pending), пересчитывается реактивно
   * один раз на изменение, а не на каждый вызов из шаблона (audit §10.2).
   * Pending дедуплицируется: если уже среди реальных — серверный приоритет.
   */
  const mergedRepliesByParent = computed<Record<string, GetComment[]>>(() => {
    const real = repliesByParentId.value
    const pendingAll = useCommentsStore().getPendingForPost(opts.postId.value)
    if (!pendingAll.length) return real

    const result: Record<string, GetComment[]> = { ...real }
    const byParent = new Map<string, typeof pendingAll>()
    for (const p of pendingAll) {
      if (p.parentId == null) continue
      const arr = byParent.get(p.parentId) ?? []
      arr.push(p)
      byParent.set(p.parentId, arr)
    }
    for (const [parentId, pendings] of byParent) {
      const branchReal = result[parentId] ?? []
      const seen = new Set(branchReal.map((c) => c.id))
      const extras = pendings.map((p) => pendingToGetComment(p)).filter((c) => !seen.has(c.id))
      if (extras.length) result[parentId] = [...branchReal, ...extras]
    }
    return result
  })

  /** Ответы к ветке: O(1) чтение из мемоизированной карты. */
  const getReplies = (commentId: string): GetComment[] => mergedRepliesByParent.value[commentId] ?? []

  const onRepliesClick = (comment: GetComment): void => {
    const id = comment.id
    if (repliesLoading.value[id]) return
    if (id in repliesByParentId.value) {
      toggleRepliesExpanded(id)
    } else {
      void loadReplies(id)
    }
  }

  return {
    repliesByParentId,
    repliesLoading,
    repliesExpanded,
    loadReplies,
    toggleRepliesExpanded,
    isRepliesExpanded,
    isRepliesLoading,
    getReplies,
    onRepliesClick,
  }
}
