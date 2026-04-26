import { defineComponent } from 'vue'
import { useAuthStore } from '@/blockchain'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import { LoadingOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import CommentAvatar from './comment-avatar.vue'
import CommentReplyPanel from './comment-reply-panel.vue'

import type { PostForComments, CommentsSortOrder, MentionUser } from './types'
import { COMMENTS_PAGE_SIZE, COMMENTS_ALREADY_SHOWN, COMMENT_LOAD_TIMEOUT_MS, MENTION_LIST_LIMIT } from './consts'
import { sendCommentScore } from './comment-scoring'
import { sendComment } from './comment-sender'
import {
  formatCommentMessageHtml,
  getCommentAvatarUrl,
  getCommentProfileLink,
  getInitial,
  formatCommentDateAndTime,
  sortComments,
} from './helpers'
import {
  SC_CommentsPreview,
  SC_CommentItem,
  SC_CommentRow,
  SC_CommentWithReplies,
  SC_CommentAuthor,
  SC_CommentText,
  SC_CommentContent,
  SC_CommentMeta,
  SC_CommentDate,
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
  SC_ShowCommentsBtn,
  SC_ShowCommentsBtnSecondary,
  SC_ShowCommentsBtnCollapse,
  SC_CommentsActionsRow,
  SC_CommentsActionsLeft,
  SC_CommentsLoading,
  SC_CommentsSortRow,
  SC_CommentsSortSelect,
} from './styled'

export { type PostForComments }

export const postCardCommentsOptions = defineComponent({
  name: 'PostCardComments',
  components: {
    LoadingOutlined,
    CloseOutlined,
    SendOutlined,
    CommentAvatar,
    CommentReplyPanel,
    SC_CommentsPreview,
    SC_CommentItem,
    SC_CommentRow,
    SC_CommentWithReplies,
    SC_CommentAuthor,
    SC_CommentText,
    SC_CommentContent,
    SC_CommentMeta,
    SC_CommentDate,
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
    SC_ShowCommentsBtn,
    SC_ShowCommentsBtnSecondary,
    SC_ShowCommentsBtnCollapse,
    SC_CommentsActionsRow,
    SC_CommentsActionsLeft,
    SC_CommentsLoading,
    SC_CommentsSortRow,
    SC_CommentsSortSelect,
  },
  props: {
    post: {
      type: Object as () => PostForComments,
      required: true,
    },
  },
  emits: ['collapsed', 'replyToComment', 'comment'],
  data() {
    return {
      allComments: null as GetComment[] | null,
      allCommentsLoading: false,
      allCommentsError: null as Error | null,
      visibleCommentsCount: 0,
      commentsCollapsed: false,
      commentsSortOrder: 'newest' as CommentsSortOrder,
      lastCommentVote: null as 'up' | 'down' | null,
      commentVotes: {} as Record<string, 'up' | 'down'>,
      commentScoreSubmitting: null as string | null,
      repliesByParentId: {} as Record<string, GetComment[]>,
      repliesLoading: {} as Record<string, boolean>,
      repliesExpanded: {} as Record<string, boolean>,
      replyTarget: null as { commentId: string; parentId: string; prefix: string } | null,
      replyDraft: '',
      showCancelReplyModal: false,
      showMentionList: false,
      mentionQuery: '',
      mentionStartOffset: 0,
      mentionEndOffset: 0,
      mentionHighlightIndex: 0,
      replySubmitting: false,
    }
  },
  computed: {
    postId(): string {
      return this.post.txid || this.post.hash || String(this.post.id || '')
    },
    hasUserComments(): boolean {
      const lc = this.post.lastComment
      return !!lc && !!lc.message && (this.post.comments || 0) > 0
    },
    lastCommentMessageHtml(): string {
      return formatCommentMessageHtml({
        msg: this.post.lastComment?.message || '',
      } as GetComment)
    },
    lastCommentProfileLink(): string {
      const lc = this.post.lastComment
      if (!lc) return '/'
      if (lc.address) return '/' + lc.address
      const name = (lc.authorName || '').toLowerCase()
      if (name) return '/' + name
      return '/'
    },
    lastCommentAvatarUrl(): string | null {
      const img = this.post.lastComment?.avatar || null
      if (!img) return null
      return resolveImageUrl(img) || null
    },
    lastCommentInitial(): string {
      return getInitial(this.post.lastComment?.authorName)
    },
    lastCommentDateOnly(): string {
      return formatCommentDateAndTime(this.post.lastComment?.time || 0)
    },
    totalCommentsCount(): number {
      return this.post.comments ?? 0
    },
    lastCommentUserLiked(): boolean {
      return (this.post.lastComment?.myScore ?? 0) > 0 || this.lastCommentVote === 'up'
    },
    lastCommentUserDisliked(): boolean {
      return (this.post.lastComment?.myScore ?? 0) < 0 || this.lastCommentVote === 'down'
    },
    lastCommentCanClickLike(): boolean {
      return !this.lastCommentUserDisliked && !this.lastCommentUserLiked && this.commentScoreSubmitting !== 'last'
    },
    lastCommentCanClickDislike(): boolean {
      return !this.lastCommentUserLiked && !this.lastCommentUserDisliked && this.commentScoreSubmitting !== 'last'
    },
    actualCommentsCount(): number {
      return this.allComments?.length ?? 0
    },
    sortedComments(): GetComment[] {
      if (!this.allComments) return []
      return sortComments([...this.allComments], this.commentsSortOrder)
    },
    visibleComments(): GetComment[] {
      return this.sortedComments.slice(0, this.visibleCommentsCount)
    },
    remainingCommentsCount(): number {
      return Math.max(0, this.actualCommentsCount - this.visibleCommentsCount)
    },
    nextCommentsPageSize(): number {
      return this.remainingCommentsCount <= 0 ? 0 : Math.min(COMMENTS_PAGE_SIZE, this.remainingCommentsCount)
    },
    hasMoreCommentsToShow(): boolean {
      return this.remainingCommentsCount > 0
    },
    currentUserAvatarUrl(): string | null {
      const url = useAuthStore().getUserAvatarUrl
      if (!url) return null
      return resolveImageUrl(url) || null
    },
    currentUserInitial(): string {
      const profile = useAuthStore().getUserProfile as { name?: string } | null
      const name = profile?.name
      if (name) return name.charAt(0).toUpperCase()
      const addr = useAuthStore().getUserAddress
      if (addr && typeof addr === 'string') return addr.charAt(0).toUpperCase()
      return '?'
    },
    mentionUsers(): MentionUser[] {
      const byAddress = new Map<string, string>()
      const add = (c: GetComment) => {
        if (!c?.address) return
        const name = (c.userprofile?.name || c.address || '').trim() || c.address
        if (!byAddress.has(c.address)) byAddress.set(c.address, name)
      }
      const lc = this.post.lastComment
      if (lc?.address) {
        const name = (lc.authorName || lc.address || '').trim() || lc.address
        if (!byAddress.has(lc.address)) byAddress.set(lc.address, name)
      }
      if (this.allComments) {
        for (const c of this.allComments) add(c)
      }
      for (const list of Object.values(this.repliesByParentId)) {
        if (Array.isArray(list)) for (const c of list) add(c)
      }
      return Array.from(byAddress.entries()).map(([address, name]) => ({ address, name }))
    },
    filteredMentionUsers(): MentionUser[] {
      const q = (this.mentionQuery || '').trim().toLowerCase()
      if (!q) return this.mentionUsers.slice(0, MENTION_LIST_LIMIT)
      return this.mentionUsers
        .filter((u) => (u.name || '').toLowerCase().includes(q) || (u.address || '').toLowerCase().includes(q))
        .slice(0, MENTION_LIST_LIMIT)
    },
    lastCommentId(): string | null {
      return this.post.lastComment?.id ?? null
    },
    lastCommentChildren(): number {
      return this.post.lastComment?.children ?? 0
    },
    replyPanelKey(): string {
      const t = this.replyTarget
      if (!t) return 'closed'
      return `${t.commentId}:${t.prefix ? 'author' : 'empty'}`
    },
    isRootReplyActive(): boolean {
      return this.replyTarget === null || this.replyTarget?.commentId === 'root'
    },
  },
  methods: {
    // --- Делегаты в хелперы ---
    getCommentAvatarUrl,
    getCommentProfileLink,
    formatCommentDate: formatCommentDateAndTime,
    formatCommentMessageHtml,

    isReplyPanelOpen(commentId: string): boolean {
      return this.replyTarget?.commentId === commentId
    },
    isCommentLiked(comment: GetComment): boolean {
      return (comment.myScore ?? 0) > 0 || this.commentVotes[comment.id] === 'up'
    },
    isCommentDisliked(comment: GetComment): boolean {
      return (comment.myScore ?? 0) < 0 || this.commentVotes[comment.id] === 'down'
    },
    commentCanClickLike(comment: GetComment): boolean {
      return !this.isCommentDisliked(comment) && !this.isCommentLiked(comment) && this.commentScoreSubmitting !== comment.id
    },
    commentCanClickDislike(comment: GetComment): boolean {
      return !this.isCommentLiked(comment) && !this.isCommentDisliked(comment) && this.commentScoreSubmitting !== comment.id
    },

    // --- Голосование ---
    async onLastCommentScoreUp(): Promise<void> {
      if (!this.lastCommentCanClickLike || this.commentScoreSubmitting) return
      const lc = this.post.lastComment
      if (!lc?.id || !lc.address) return
      this.commentScoreSubmitting = 'last'
      const prev = this.lastCommentVote
      this.lastCommentVote = 'up'
      try {
        await sendCommentScore(lc.id, 1, lc.address)
      } catch (e) {
        this.lastCommentVote = prev
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию' })
      } finally {
        this.commentScoreSubmitting = null
      }
    },
    async onLastCommentScoreDown(): Promise<void> {
      if (!this.lastCommentCanClickDislike || this.commentScoreSubmitting) return
      const lc = this.post.lastComment
      if (!lc?.id || !lc.address) return
      this.commentScoreSubmitting = 'last'
      const prev = this.lastCommentVote
      this.lastCommentVote = 'down'
      try {
        await sendCommentScore(lc.id, -1, lc.address)
      } catch (e) {
        this.lastCommentVote = prev
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию' })
      } finally {
        this.commentScoreSubmitting = null
      }
    },
    async onCommentScoreUp(comment: GetComment): Promise<void> {
      if (!this.commentCanClickLike(comment) || this.commentScoreSubmitting) return
      this.commentScoreSubmitting = comment.id
      const prev = this.commentVotes[comment.id]
      this.commentVotes = { ...this.commentVotes, [comment.id]: 'up' }
      try {
        await sendCommentScore(comment.id, 1, comment.address)
      } catch (e) {
        const next = prev ? { [comment.id]: prev } : {}
        const rest = { ...this.commentVotes }
        delete rest[comment.id]
        this.commentVotes = { ...rest, ...next }
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию' })
      } finally {
        this.commentScoreSubmitting = null
      }
    },
    async onCommentScoreDown(comment: GetComment): Promise<void> {
      if (!this.commentCanClickDislike(comment) || this.commentScoreSubmitting) return
      this.commentScoreSubmitting = comment.id
      const prev = this.commentVotes[comment.id]
      this.commentVotes = { ...this.commentVotes, [comment.id]: 'down' }
      try {
        await sendCommentScore(comment.id, -1, comment.address)
      } catch (e) {
        const next = prev ? { [comment.id]: prev } : {}
        const rest = { ...this.commentVotes }
        delete rest[comment.id]
        this.commentVotes = { ...rest, ...next }
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию' })
      } finally {
        this.commentScoreSubmitting = null
      }
    },

    // --- Загрузка комментариев ---
    async loadAllComments(showAll = false): Promise<void> {
      if (!this.postId || this.allCommentsLoading) return
      this.allCommentsLoading = true
      try {
        await this.loadAllCommentsInternal(showAll)
      } finally {
        this.allCommentsLoading = false
      }
    },
    async loadAllCommentsInternal(showAll = false): Promise<void> {
      if (!this.postId) return
      this.allCommentsError = null
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Таймаут загрузки комментариев')), COMMENT_LOAD_TIMEOUT_MS)
        })
        const authStore = useAuthStore()
        const userAddress = authStore.getUserAddress ?? ''
        const res = await Promise.race([
          getByPRC({
            method: rpcEndpoints.getComments,
            parameters: [this.postId, '', userAddress],
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
        this.allComments = list
        const len = list.length
        const initialVisible = COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE
        this.visibleCommentsCount = showAll ? len : Math.min(initialVisible, len)
        this.commentsCollapsed = false
      } catch (e) {
        this.allCommentsError = e instanceof Error ? e : new Error(String(e))
      }
    },
    async onLastCommentRepliesClick(): Promise<void> {
      const id = this.post.lastComment?.id
      if (!id) return
      if (!this.allComments) {
        await this.loadAllComments(false)
      } else if (this.commentsCollapsed) {
        this.expandComments()
      }
      this.repliesExpanded = { ...this.repliesExpanded, [id]: true }
      await this.loadReplies(id)
    },

    // --- Навигация комментариев ---
    collapseComments(): void {
      this.commentsCollapsed = true
      this.$emit('collapsed')
    },
    expandComments(): void {
      this.commentsCollapsed = false
    },
    setCommentsSortOrder(event: Event): void {
      const value = (event.target as HTMLSelectElement)?.value
      if (value === 'interesting' || value === 'newest' || value === 'oldest') {
        this.commentsSortOrder = value
      }
    },
    showMoreComments(): void {
      if (!this.allComments) return
      this.visibleCommentsCount = Math.min(
        this.visibleCommentsCount + COMMENTS_PAGE_SIZE,
        this.allComments.length,
      )
    },
    showAllComments(): void {
      if (!this.allComments) return
      this.visibleCommentsCount = this.allComments.length
    },

    // --- Ответы второго уровня ---
    async loadReplies(commentId: string): Promise<void> {
      if (!this.postId || this.repliesLoading[commentId]) return
      this.repliesLoading = { ...this.repliesLoading, [commentId]: true }
      this.repliesExpanded = { ...this.repliesExpanded, [commentId]: true }
      const authStore = useAuthStore()
      const userAddress = authStore.getUserAddress ?? ''
      try {
        const res = await getByPRC({
          method: rpcEndpoints.getComments,
          parameters: [this.postId, commentId, userAddress],
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
        this.repliesByParentId = { ...this.repliesByParentId, [commentId]: list }
      } catch {
        this.repliesByParentId = { ...this.repliesByParentId, [commentId]: [] }
      } finally {
        this.repliesLoading = { ...this.repliesLoading, [commentId]: false }
      }
    },
    toggleRepliesExpanded(commentId: string): void {
      this.repliesExpanded = { ...this.repliesExpanded, [commentId]: !this.repliesExpanded[commentId] }
    },
    isRepliesExpanded(commentId: string): boolean {
      return !!this.repliesExpanded[commentId]
    },
    isRepliesLoading(commentId: string): boolean {
      return !!this.repliesLoading[commentId]
    },
    getReplies(commentId: string): GetComment[] {
      return this.repliesByParentId[commentId] ?? []
    },
    onRepliesClick(comment: GetComment): void {
      const id = comment.id
      if (this.repliesLoading[id]) return
      if (id in this.repliesByParentId) {
        this.toggleRepliesExpanded(id)
      } else {
        this.loadReplies(id)
      }
    },

    // --- Форма ответа ---
    openReplyToPost(): void {
      this.replyTarget = { commentId: 'root', parentId: '', prefix: '' }
      this.replyDraft = ''
      this.showCancelReplyModal = false
      this.showMentionList = false
      this.mentionQuery = ''
      this.mentionHighlightIndex = 0
    },
    onLastCommentReply(): void {
      const id = this.post.lastComment?.id
      if (!id) return
      this.openReplyEmpty(id, id)
    },
    onLastCommentReplyToAuthor(): void {
      const lc = this.post.lastComment
      if (!lc?.id) return
      this.openReplyToAuthor(lc.id, lc.id, lc.authorName || lc.address || '')
    },
    openReplyEmpty(commentId: string, parentId: string): void {
      const sameComment = this.replyTarget?.commentId === commentId
      const oldPrefix = this.replyTarget?.prefix || ''
      this.replyTarget = { commentId, parentId, prefix: '' }
      this.showCancelReplyModal = false
      this.showMentionList = false
      this.mentionQuery = ''
      this.mentionHighlightIndex = 0
      if (sameComment && oldPrefix && (this.replyDraft || '').startsWith(oldPrefix)) {
        this.replyDraft = (this.replyDraft || '').slice(oldPrefix.length).trim()
      } else if (!sameComment) {
        this.replyDraft = ''
      }
    },
    openReplyToAuthor(commentId: string, parentId: string, authorName: string): void {
      const prefix = authorName ? `@${authorName}, ` : ''
      const sameComment = this.replyTarget?.commentId === commentId
      this.replyTarget = { commentId, parentId, prefix }
      this.showCancelReplyModal = false
      this.showMentionList = false
      this.mentionQuery = ''
      this.mentionHighlightIndex = 0
      if (sameComment && !(this.replyDraft || '').startsWith(prefix)) {
        this.replyDraft = prefix + (this.replyDraft || '')
      } else if (!sameComment) {
        this.replyDraft = prefix
      }
    },
    requestCloseReply(): void {
      if ((this.replyDraft || '').trim() && this.replyDraft !== (this.replyTarget?.prefix || '')) {
        this.showCancelReplyModal = true
      } else {
        this.closeReply()
      }
    },
    closeReply(): void {
      this.replyTarget = null
      this.replyDraft = ''
      this.showCancelReplyModal = false
      this.showMentionList = false
      this.mentionQuery = ''
    },
    confirmCancelReply(): void {
      this.closeReply()
    },
    async sendReply(): Promise<void> {
      const text = (this.replyDraft || '').trim()
      if (!text || this.replySubmitting) return
      const isRootComment = this.isRootReplyActive
      if (!isRootComment && !this.replyTarget) return
      this.replySubmitting = true
      const parentId = isRootComment ? '' : (this.replyTarget!.parentId)
      const answerId = isRootComment ? '' : (this.replyTarget!.commentId)
      try {
        await sendComment(this.postId, parentId, answerId, text)
        appToast.success({ message: 'Комментарий отправлен' })
        this.closeReply()
        this.$emit('comment')
        if (this.allComments) {
          await this.loadAllCommentsInternal(false)
        }
      } catch (e) {
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось отправить комментарий' })
      } finally {
        this.replySubmitting = false
      }
    },
    onReplyToFirstLevel(comment: GetComment): void {
      this.openReplyEmpty(comment.id, comment.id)
    },
    onReplyToAuthorFirstLevel(comment: GetComment): void {
      this.openReplyToAuthor(comment.id, comment.id, comment.userprofile?.name || comment.address || '')
    },
    onReplyToSecondLevel(reply: GetComment): void {
      this.openReplyEmpty(reply.id, reply.id)
    },
    onReplyToComment(reply: GetComment): void {
      this.openReplyToAuthor(reply.id, reply.id, reply.userprofile?.name || reply.address || '')
    },

    // --- @Упоминания ---
    onRootBarFocus(): void {
      if (!this.isRootReplyActive) this.openReplyToPost()
    },
    handleRootReplyInput(e: Event): void {
      if (!this.isRootReplyActive) return
      const el = e.target as HTMLTextAreaElement
      if (el) this.replyDraft = el.value
      this.handleReplyInput(e)
    },
    handleReplyInput(e: Event): void {
      const el = e.target as HTMLTextAreaElement
      if (!el) return
      const value = el.value
      const pos = el.selectionStart ?? value.length
      const before = value.slice(0, pos)
      const lastAt = before.lastIndexOf('@')
      if (lastAt === -1) {
        this.showMentionList = false
        this.mentionQuery = ''
        return
      }
      const afterAt = before.slice(lastAt + 1)
      if (/\s/.test(afterAt)) {
        this.showMentionList = false
        return
      }
      this.mentionStartOffset = lastAt
      this.mentionEndOffset = pos
      this.mentionQuery = afterAt
      this.mentionHighlightIndex = 0
      this.showMentionList = true
    },
    handleReplyKeydown(e: KeyboardEvent): void {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const text = (this.replyDraft || '').trim()
        if (text && this.replyTarget && !this.replySubmitting) {
          this.sendReply()
        }
        return
      }
      if (this.showMentionList && this.filteredMentionUsers.length > 0) {
        if (e.key === 'Escape') {
          this.showMentionList = false
          e.preventDefault()
          return
        }
        if (e.key === 'ArrowDown') {
          this.mentionHighlightIndex = Math.min(this.mentionHighlightIndex + 1, this.filteredMentionUsers.length - 1)
          this.$nextTick(() => this.scrollMentionHighlightIntoView())
          e.preventDefault()
          return
        }
        if (e.key === 'ArrowUp') {
          this.mentionHighlightIndex = Math.max(this.mentionHighlightIndex - 1, 0)
          this.$nextTick(() => this.scrollMentionHighlightIntoView())
          e.preventDefault()
          return
        }
        if (e.key === 'Enter') {
          const user = this.filteredMentionUsers[this.mentionHighlightIndex]
          if (user) {
            this.selectMentionUser(user)
            e.preventDefault()
          }
          return
        }
      }
    },
    scrollMentionHighlightIntoView(): void {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          const ref = this.isRootReplyActive ? this.$refs.rootMentionListRef : this.$refs.mentionListRef
          const raw = Array.isArray(ref) ? ref[0] : ref
          const listEl = raw && (raw as HTMLElement).scrollTop !== undefined
            ? (raw as HTMLElement)
            : (raw as { $el?: HTMLElement })?.$el
          if (!listEl || !listEl.children || listEl.clientHeight <= 0) return
          const child = listEl.children[this.mentionHighlightIndex] as HTMLElement | undefined
          if (!child) return
          child.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        })
      })
    },
    selectMentionUser(user: MentionUser): void {
      const insert = `@${user.name} `
      const before = (this.replyDraft || '').slice(0, this.mentionStartOffset)
      const endPos = this.mentionEndOffset
      const after = (this.replyDraft || '').slice(endPos)
      this.replyDraft = before + insert + after
      this.showMentionList = false
      this.mentionQuery = ''
      this.mentionHighlightIndex = 0
      this.$nextTick(() => {
        const ref = this.isRootReplyActive ? this.$refs.rootReplyTextareaRef : this.$refs.replyTextareaRef
        const el = ref && typeof (ref as HTMLTextAreaElement).focus === 'function'
          ? (ref as HTMLTextAreaElement)
          : (ref as { $el?: HTMLTextAreaElement })?.$el
        if (el && typeof el.focus === 'function') {
          el.focus()
          const newPos = before.length + insert.length
          el.setSelectionRange(newPos, newPos)
        }
      })
    },
  },
})
