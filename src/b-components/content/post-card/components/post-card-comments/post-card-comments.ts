import { defineComponent, type PropType } from 'vue'
import { Buffer } from 'buffer'
import { useAuthStore } from '@/blockchain'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { getUnspents, filterAvailableUnspents, selectBestUnspents, lockUTXOs } from '@/blockchain/core/transactions/unspents-manager'
import { appToast } from '@/b-components/app-toast'
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
  SC_ShowCommentsBtn,
  SC_ShowCommentsBtnSecondary,
  SC_ShowCommentsBtnCollapse,
  SC_CommentsActionsRow,
  SC_CommentsActionsLeft,
  SC_CommentsLoading,
  SC_CommentsSortRow,
  SC_CommentsSortSelect
} from './styled'

/** Пост в минимальном виде для блока комментариев */
export interface PostForComments {
  id?: string | number
  hash?: string
  txid?: string
  comments?: number
  lastComment?: {
    id: string
    address: string
    authorName: string
    avatar: string | null
    time: number
    message: string
    children: number
    scoreUp: number
    scoreDown: number
    /** Оценка текущего пользователя: 1 — лайк, -1 — дизлайк, 0/нет — не голосовал */
    myScore?: number
  }
}

const COMMENTS_PAGE_SIZE = 15
const COMMENTS_ALREADY_SHOWN = 1

export type CommentsSortOrder = 'interesting' | 'newest' | 'oldest'

/**
 * Отправка лайка/дизлайка комментария (cScore).
 * В старом приложении: type 'cScore', serialize = commentId + value, opreturn = commentAuthorAddress + " " + value.
 */
async function sendCommentScore(
  commentId: string,
  value: 1 | -1,
  commentAuthorAddress: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) {
    throw new Error('Нужна авторизация для оценки комментария')
  }
  if (!commentAuthorAddress) {
    throw new Error('Адрес автора комментария обязателен')
  }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) {
    throw new Error('Нет доступных unspents')
  }

  const selectedUnspents = selectBestUnspents(unspents, 0.00000001)
  if (selectedUnspents.length === 0) {
    throw new Error('Не удалось выбрать unspents для транзакции')
  }

  lockUTXOs(selectedUnspents)

  const serializedData = commentId + value.toString()
  const payloadString = `${commentAuthorAddress} ${value}`
  const opReturnData = [Buffer.from(payloadString, 'utf8')]
  const rpcData = { commentid: commentId, value: value.toString() }

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'cScore',
    opReturnData,
    fee: 0.00000001,
  })

  const response = await getByPRCWithAuth({
    method: 'sendrawtransactionwithmessage',
    parameters: [builtTx.hex, rpcData, 'cScore'],
    options: { auth: true }
  })

  if (typeof response === 'string') return response
  if (response && typeof response === 'object' && 'data' in response && typeof (response as { data?: string }).data === 'string') {
    return (response as { data: string }).data
  }
  if (response && typeof response === 'object' && 'result' in response && (response as { result?: string }).result === 'success' && 'data' in response) {
    return (response as { data: string }).data
  }
  const err = response && typeof response === 'object' && 'error' in response ? (response as { error: unknown }).error : null
  throw err instanceof Error ? err : new Error(String(err ?? 'Ошибка отправки оценки комментария'))
}

export const postCardCommentsOptions = defineComponent({
  name: 'PostCardComments',
  components: {
    LoadingOutlined,
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
    SC_ShowCommentsBtn,
    SC_ShowCommentsBtnSecondary,
    SC_ShowCommentsBtnCollapse,
    SC_CommentsActionsRow,
    SC_CommentsActionsLeft,
    SC_CommentsLoading,
    SC_CommentsSortRow,
    SC_CommentsSortSelect
  },
  props: {
    post: {
      type: Object as PropType<PostForComments>,
      required: true
    }
  },
  emits: ['collapsed', 'replyToComment'],
  data() {
    return {
      allComments: null as GetComment[] | null,
      allCommentsLoading: false,
      allCommentsError: null as Error | null,
      visibleCommentsCount: 0,
      commentsCollapsed: false,
      commentsSortOrder: 'newest' as CommentsSortOrder,
      /** Локальный голос по lastComment (до прихода myScore с сервера или после клика) */
      lastCommentVote: null as 'up' | 'down' | null,
      /** Локальные голоса по comment.id для развёрнутого списка */
      commentVotes: {} as Record<string, 'up' | 'down'>,
      /** id комментария или 'last' во время отправки оценки (блокируем повторный клик) */
      commentScoreSubmitting: null as string | null,
      /** Ответы второго уровня: parentId -> массив комментариев */
      repliesByParentId: {} as Record<string, GetComment[]>,
      /** Идёт ли загрузка ответов для parentId */
      repliesLoading: {} as Record<string, boolean>,
      /** Развёрнута ли ветка ответов для parentId (после загрузки можно свернуть) */
      repliesExpanded: {} as Record<string, boolean>
    }
  },
  computed: {
    postId(): string {
      return this.post.txid || this.post.hash || String(this.post.id || '')
    },
    hasUserComments(): boolean {
      const lc = this.post.lastComment
      const cnt = this.post.comments || 0
      return !!lc && !!lc.message && cnt > 0
    },
    lastCommentMessageHtml(): string {
      const text = this.post.lastComment?.message || ''
      return formatBastyonLinks(text)
    },
    lastCommentProfileLink(): string {
      const lc = this.post.lastComment
      if (!lc) return '/'
      const name = (lc.authorName || '').toLowerCase()
      const address = lc.address || ''
      if (address) return '/' + address
      if (name) return '/' + name
      return '/'
    },
    lastCommentAvatarUrl(): string | null {
      const img = this.post.lastComment?.avatar || null
      if (!img) return null
      if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
        return img.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      }
      return `https://pocketnet.app:8092/i/${img}`
    },
    lastCommentInitial(): string {
      const name = this.post.lastComment?.authorName || ''
      return this.getInitial(name)
    },
    lastCommentDateOnly(): string {
      const t = this.post.lastComment?.time || 0
      if (!t) return ''
      const d = new Date(t * 1000)
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
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
    /** После голоса оба значка cursor default; кликабельно только пока не голосовали и не идёт отправка */
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
      return this.sortComments([...this.allComments], this.commentsSortOrder)
    },
    visibleComments(): GetComment[] {
      return this.sortedComments.slice(0, this.visibleCommentsCount)
    },
    remainingCommentsCount(): number {
      const total = this.actualCommentsCount
      return Math.max(0, total - this.visibleCommentsCount)
    },
    nextCommentsPageSize(): number {
      const remaining = this.remainingCommentsCount
      return remaining <= 0 ? 0 : Math.min(COMMENTS_PAGE_SIZE, remaining)
    },
    hasMoreCommentsToShow(): boolean {
      return this.remainingCommentsCount > 0
    }
  },
  methods: {
    getInitial(nameOrLetter?: string): string {
      if (!nameOrLetter) return '?'
      if (nameOrLetter.length === 1) return nameOrLetter.toUpperCase()
      return nameOrLetter.charAt(0).toUpperCase()
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
        appToast.error(e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию')
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
        appToast.error(e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию')
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
        appToast.error(e instanceof Error ? e.message : 'Не удалось поставить лайк комментарию')
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
        appToast.error(e instanceof Error ? e.message : 'Не удалось поставить дизлайк комментарию')
      } finally {
        this.commentScoreSubmitting = null
      }
    },
    async loadAllComments(showAll = false): Promise<void> {
      if (!this.postId || this.allCommentsLoading) return
      this.allCommentsLoading = true
      this.allCommentsError = null
      const COMMENT_LOAD_TIMEOUT_MS = 25000
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Таймаут загрузки комментариев')), COMMENT_LOAD_TIMEOUT_MS)
      })
      try {
        const authStore = useAuthStore()
        const userAddress = authStore.getUserAddress ?? ''
        const res = await Promise.race([
          getByPRC({
            method: 'getcomments',
            parameters: [this.postId, '', userAddress],
            cachehash: Date.now().toString(36) + Math.random().toString(36).slice(2),
            options: { auth: authStore.isUserAuthenticated }
          }),
          timeoutPromise
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
      } finally {
        this.allCommentsLoading = false
      }
    },
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
        this.allComments.length
      )
    },
    showAllComments(): void {
      if (!this.allComments) return
      this.visibleCommentsCount = this.allComments.length
    },
    getCommentMessageText(comment: GetComment): string {
      try {
        const parsed = JSON.parse(comment.msg) as { message?: string }
        return parsed?.message ?? comment.msg
      } catch {
        return comment.msg
      }
    },
    commentPoint(comment: GetComment): number {
      let p = 0
      const msgLen = this.getCommentMessageText(comment).length
      const rep = comment.reputation ?? 0
      p += comment.scoreUp * 250
      p += comment.children * 450
      if (comment.scoreUp > comment.scoreDown) p += comment.scoreDown * 50
      else p -= comment.scoreDown * 1000
      p += Math.min(msgLen, 200) * 3
      p += Math.max(rep, 100) * 10 + rep / 20
      if (comment.deleted) p = p / 1300
      return p
    },
    sortComments(comments: GetComment[], order: CommentsSortOrder): GetComment[] {
      if (!comments.length) return comments
      if (order === 'oldest') {
        return [...comments].sort((a, b) => (a.time || 0) - (b.time || 0))
      }
      if (order === 'newest') {
        return [...comments].sort((a, b) => (b.time || 0) - (a.time || 0))
      }
      const times = comments.map(c => c.time || 0)
      const oldest = Math.min(...times)
      const newest = Math.max(...times)
      const range = newest - oldest || 1
      const byAuthor: Record<string, number> = {}
      for (const c of comments) {
        byAuthor[c.address] = (byAuthor[c.address] || 0) + 1
      }
      return [...comments].sort((a, b) => {
        const timecA = ((a.time || 0) - oldest) / range
        const timecB = ((b.time || 0) - oldest) / range
        const countA = byAuthor[a.address] || 1
        const countB = byAuthor[b.address] || 1
        const scoreA = -(this.commentPoint(a) + timecA * 3000) / countA
        const scoreB = -(this.commentPoint(b) + timecB * 3000) / countB
        return scoreA - scoreB
      })
    },
    getCommentAvatarUrl(profile: GetComment['userprofile']): string | null {
      const i = profile?.i
      if (!i) return null
      if (typeof i === 'string' && (i.startsWith('http://') || i.startsWith('https://'))) {
        return i.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      }
      return `https://pocketnet.app:8092/i/${i}`
    },
    formatCommentDate(time: number): string {
      if (!time) return ''
      const d = new Date(time * 1000)
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    },
    getCommentProfileLink(comment: GetComment): string {
      const name = (comment.userprofile?.name || '').toLowerCase()
      const address = comment.address || ''
      if (address) return '/' + address
      if (name) return '/' + name
      return '/'
    },
    formatCommentMessageHtml(comment: GetComment): string {
      return formatBastyonLinks(this.getCommentMessageText(comment))
    },
    /** Загрузить ответы второго уровня для комментария */
    async loadReplies(commentId: string): Promise<void> {
      if (!this.postId || this.repliesLoading[commentId]) return
      this.repliesLoading = { ...this.repliesLoading, [commentId]: true }
      this.repliesExpanded = { ...this.repliesExpanded, [commentId]: true }
      const authStore = useAuthStore()
      const userAddress = authStore.getUserAddress ?? ''
      try {
        const res = await getByPRC({
          method: 'getcomments',
          parameters: [this.postId, commentId, userAddress],
          cachehash: `replies-${commentId}-${Date.now()}`,
          options: { auth: authStore.isUserAuthenticated }
        })
        let list: GetComment[] = []
        if (Array.isArray(res)) {
          list = res as GetComment[]
        } else if (res && typeof res === 'object' && 'data' in res) {
          const data = (res as GetCommentsResponse).data
          list = Array.isArray(data) ? data : []
        }
        this.repliesByParentId = { ...this.repliesByParentId, [commentId]: list }
        this.repliesExpanded = { ...this.repliesExpanded, [commentId]: true }
      } catch {
        this.repliesByParentId = { ...this.repliesByParentId, [commentId]: [] }
        this.repliesExpanded = { ...this.repliesExpanded, [commentId]: true }
      } finally {
        this.repliesLoading = { ...this.repliesLoading, [commentId]: false }
      }
    },
    toggleRepliesExpanded(commentId: string): void {
      const expanded = this.repliesExpanded[commentId]
      this.repliesExpanded = { ...this.repliesExpanded, [commentId]: !expanded }
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
    /** Клик по "Ответы (N)": подгрузить ответы (если ещё не загружены) и показать; иначе переключить свёрнутость */
    onRepliesClick(comment: GetComment): void {
      const id = comment.id
      if (this.repliesLoading[id]) return
      if (id in this.repliesByParentId) {
        this.toggleRepliesExpanded(id)
      } else {
        this.loadReplies(id)
      }
    },
    /** Ответ на комментарий второго уровня: создаёт ответ с префиксом @UserAccountName, */
    onReplyToComment(reply: GetComment): void {
      const accountName = reply.userprofile?.name || reply.address || ''
      const prefix = accountName ? `@${accountName}, ` : ''
      this.$emit('replyToComment', {
        parentId: reply.id,
        postId: this.postId,
        replyTo: reply,
        prefix
      })
    }
  }
})
