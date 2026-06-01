// Контекст дерева комментариев (provide/inject).
//
// post-card-comments.vue связывает 7 композаблов и набор display-хелперов, а
// рендер узлов комментариев вынесен в дочерние компоненты (comment-card,
// last-comment-preview, bound-reply-panel). Чтобы не прокидывать ~30 пропсов
// через каждый уровень дерева, родитель один раз провайдит этот контекст —
// бандлы композаблов + display-хелперы — а дочерние его инжектят.

import { inject, provide, type InjectionKey, type Ref } from 'vue'

import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { MentionUser } from './types'
import type { CommentMenuAction } from './comment-menu.vue'
import type { useCommentsLoader } from './composables/use-comments-loader'
import type { useCommentsReplies } from './composables/use-comments-replies'
import type { useCommentsScoring } from './composables/use-comments-scoring'
import type { useCommentForm } from './composables/use-comment-form'
import type { useCommentEditDelete } from './composables/use-comment-edit-delete'
import type { useCommentVisibility } from './composables/use-comment-visibility'

/**
 * Display-хелперы родителя. Часть из них завязана на реактивные/стор-зависимости
 * (formatCommentDate — на минутный nowTick родителя; formatCommentMessageHtml /
 * isCommentEdited — на useCommentsStore().editedMessages), поэтому передаются как
 * функции, а не дублируются в детях (один таймер, одна точка истины).
 */
export interface CommentDisplayHelpers {
  formatScore: (n: number | null | undefined) => string
  formatCommentDate: (time: number) => string
  formatCommentDateFull: (time: number) => string
  formatCommentMessageHtml: (comment: GetComment) => string
  isCommentEdited: (comment: GetComment) => boolean
  getCommentImagesList: (comment: GetComment) => string[]
}

/** Полный контекст, разделяемый узлами дерева комментариев. */
export interface CommentTreeContext {
  loader: ReturnType<typeof useCommentsLoader>
  replies: ReturnType<typeof useCommentsReplies>
  scoring: ReturnType<typeof useCommentsScoring>
  form: ReturnType<typeof useCommentForm>
  editDelete: ReturnType<typeof useCommentEditDelete>
  visibility: ReturnType<typeof useCommentVisibility>
  display: CommentDisplayHelpers
  currentUserAvatarUrl: Ref<string | null>
  currentUserInitial: Ref<string>
  filteredMentionUsers: Ref<MentionUser[]>
  onCommentMenuAction: (comment: GetComment, action: CommentMenuAction) => void
}

const commentTreeKey: InjectionKey<CommentTreeContext> = Symbol('comment-tree')

export function provideCommentTree(ctx: CommentTreeContext): void {
  provide(commentTreeKey, ctx)
}

export function useCommentTree(): CommentTreeContext {
  const ctx = inject(commentTreeKey)
  if (!ctx) {
    throw new Error('useCommentTree() must be called within PostCardComments provider')
  }
  return ctx
}
