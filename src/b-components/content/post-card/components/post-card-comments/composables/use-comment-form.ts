/**
 * Форма ответа на пост / комментарий + @mention-меню.
 *
 * Управляет:
 * - replyTarget (root | ветка), replyDraft (текст), submit state
 * - mention state: showMentionList, mentionQuery, highlightIndex, текстовые offsets
 * - sendReply: optimistic pending + sendComment + reconcile через refreshAllComments
 *
 * Ссылки на textarea/mention-list передаются caller-ом через refs (компонент
 * держит шаблонные ref-ы и пробрасывает их сюда — для фокуса/скролла после
 * выбора mention).
 */

import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { haptic } from '@/helpers/common/haptics'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import { useCommentsStore, usePostsStore } from '@/stores'
import { sendComment } from '../comment-sender'
import { isCommentLengthValid, getCommentLengthHint } from '../helpers'
import { COMMENTS_PAGE_SIZE, COMMENTS_ALREADY_SHOWN } from '../consts'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { MentionUser } from '../types'
import type { DisableReason } from '../visibility'

export interface UseCommentFormOptions {
  postId: Ref<string>
  currentUserAddress: Ref<string>
  composerDisableReason: Ref<DisableReason | null> | ComputedRef<DisableReason | null>
  /** Загруженные комменты — для нужд UX после отправки (раскрыть список). */
  allComments: Ref<GetComment[] | null>
  visibleCommentsCount: Ref<number>
  commentsCollapsed: Ref<boolean>
  repliesExpanded: Ref<Record<string, boolean>>
  refreshAllComments: () => Promise<void>
  emitComment: () => void
  /** Шаблонные ref-ы из компонента — для скролла и фокуса. */
  rootMentionListRef: Ref<unknown>
  mentionListRef: Ref<unknown>
  rootReplyTextareaRef: Ref<unknown>
  replyTextareaRef: Ref<unknown>
  /** Лист mention-пользователей и фильтрованная версия — провайдит caller. */
  filteredMentionUsers: ComputedRef<MentionUser[]>
}

export function useCommentForm(opts: UseCommentFormOptions) {
  const replyTarget = ref<{ commentId: string; parentId: string; prefix: string } | null>(null)
  const replyDraft = ref('')
  const showCancelReplyModal = ref(false)
  const showMentionList = ref(false)
  const mentionQuery = ref('')
  const mentionStartOffset = ref(0)
  const mentionEndOffset = ref(0)
  const mentionHighlightIndex = ref(0)
  const replySubmitting = ref(false)

  // --- Черновик корневого комментария: автосохранение в localStorage ---
  // Сохраняется только текст корневой формы (composer к посту) по ключу postId,
  // переживает unmount карточки. Черновики ответов на ветки эфемерны и не пишутся.
  const draftKey = (): string => `bastyon_comment_draft:${opts.postId.value}`

  const readSavedDraft = (): string => {
    try {
      return localStorage.getItem(draftKey()) || ''
    } catch {
      return ''
    }
  }

  const writeSavedDraft = (text: string): void => {
    try {
      if (text.trim()) localStorage.setItem(draftKey(), text)
      else localStorage.removeItem(draftKey())
    } catch {
      /* приватный режим — молча игнорируем */
    }
  }

  const clearSavedDraft = (): void => {
    try {
      localStorage.removeItem(draftKey())
    } catch {
      /* noop */
    }
  }

  // Восстанавливаем черновик корневой формы при создании композабла (mount карточки):
  // на этом этапе replyTarget === null → активна корневая форма, бар покажет текст.
  const savedRootDraft = readSavedDraft()
  if (savedRootDraft) replyDraft.value = savedRootDraft

  const replyPanelKey = computed(() => {
    const t = replyTarget.value
    if (!t) return 'closed'
    return `${t.commentId}:${t.prefix ? 'author' : 'empty'}`
  })

  const isRootReplyActive = computed(
    () => replyTarget.value === null || replyTarget.value?.commentId === 'root'
  )

  const rootLengthHint = computed(() => getCommentLengthHint(replyDraft.value || ''))
  const rootLengthValid = computed(() => isCommentLengthValid(replyDraft.value || ''))

  const isReplyPanelOpen = (commentId: string): boolean =>
    replyTarget.value?.commentId === commentId

  // --- Открытие/закрытие формы ---
  const openReplyToPost = (): void => {
    replyTarget.value = { commentId: 'root', parentId: '', prefix: '' }
    // Восстанавливаем сохранённый черновик корневой формы, если он есть.
    replyDraft.value = readSavedDraft()
    showCancelReplyModal.value = false
    showMentionList.value = false
    mentionQuery.value = ''
    mentionHighlightIndex.value = 0
  }

  const openReplyEmpty = (commentId: string, parentId: string): void => {
    const sameComment = replyTarget.value?.commentId === commentId
    const oldPrefix = replyTarget.value?.prefix || ''
    replyTarget.value = { commentId, parentId, prefix: '' }
    showCancelReplyModal.value = false
    showMentionList.value = false
    mentionQuery.value = ''
    mentionHighlightIndex.value = 0
    if (sameComment && oldPrefix && (replyDraft.value || '').startsWith(oldPrefix)) {
      replyDraft.value = (replyDraft.value || '').slice(oldPrefix.length).trim()
    } else if (!sameComment) {
      replyDraft.value = ''
    }
  }

  const openReplyToAuthor = (commentId: string, parentId: string, authorName: string): void => {
    const prefix = authorName ? `@${authorName}, ` : ''
    const sameComment = replyTarget.value?.commentId === commentId
    replyTarget.value = { commentId, parentId, prefix }
    showCancelReplyModal.value = false
    showMentionList.value = false
    mentionQuery.value = ''
    mentionHighlightIndex.value = 0
    if (sameComment && !(replyDraft.value || '').startsWith(prefix)) {
      replyDraft.value = prefix + (replyDraft.value || '')
    } else if (!sameComment) {
      replyDraft.value = prefix
    }
  }

  const closeReply = (): void => {
    replyTarget.value = null
    replyDraft.value = ''
    showCancelReplyModal.value = false
    showMentionList.value = false
    mentionQuery.value = ''
  }

  const requestCloseReply = (): void => {
    if ((replyDraft.value || '').trim() && replyDraft.value !== (replyTarget.value?.prefix || '')) {
      showCancelReplyModal.value = true
    } else {
      closeReply()
    }
  }

  const confirmCancelReply = (): void => {
    clearSavedDraft()
    closeReply()
  }

  // --- @mentions ---
  const onRootBarFocus = (): void => {
    if (!isRootReplyActive.value) openReplyToPost()
  }

  const handleRootReplyInput = (e: Event): void => {
    if (!isRootReplyActive.value) return
    const el = e.target as HTMLTextAreaElement
    if (el) {
      replyDraft.value = el.value
      // Персистим только корневой черновик (ответы на ветки эфемерны).
      writeSavedDraft(el.value)
    }
    handleReplyInput(e)
  }

  const handleReplyInput = (e: Event): void => {
    const el = e.target as HTMLTextAreaElement
    if (!el) return
    const value = el.value
    const pos = el.selectionStart ?? value.length
    const before = value.slice(0, pos)
    const lastAt = before.lastIndexOf('@')
    if (lastAt === -1) {
      showMentionList.value = false
      mentionQuery.value = ''
      return
    }
    const afterAt = before.slice(lastAt + 1)
    if (/\s/.test(afterAt)) {
      showMentionList.value = false
      return
    }
    mentionStartOffset.value = lastAt
    mentionEndOffset.value = pos
    mentionQuery.value = afterAt
    mentionHighlightIndex.value = 0
    showMentionList.value = true
  }

  const scrollMentionHighlightIntoView = (): void => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        const ref = isRootReplyActive.value
          ? opts.rootMentionListRef.value
          : opts.mentionListRef.value
        const raw = Array.isArray(ref) ? ref[0] : ref
        const listEl =
          raw && (raw as HTMLElement).scrollTop !== undefined
            ? (raw as HTMLElement)
            : (raw as { $el?: HTMLElement })?.$el
        if (!listEl || !listEl.children || listEl.clientHeight <= 0) return
        const child = listEl.children[mentionHighlightIndex.value] as HTMLElement | undefined
        if (!child) return
        child.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      })
    })
  }

  const handleReplyKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const text = (replyDraft.value || '').trim()
      if (text && replyTarget.value && !replySubmitting.value) {
        void sendReply()
      }
      return
    }
    if (showMentionList.value && opts.filteredMentionUsers.value.length > 0) {
      if (e.key === 'Escape') {
        showMentionList.value = false
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowDown') {
        mentionHighlightIndex.value = Math.min(
          mentionHighlightIndex.value + 1,
          opts.filteredMentionUsers.value.length - 1
        )
        void nextTick(() => scrollMentionHighlightIntoView())
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowUp') {
        mentionHighlightIndex.value = Math.max(mentionHighlightIndex.value - 1, 0)
        void nextTick(() => scrollMentionHighlightIntoView())
        e.preventDefault()
        return
      }
      if (e.key === 'Enter') {
        const user = opts.filteredMentionUsers.value[mentionHighlightIndex.value]
        if (user) {
          selectMentionUser(user)
          e.preventDefault()
        }
        return
      }
    }
  }

  const selectMentionUser = (user: MentionUser): void => {
    const insert = `@${user.name} `
    const before = (replyDraft.value || '').slice(0, mentionStartOffset.value)
    const endPos = mentionEndOffset.value
    const after = (replyDraft.value || '').slice(endPos)
    replyDraft.value = before + insert + after
    showMentionList.value = false
    mentionQuery.value = ''
    mentionHighlightIndex.value = 0
    void nextTick(() => {
      const ref = isRootReplyActive.value
        ? opts.rootReplyTextareaRef.value
        : opts.replyTextareaRef.value
      const el =
        ref && typeof (ref as HTMLTextAreaElement).focus === 'function'
          ? (ref as HTMLTextAreaElement)
          : (ref as { $el?: HTMLTextAreaElement })?.$el
      if (el && typeof el.focus === 'function') {
        el.focus()
        const newPos = before.length + insert.length
        el.setSelectionRange(newPos, newPos)
      }
    })
  }

  // --- Вставка эмодзи в корневую форму (в позицию курсора) ---
  const insertRootEmoji = (emoji: string): void => {
    const current = replyDraft.value || ''
    const raw = opts.rootReplyTextareaRef.value
    const el =
      raw && typeof (raw as HTMLTextAreaElement).focus === 'function'
        ? (raw as HTMLTextAreaElement)
        : ((raw as { $el?: HTMLTextAreaElement } | null)?.$el ?? null)
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    replyDraft.value = current.slice(0, start) + emoji + current.slice(end)
    if (isRootReplyActive.value) writeSavedDraft(replyDraft.value)
    void nextTick(() => {
      if (!el || typeof el.focus !== 'function') return
      el.focus()
      const pos = start + emoji.length
      try {
        el.setSelectionRange(pos, pos)
      } catch {
        /* noop */
      }
    })
  }

  // --- Отправка ---
  const sendReply = async (): Promise<void> => {
    const text = (replyDraft.value || '').trim()
    if (!text || replySubmitting.value) return
    if (!isCommentLengthValid(text)) {
      appToast.error({ message: t('commentsMsg.tooLong') })
      return
    }
    const disableReason = opts.composerDisableReason.value
    if (disableReason) {
      appToast.error({ message: disableReason.message })
      return
    }
    const isRootComment = isRootReplyActive.value
    if (!isRootComment && !replyTarget.value) return
    replySubmitting.value = true
    const parentId = isRootComment ? '' : replyTarget.value!.parentId
    const answerId = isRootComment ? '' : replyTarget.value!.commentId
    const replyTargetSnapshot = replyTarget.value ? { ...replyTarget.value } : null

    // Оптимистичный insert: показать комментарий со значком часов сразу
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const me = opts.currentUserAddress.value
    const commentsStore = useCommentsStore()
    const postsStore = usePostsStore()
    const { title: postTitle } = resolvePostTitleFromPost(
      postsStore.getPostByShareId(opts.postId.value)
    )
    commentsStore.addPending({
      id: localId,
      postId: opts.postId.value,
      message: text,
      parentId: parentId || '',
      answerId: answerId || '',
      address: me,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      postTitle: postTitle || undefined,
    })

    // Авто-разворот для корневого / автоподнятие ветки для ответа
    if (isRootComment) {
      if (opts.allComments.value == null) opts.allComments.value = []
      if (opts.commentsCollapsed.value) opts.commentsCollapsed.value = false
      const minVisible = COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE
      if (opts.visibleCommentsCount.value < minVisible) {
        opts.visibleCommentsCount.value = minVisible
      }
    } else if (parentId) {
      opts.repliesExpanded.value = { ...opts.repliesExpanded.value, [parentId]: true }
    }

    closeReply()
    opts.emitComment()

    const refreshPromise = isRootComment
      ? opts.refreshAllComments().catch((err) => {
          console.warn('[comments] refresh after send failed', err)
        })
      : Promise.resolve()

    try {
      const txid = await sendComment(opts.postId.value, parentId, answerId, text)
      haptic('small')
      if (isRootComment) clearSavedDraft()
      appToast.success({ message: t('commentsMsg.sendSuccess') })
      if (txid) {
        commentsStore.replacePendingId(opts.postId.value, localId, txid)
      }
      await refreshPromise
    } catch (e) {
      commentsStore.removePending(opts.postId.value, localId)
      if (replyTargetSnapshot) {
        replyTarget.value = replyTargetSnapshot
      } else if (isRootComment) {
        replyTarget.value = { commentId: 'root', parentId: '', prefix: '' }
      }
      replyDraft.value = text
      appToast.error({
        message: e instanceof Error ? e.message : t('commentsMsg.sendError'),
      })
    } finally {
      replySubmitting.value = false
    }
  }

  // --- Reply-to helpers для разных уровней (используются в template) ---
  const onReplyToFirstLevel = (comment: GetComment): void => {
    openReplyEmpty(comment.id, comment.id)
  }
  const onReplyToAuthorFirstLevel = (comment: GetComment): void => {
    openReplyToAuthor(comment.id, comment.id, comment.userprofile?.name || comment.address || '')
  }
  const onReplyToSecondLevel = (reply: GetComment): void => {
    openReplyEmpty(reply.id, reply.id)
  }
  const onReplyToComment = (reply: GetComment): void => {
    openReplyToAuthor(reply.id, reply.id, reply.userprofile?.name || reply.address || '')
  }

  return {
    replyTarget,
    replyDraft,
    showCancelReplyModal,
    showMentionList,
    mentionQuery,
    mentionStartOffset,
    mentionEndOffset,
    mentionHighlightIndex,
    replySubmitting,
    replyPanelKey,
    isRootReplyActive,
    rootLengthHint,
    rootLengthValid,
    isReplyPanelOpen,
    openReplyToPost,
    openReplyEmpty,
    openReplyToAuthor,
    closeReply,
    requestCloseReply,
    confirmCancelReply,
    onRootBarFocus,
    handleRootReplyInput,
    handleReplyInput,
    handleReplyKeydown,
    scrollMentionHighlightIntoView,
    selectMentionUser,
    insertRootEmoji,
    sendReply,
    onReplyToFirstLevel,
    onReplyToAuthorFirstLevel,
    onReplyToSecondLevel,
    onReplyToComment,
  }
}
