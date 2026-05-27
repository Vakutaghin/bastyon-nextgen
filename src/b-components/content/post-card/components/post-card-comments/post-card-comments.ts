import { defineComponent, ref, computed, onBeforeUnmount, h, type PropType } from 'vue'
import {
  LoadingOutlined,
  CloseOutlined,
  SendOutlined,
  EditOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'

import { useAuthStore } from '@/blockchain'
import { useCommentsStore } from '@/stores'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatRelativeTime } from '@/helpers/common/date-formatter'

import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { PostForComments } from './types'
import type { CommentMenuAction } from './comment-menu.vue'

import CommentAvatar from './comment-avatar.vue'
import CommentReplyPanel from './comment-reply-panel.vue'
import CommentMenu from './comment-menu.vue'
import CommentEditForm from './comment-edit-form.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'

import {
  formatCommentMessageHtml as formatCommentMessageHtmlRaw,
  getCommentAvatarUrl,
  getCommentProfileLink,
  getInitial,
  formatCommentDateAndTime,
  getCommentImages,
  compressedNumber,
} from './helpers'
import { getCommentPostingDisableReason, type DisableReason } from './visibility'

import {
  SC_CommentsPreview,
  SC_CommentItem,
  SC_CommentRow,
  SC_CommentWithReplies,
  SC_CommentAuthor,
  SC_CommentText,
  SC_CommentContent,
  SC_CommentMeta,
  SC_CommentMetaRight,
  SC_CommentDate,
  SC_CommentImages,
  SC_CommentDeleted,
  SC_HiddenBanner,
  SC_RevealBtn,
  SC_ComposerDisabled,
  SC_EditedMark,
  SC_TxStatusBadge,
  SC_CommentActions,
  SC_CommentRepliesLink,
  SC_CommentReplies,
  SC_CommentRepliesToggle,
  SC_ReplyItemWrapper,
  SC_ReplyPanel,
  SC_ReplyPanelNested,
  SC_ReplyPanelNestedLevel2,
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_MentionList,
  SC_MentionItem,
  SC_ReplySendBtn,
  SC_LengthCounter,
  SC_ShowCommentsBtn,
  SC_ShowCommentsBtnSecondary,
  SC_ShowCommentsBtnCollapse,
  SC_CommentsActionsRow,
  SC_CommentsActionsLeft,
  SC_CommentsLoading,
  SC_CommentsSortRow,
  SC_CommentsSortSelect,
  SC_RefreshBtn,
} from './styled'

import {
  buildSortedComments,
  buildMentionUsers,
  filterMentionUsers,
} from './helpers/comments-computed'
import { pendingToGetComment } from './helpers/pending-comments'
import { useCommentsLoader } from './composables/use-comments-loader'
import { useCommentsReplies } from './composables/use-comments-replies'
import { useCommentsScoring } from './composables/use-comments-scoring'
import { useCommentForm } from './composables/use-comment-form'
import { useCommentEditDelete } from './composables/use-comment-edit-delete'
import { useCommentVisibility } from './composables/use-comment-visibility'
import { useCommentsWs } from './composables/use-comments-ws'

export { type PostForComments }

export const postCardCommentsOptions = defineComponent({
  name: 'PostCardComments',
  components: {
    LoadingOutlined,
    CloseOutlined,
    SendOutlined,
    EditOutlined,
    ClockCircleOutlined,
    StopOutlined,
    SyncOutlined,
    CommentAvatar,
    CommentReplyPanel,
    CommentMenu,
    CommentEditForm,
    PostCardImages,
    SC_CommentsPreview,
    SC_CommentItem,
    SC_CommentRow,
    SC_CommentWithReplies,
    SC_CommentAuthor,
    SC_CommentText,
    SC_CommentContent,
    SC_CommentMeta,
    SC_CommentMetaRight,
    SC_CommentDate,
    SC_CommentImages,
    SC_CommentDeleted,
    SC_HiddenBanner,
    SC_RevealBtn,
    SC_ComposerDisabled,
    SC_EditedMark,
    SC_TxStatusBadge,
    SC_CommentActions,
    SC_CommentRepliesLink,
    SC_CommentReplies,
    SC_CommentRepliesToggle,
    SC_ReplyItemWrapper,
    SC_ReplyPanel,
    SC_ReplyPanelNested,
    SC_ReplyPanelNestedLevel2,
    SC_ReplyInputWrap,
    SC_ReplyTextarea,
    SC_MentionList,
    SC_MentionItem,
    SC_ReplySendBtn,
    SC_LengthCounter,
    SC_ShowCommentsBtn,
    SC_ShowCommentsBtnSecondary,
    SC_ShowCommentsBtnCollapse,
    SC_CommentsActionsRow,
    SC_CommentsActionsLeft,
    SC_CommentsLoading,
    SC_CommentsSortRow,
    SC_CommentsSortSelect,
    SC_RefreshBtn,
  },
  props: {
    post: {
      type: Object as PropType<PostForComments>,
      required: true,
    },
  },
  emits: ['collapsed', 'replyToComment', 'comment'],
  setup(props, { emit }) {
    // --- Базовая идентификация поста / пользователя ---
    const postId = computed<string>(
      () => props.post.txid || props.post.hash || String(props.post.id || '')
    )

    const currentUserAddress = computed<string>(() => {
      const addr = useAuthStore().getUserAddress
      return typeof addr === 'string' ? addr : ''
    })

    const postAuthorAddress = computed<string>(() => {
      const p = props.post as PostForComments & { address?: string }
      return typeof p?.address === 'string' ? p.address : ''
    })

    const isUserAuthenticated = computed<boolean>(() => useAuthStore().isUserAuthenticated)

    const currentUserStateData = computed<
      import('@/types/rpc-responses/user-state').UserState | null
    >(() => {
      const profile = useAuthStore().getUserProfile as
        | (import('@/types/rpc-responses/user-state').UserState & { reputation?: number })
        | null
      return profile ?? null
    })

    const composerDisableReason = computed<DisableReason | null>(() =>
      getCommentPostingDisableReason(isUserAuthenticated.value, currentUserStateData.value)
    )

    // --- Тик для реактивного обновления относительного времени (раз в минуту) ---
    const nowTick = ref(0)
    const relativeTimer = window.setInterval(() => {
      nowTick.value++
    }, 60_000)

    // --- Композаблы ---
    // Forward-ref на sorted comments — нужен для loader (visibleCount учитывает pending).
    // Заполняется ниже после создания computed sortedComments.
    let sortedCommentsRef: { value: GetComment[] } = { value: [] }
    const loader = useCommentsLoader({
      postId,
      getSortedLength: () => sortedCommentsRef.value.length,
    })

    const replies = useCommentsReplies({ postId })

    const scoring = useCommentsScoring({
      post: computed(() => props.post),
      isUserAuthenticated,
      currentUserStateData,
    })

    const editDelete = useCommentEditDelete({
      postId,
      currentUserAddress,
      postAuthorAddress,
      allComments: loader.allComments,
      repliesByParentId: replies.repliesByParentId,
    })

    const visibility = useCommentVisibility({
      currentUserAddress,
      isDeleted: editDelete.isCommentDeleted,
    })

    // --- Вычисляемые списки ---
    const pendingRootComments = computed<GetComment[]>(() => {
      const list = useCommentsStore().getPendingForPost(postId.value)
      if (!list.length) return []
      return list
        .filter((p) => !p.parentId) // только корневые здесь — ответы вшиваются в getReplies
        .map((p) => pendingToGetComment(p))
    })

    const sortedComments = computed<GetComment[]>(() =>
      buildSortedComments(
        loader.allComments.value,
        pendingRootComments.value,
        loader.commentsSortOrder.value,
        currentUserAddress.value || undefined,
        postAuthorAddress.value || undefined
      )
    )
    // Прокидываем актуальный массив в forward-ref для loader.getSortedLength
    sortedCommentsRef = {
      get value() {
        return sortedComments.value
      },
    } as unknown as { value: GetComment[] }

    const visibleComments = computed<GetComment[]>(() =>
      sortedComments.value.slice(0, loader.visibleCommentsCount.value)
    )

    const remainingCommentsCount = computed<number>(() =>
      Math.max(0, sortedComments.value.length - loader.visibleCommentsCount.value)
    )

    const nextCommentsPageSize = computed<number>(() => {
      if (remainingCommentsCount.value <= 0) return 0
      // импорт COMMENTS_PAGE_SIZE через consts уже сделан в composables, но для прямого
      // computed дешевле захардкодить — это значение и так используется в loader.
      // Берём пересчёт через само значение constsint:
      return Math.min(20, remainingCommentsCount.value)
    })
    const hasMoreCommentsToShow = computed<boolean>(() => remainingCommentsCount.value > 0)

    const totalCommentsCount = computed<number>(() => props.post.comments ?? 0)
    const actualCommentsCount = computed<number>(() => loader.allComments.value?.length ?? 0)
    const hasUserComments = computed<boolean>(() => {
      const lc = props.post.lastComment
      return !!lc && !!lc.message && (props.post.comments || 0) > 0
    })

    // --- Last comment отображение ---
    const lastCommentMessageHtml = computed<string>(() =>
      formatCommentMessageHtmlRaw({ msg: props.post.lastComment?.message || '' } as GetComment)
    )
    const lastCommentProfileLink = computed<string>(() => {
      const lc = props.post.lastComment
      if (!lc) return '/'
      if (lc.address) return '/' + lc.address
      const name = (lc.authorName || '').toLowerCase()
      if (name) return '/' + name
      return '/'
    })
    const lastCommentAvatarUrl = computed<string | null>(() => {
      const img = props.post.lastComment?.avatar || null
      if (!img) return null
      return resolveImageUrl(img) || null
    })
    const lastCommentInitial = computed<string>(() =>
      getInitial(props.post.lastComment?.authorName)
    )
    const lastCommentDateOnly = computed<string>(() => {
      void nowTick.value // зависимость от тика для авто-обновления
      return formatRelativeTime(props.post.lastComment?.time || 0)
    })
    const lastCommentDateFull = computed<string>(() =>
      formatCommentDateAndTime(props.post.lastComment?.time || 0)
    )
    const lastCommentId = computed<string | null>(() => props.post.lastComment?.id ?? null)
    const lastCommentChildren = computed<number>(() => props.post.lastComment?.children ?? 0)

    // --- Текущий пользователь — аватар/инициал ---
    const currentUserAvatarUrl = computed<string | null>(() => {
      const url = useAuthStore().getUserAvatarUrl
      if (!url) return null
      return resolveImageUrl(url) || null
    })
    const currentUserInitial = computed<string>(() => {
      const profile = useAuthStore().getUserProfile as { name?: string } | null
      const name = profile?.name
      if (name) return name.charAt(0).toUpperCase()
      const addr = useAuthStore().getUserAddress
      if (addr && typeof addr === 'string') return addr.charAt(0).toUpperCase()
      return '?'
    })

    // --- @mention candidates (computed) ---
    const mentionUsers = computed(() =>
      buildMentionUsers(props.post, loader.allComments.value, replies.repliesByParentId.value)
    )

    // --- Template refs для form composable ---
    const rootMentionListRef = ref<unknown>(null)
    const mentionListRef = ref<unknown>(null)
    const rootReplyTextareaRef = ref<unknown>(null)
    const replyTextareaRef = ref<unknown>(null)

    // form composable нужен filteredMentionUsers (вынесен сюда, потому что зависит от
    // mentionQuery, которое живёт внутри form composable — поэтому форвардим через ref-prop).
    const mentionQueryProxy = ref('')
    const filteredMentionUsers = computed(() =>
      filterMentionUsers(mentionUsers.value, mentionQueryProxy.value)
    )

    const form = useCommentForm({
      postId,
      currentUserAddress,
      composerDisableReason,
      allComments: loader.allComments,
      visibleCommentsCount: loader.visibleCommentsCount,
      commentsCollapsed: loader.commentsCollapsed,
      repliesExpanded: replies.repliesExpanded,
      refreshAllComments: () => loader.loadAllComments(false),
      emitComment: () => emit('comment'),
      rootMentionListRef,
      mentionListRef,
      rootReplyTextareaRef,
      replyTextareaRef,
      filteredMentionUsers,
    })

    // Синхронизация mentionQuery формы с прокси (для computed filtered)
    // Без watch — proxy просто читает из form.mentionQuery
    Object.defineProperty(mentionQueryProxy, 'value', {
      get: () => form.mentionQuery.value,
      set: (v: string) => {
        form.mentionQuery.value = v
      },
    })

    // --- WS (требует уже инициализированный loader) ---
    const ws = useCommentsWs({
      postId,
      isLoading: loader.allCommentsLoading,
      hasLoaded: computed(
        () => loader.allComments.value !== null
      ) as unknown as import('vue').Ref<boolean>,
      isCollapsed: loader.commentsCollapsed,
      reload: () => loader.loadAllComments(false),
    })

    // --- LastComment handlers (UI-events) ---
    const onLastCommentRepliesClick = async (): Promise<void> => {
      const id = props.post.lastComment?.id
      if (!id) return
      if (!loader.allComments.value) {
        await loader.loadAllComments(false)
      } else if (loader.commentsCollapsed.value) {
        loader.expandComments()
      }
      replies.repliesExpanded.value = { ...replies.repliesExpanded.value, [id]: true }
      await replies.loadReplies(id)
    }

    const onLastCommentReply = (): void => {
      const id = props.post.lastComment?.id
      if (!id) return
      form.openReplyEmpty(id, id)
    }
    const onLastCommentReplyToAuthor = (): void => {
      const lc = props.post.lastComment
      if (!lc?.id) return
      form.openReplyToAuthor(lc.id, lc.id, lc.authorName || lc.address || '')
    }

    const collapseComments = (): void => {
      loader.collapseComments()
      emit('collapsed')
    }

    // --- Display helpers (методы для шаблона) ---
    const formatCommentDate = (time: number): string => {
      void nowTick.value
      return formatRelativeTime(time)
    }
    const formatCommentDateFull = (time: number): string => formatCommentDateAndTime(time)
    const getCommentImagesList = (comment: GetComment): string[] => getCommentImages(comment)

    const formatScore = (n: number | undefined | null): string => {
      if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return '0'
      return compressedNumber(n) || String(n)
    }

    const formatCommentMessageHtml = (comment: GetComment): string => {
      const overridden = useCommentsStore().editedMessages[comment.id]
      if (typeof overridden === 'string') {
        const patched = {
          ...comment,
          msg: JSON.stringify({ message: overridden, url: '', images: [], info: '' }),
        } as GetComment
        return formatCommentMessageHtmlRaw(patched)
      }
      return formatCommentMessageHtmlRaw(comment)
    }
    const isCommentEdited = (comment: GetComment): boolean => {
      if (typeof useCommentsStore().editedMessages[comment.id] === 'string') return true
      return !!comment.edit || comment.timeUpd > comment.time
    }

    // --- Menu action handler ---
    const onCommentMenuAction = (comment: GetComment, action: CommentMenuAction): void => {
      if (action === 'delete') {
        editDelete.confirmDeleteComment(comment)
        return
      }
      if (action === 'edit') {
        editDelete.openEditComment(comment)
        return
      }
    }

    // --- Cleanup ---
    onBeforeUnmount(() => {
      clearInterval(relativeTimer)
    })

    // Не используем h() напрямую — нужно для tree-shake hint
    void h

    return {
      // --- Базовое состояние ---
      postId,
      currentUserAddress,
      postAuthorAddress,
      nowTick,

      // --- LastComment computed ---
      lastCommentMessageHtml,
      lastCommentProfileLink,
      lastCommentAvatarUrl,
      lastCommentInitial,
      lastCommentDateOnly,
      lastCommentDateFull,
      lastCommentId,
      lastCommentChildren,
      hasUserComments,
      totalCommentsCount,

      // --- Текущий юзер ---
      currentUserAvatarUrl,
      currentUserInitial,
      currentUserStateData,

      // --- Списки ---
      sortedComments,
      visibleComments,
      remainingCommentsCount,
      nextCommentsPageSize,
      hasMoreCommentsToShow,
      actualCommentsCount,
      pendingRootComments,

      // --- Mention list ---
      mentionUsers,
      filteredMentionUsers,

      // --- Disable reasons ---
      composerDisableReason,

      // --- Loader (allComments/loading/sort/pagination) ---
      allComments: loader.allComments,
      allCommentsLoading: loader.allCommentsLoading,
      allCommentsError: loader.allCommentsError,
      visibleCommentsCount: loader.visibleCommentsCount,
      commentsCollapsed: loader.commentsCollapsed,
      commentsSortOrder: loader.commentsSortOrder,
      loadAllComments: loader.loadAllComments,
      expandComments: loader.expandComments,
      setCommentsSortOrder: loader.setCommentsSortOrder,
      showMoreComments: loader.showMoreComments,
      showAllComments: loader.showAllComments,
      collapseComments,

      // --- Replies (2-уровневые) ---
      repliesByParentId: replies.repliesByParentId,
      repliesLoading: replies.repliesLoading,
      repliesExpanded: replies.repliesExpanded,
      loadReplies: replies.loadReplies,
      toggleRepliesExpanded: replies.toggleRepliesExpanded,
      isRepliesExpanded: replies.isRepliesExpanded,
      isRepliesLoading: replies.isRepliesLoading,
      getReplies: replies.getReplies,
      onRepliesClick: replies.onRepliesClick,

      // --- Scoring ---
      lastCommentVote: scoring.lastCommentVote,
      commentVotes: scoring.commentVotes,
      commentScoreSubmitting: scoring.commentScoreSubmitting,
      scoringDisableReason: scoring.scoringDisableReason,
      lastCommentUserLiked: scoring.lastCommentUserLiked,
      lastCommentUserDisliked: scoring.lastCommentUserDisliked,
      lastCommentCanClickLike: scoring.lastCommentCanClickLike,
      lastCommentCanClickDislike: scoring.lastCommentCanClickDislike,
      isCommentLiked: scoring.isCommentLiked,
      isCommentDisliked: scoring.isCommentDisliked,
      commentCanClickLike: scoring.commentCanClickLike,
      commentCanClickDislike: scoring.commentCanClickDislike,
      onLastCommentScoreUp: scoring.onLastCommentScoreUp,
      onLastCommentScoreDown: scoring.onLastCommentScoreDown,
      onCommentScoreUp: scoring.onCommentScoreUp,
      onCommentScoreDown: scoring.onCommentScoreDown,

      // --- Form / @mentions ---
      replyTarget: form.replyTarget,
      replyDraft: form.replyDraft,
      showCancelReplyModal: form.showCancelReplyModal,
      showMentionList: form.showMentionList,
      mentionQuery: form.mentionQuery,
      mentionHighlightIndex: form.mentionHighlightIndex,
      replySubmitting: form.replySubmitting,
      replyPanelKey: form.replyPanelKey,
      isRootReplyActive: form.isRootReplyActive,
      rootLengthHint: form.rootLengthHint,
      rootLengthValid: form.rootLengthValid,
      isReplyPanelOpen: form.isReplyPanelOpen,
      openReplyToPost: form.openReplyToPost,
      openReplyEmpty: form.openReplyEmpty,
      openReplyToAuthor: form.openReplyToAuthor,
      requestCloseReply: form.requestCloseReply,
      closeReply: form.closeReply,
      confirmCancelReply: form.confirmCancelReply,
      onRootBarFocus: form.onRootBarFocus,
      handleRootReplyInput: form.handleRootReplyInput,
      handleReplyInput: form.handleReplyInput,
      handleReplyKeydown: form.handleReplyKeydown,
      scrollMentionHighlightIntoView: form.scrollMentionHighlightIntoView,
      selectMentionUser: form.selectMentionUser,
      sendReply: form.sendReply,
      onReplyToFirstLevel: form.onReplyToFirstLevel,
      onReplyToAuthorFirstLevel: form.onReplyToAuthorFirstLevel,
      onReplyToSecondLevel: form.onReplyToSecondLevel,
      onReplyToComment: form.onReplyToComment,
      onLastCommentReply,
      onLastCommentReplyToAuthor,
      onLastCommentRepliesClick,

      // --- Visibility ---
      isCommentHiddenByVisibility: visibility.isCommentHiddenByVisibility,
      isHiddenRevealed: visibility.isHiddenRevealed,
      shouldHideContent: visibility.shouldHideContent,
      revealHiddenComment: visibility.revealHiddenComment,

      // --- Edit/Delete ---
      commentDeleteSubmitting: editDelete.commentDeleteSubmitting,
      editingCommentId: editDelete.editingCommentId,
      editDraft: editDelete.editDraft,
      editInitialDraft: editDelete.editInitialDraft,
      editSubmitting: editDelete.editSubmitting,
      isCommentDeleted: editDelete.isCommentDeleted,
      canEditComment: editDelete.canEditComment,
      canDeleteComment: editDelete.canDeleteComment,
      canShowMenu: editDelete.canShowMenu,
      isCommentPending: editDelete.isCommentPending,
      isCommentRejected: editDelete.isCommentRejected,
      canInteractWithComment: editDelete.canInteractWithComment,
      isEditingComment: editDelete.isEditingComment,
      confirmDeleteComment: editDelete.confirmDeleteComment,
      openEditComment: editDelete.openEditComment,
      requestCloseEdit: editDelete.requestCloseEdit,
      closeEdit: editDelete.closeEdit,
      submitEdit: editDelete.submitEdit,
      getCommentMessagePlain: editDelete.getCommentMessagePlain,
      onCommentMenuAction,

      // --- WS ---
      refreshComments: ws.refresh,

      // --- Display helpers ---
      getCommentAvatarUrl,
      getCommentProfileLink,
      formatCommentDate,
      formatCommentDateFull,
      getCommentImagesList,
      formatScore,
      formatCommentMessageHtml,
      isCommentEdited,

      // --- Template refs ---
      rootMentionListRef,
      mentionListRef,
      rootReplyTextareaRef,
      replyTextareaRef,
    }
  },
})
