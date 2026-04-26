import { defineComponent, h } from 'vue'
import { Modal } from 'ant-design-vue'
import { useAuthStore } from '@/blockchain'
import { useCommentsStore, type PendingComment } from '@/stores'
import { wsService } from '@/blockchain/ws/ws-service'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import type { GetCommentsResponse, GetComment } from '@/types/rpc-responses/get-comments'
import {
  LoadingOutlined,
  CloseOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import CommentAvatar from './comment-avatar.vue'
import CommentReplyPanel from './comment-reply-panel.vue'
import CommentMenu, { type CommentMenuAction } from './comment-menu.vue'
import CommentEditForm from './comment-edit-form.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'

import type { PostForComments, CommentsSortOrder, MentionUser } from './types'
import { COMMENTS_PAGE_SIZE, COMMENTS_ALREADY_SHOWN, COMMENT_LOAD_TIMEOUT_MS, MENTION_LIST_LIMIT } from './consts'
import { sendCommentScore } from './comment-scoring'
import { sendComment } from './comment-sender'
import { deleteComment } from './comment-deleter'
import {
  formatCommentMessageHtml,
  getCommentAvatarUrl,
  getCommentProfileLink,
  getInitial,
  formatCommentDateAndTime,
  sortComments,
  getCommentLengthHint,
  isCommentLengthValid,
  getCommentTxState,
  getCommentImages,
  compressedNumber,
} from './helpers'
import { formatRelativeTime } from '@/helpers/common/date-formatter'
import { haptic } from '@/helpers/common/haptics'
import {
  isHiddenByReputation as visIsHiddenByReputation,
  isAuthorAccountLocked as visIsAuthorAccountLocked,
  getCommentPostingDisableReason,
  getCommentScoringDisableReason,
  shouldShowScamWarningOnDislike,
  type DisableReason,
} from './visibility'
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
      type: Object as () => PostForComments,
      required: true,
    },
  },
  emits: ['collapsed', 'replyToComment', 'comment'],
  created() {
    // WS unsubscribe-функция и таймеры не должны реактивиться,
    // храним их прямо на инстансе (вне data()).
    ;(this as unknown as { _wsUnsub: null | (() => void) })._wsUnsub = null
    ;(this as unknown as { _refreshDebounce: number | null })._refreshDebounce = null
    ;(this as unknown as { _relativeTimer: number | null })._relativeTimer = null
    this.subscribeToWs()
    // Тикаем раз в минуту, чтобы относительное время в шаблоне обновлялось
    // (formatCommentDate читает this.nowTick).
    ;(this as unknown as { _relativeTimer: number | null })._relativeTimer = window.setInterval(() => {
      this.nowTick++
    }, 60_000)
  },
  beforeUnmount() {
    this.unsubscribeFromWs()
    const dbg = (this as unknown as { _refreshDebounce: number | null })
    if (dbg._refreshDebounce !== null) {
      clearTimeout(dbg._refreshDebounce!)
      dbg._refreshDebounce = null
    }
    const rel = (this as unknown as { _relativeTimer: number | null })
    if (rel._relativeTimer !== null) {
      clearInterval(rel._relativeTimer)
      rel._relativeTimer = null
    }
  },
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
      commentDeleteSubmitting: null as string | null,
      // Состояние inline-редактирования: id редактируемого комментария + черновик
      editingCommentId: null as string | null,
      editDraft: '',
      editInitialDraft: '',
      editSubmitting: false,
      /** Реактивный тик для пересчёта относительного времени (инкрементится раз в минуту) */
      nowTick: 0,
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
      void this.nowTick // зависимость от тика для авто-обновления
      return formatRelativeTime(this.post.lastComment?.time || 0)
    },
    lastCommentDateFull(): string {
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
    /** Pending-комменты к этому посту, конвертированные в GetComment для рендера */
    pendingRootComments(): GetComment[] {
      const list = useCommentsStore().getPendingForPost(this.postId)
      if (!list.length) return []
      return list
        .filter((p) => !p.parentId) // только корневые здесь — ответы вшиваются в getReplies
        .map((p) => pendingToGetComment(p))
    },
    sortedComments(): GetComment[] {
      const real = this.allComments ?? []
      const all = [...real, ...this.pendingRootComments]
      if (!all.length) return []
      // Карта репутаций авторов из ответа getcomments — для дешёвой проверки в isBlocked.
      // (Скрытые-по-репутации идут в самый низ через обнуление веса в commentPoint.)
      const lowRepAuthors = new Set<string>()
      for (const c of all) {
        if (visIsHiddenByReputation(c, this.currentUserAddress || undefined)) {
          lowRepAuthors.add(c.address)
        }
      }
      return sortComments(all, this.commentsSortOrder, {
        myAddress: this.currentUserAddress || undefined,
        postAuthorAddress: this.postAuthorAddress || undefined,
        // Эвристический isBlocked: пока user-relations store нет, единственный
        // надёжный сигнал «не показывать наверх» — низкая репутация автора.
        isBlocked: (address) => lowRepAuthors.has(address),
        // isVerified / getActivityPoint — TBD (нужен activity / verified сигнал из API).
      })
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
    rootLengthHint(): { text: string; isOver: boolean } | null {
      return getCommentLengthHint(this.replyDraft || '')
    },
    rootLengthValid(): boolean {
      return isCommentLengthValid(this.replyDraft || '')
    },
    currentUserAddress(): string {
      const addr = useAuthStore().getUserAddress
      return typeof addr === 'string' ? addr : ''
    },
    postAuthorAddress(): string {
      // PostForComments сейчас не несёт адрес автора поста; пробуем расширенные поля,
      // если они вдруг есть в реальном объекте поста (легаси использует post.address).
      const p = this.post as PostForComments & { address?: string }
      return typeof p?.address === 'string' ? p.address : ''
    },
    /** Локальный лукап удалённых через общий стор */
    deletedCommentIdsMap(): Record<string, true> {
      return useCommentsStore().deletedCommentIds
    },
    /** Локальный лукап правок через общий стор */
    editedMessagesMap(): Record<string, string> {
      return useCommentsStore().editedMessages
    },
    /** Состояние пользователя для проверки лимитов и репутации */
    currentUserStateData(): import('@/types/rpc-responses/user-state').UserState | null {
      const auth = useAuthStore()
      const profile = auth.getUserProfile as
        | (import('@/types/rpc-responses/user-state').UserState & { reputation?: number })
        | null
      return profile ?? null
    },
    /** Причина запрета публикации (или null если можно) */
    composerDisableReason(): DisableReason | null {
      const auth = useAuthStore()
      return getCommentPostingDisableReason(auth.isUserAuthenticated, this.currentUserStateData)
    },
    /** Причина запрета оценок (или null если можно) */
    scoringDisableReason(): DisableReason | null {
      const auth = useAuthStore()
      return getCommentScoringDisableReason(auth.isUserAuthenticated, this.currentUserStateData)
    },
  },
  methods: {
    // --- Делегаты в хелперы ---
    getCommentAvatarUrl,
    getCommentProfileLink,
    /**
     * Относительное время комментария («5 мин.», «2 ч.»). Зависит от nowTick —
     * Vue пересчитывает при тике (раз в минуту), поэтому надписи обновляются
     * без перезагрузки. Полная дата доступна через formatCommentDateFull для тултипа.
     */
    formatCommentDate(time: number): string {
      // Принудительное чтение nowTick для триггера реактивности
      void this.nowTick
      return formatRelativeTime(time)
    },
    /** Полная дата для тултипа (title-атрибут) */
    formatCommentDateFull(time: number): string {
      return formatCommentDateAndTime(time)
    },
    /** Картинки комментария (резолвленные URL) для рендера в PostCardImages */
    getCommentImagesList(comment: GetComment): string[] {
      return getCommentImages(comment)
    },
    /**
     * Форматирует число для отображения у бейджа score.
     * Для 0 возвращает '0' — UI всегда показывает какую-то цифру (отличие от legacy,
     * где compressedNumber для 0 возвращал ''; нам это не подходит, потому что
     * у нас 0 рендерится явно для UX «есть кнопка, есть число»).
     */
    formatScore(n: number | undefined | null): string {
      if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return '0'
      return compressedNumber(n) || String(n)
    },
    formatCommentMessageHtml(comment: GetComment): string {
      // Если есть локальная правка после успешного commentEdit — показываем её,
      // не дожидаясь повторной загрузки списка / WS-обновления.
      const overridden = this.editedMessagesMap[comment.id]
      if (typeof overridden === 'string') {
        // Сборка временного объекта с переопределённым msg для корректного форматирования
        const patched = { ...comment, msg: JSON.stringify({ message: overridden, url: '', images: [], info: '' }) } as GetComment
        return formatCommentMessageHtml(patched)
      }
      return formatCommentMessageHtml(comment)
    },
    isCommentEdited(comment: GetComment): boolean {
      // Локальная правка ИЛИ серверный признак редактирования
      if (typeof this.editedMessagesMap[comment.id] === 'string') return true
      return !!comment.edit || (comment.timeUpd > comment.time)
    },

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
    /**
     * Гард перед голосованием: проверяет лимит/репутацию и для дизлайка
     * запрашивает подтверждение если сработала эвристика scam-риска.
     * Возвращает true если можно продолжать.
     */
    async ensureCanScore(value: 1 | -1): Promise<boolean> {
      const reason = this.scoringDisableReason
      if (reason) {
        appToast.error({ message: reason.message })
        return false
      }
      if (value < 0 && shouldShowScamWarningOnDislike(this.currentUserStateData)) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Поставить дизлайк?',
            icon: h(ExclamationCircleOutlined),
            content:
              'Слишком много дизлайков может негативно сказаться на вашей репутации. Продолжить?',
            okText: 'Поставить дизлайк',
            okType: 'danger',
            cancelText: 'Отмена',
            centered: true,
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return false
      }
      return true
    },
    async onLastCommentScoreUp(): Promise<void> {
      if (!this.lastCommentCanClickLike || this.commentScoreSubmitting) return
      const lc = this.post.lastComment
      if (!lc?.id || !lc.address) return
      if (!(await this.ensureCanScore(1))) return
      haptic('small')
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
      if (!(await this.ensureCanScore(-1))) return
      haptic('small')
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
      if (!(await this.ensureCanScore(1))) return
      haptic('small')
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
      if (!(await this.ensureCanScore(-1))) return
      haptic('small')
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
        // Согласовываем локальные оверрайды с серверными данными:
        // если сервер уже знает о наших правках/удалениях/созданиях — снимаем локальные метки.
        useCommentsStore().reconcileWithServer(this.postId, list)
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
      const real = this.repliesByParentId[commentId] ?? []
      // Примешиваем локальные pending-ответы к этому комментарию,
      // чтобы пользователь сразу видел свой ответ под нужной веткой.
      const pendingAll = useCommentsStore().getPendingForPost(this.postId)
      if (!pendingAll.length) return real
      const pendingForBranch = pendingAll
        .filter((p) => p.parentId === commentId)
        .map((p) => pendingToGetComment(p))
      if (!pendingForBranch.length) return real
      // Дедуп по id: если pending уже среди реальных — серверный приоритет
      const seen = new Set(real.map((c) => c.id))
      const extras = pendingForBranch.filter((c) => !seen.has(c.id))
      return [...real, ...extras]
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
      if (!isCommentLengthValid(text)) {
        appToast.error({ message: 'Текст комментария превышает допустимую длину' })
        return
      }
      if (this.composerDisableReason) {
        appToast.error({ message: this.composerDisableReason.message })
        return
      }
      const isRootComment = this.isRootReplyActive
      if (!isRootComment && !this.replyTarget) return
      this.replySubmitting = true
      const parentId = isRootComment ? '' : (this.replyTarget!.parentId)
      const answerId = isRootComment ? '' : (this.replyTarget!.commentId)
      try {
        const txid = await sendComment(this.postId, parentId, answerId, text)
        haptic('small')
        appToast.success({ message: 'Комментарий отправлен' })
        this.closeReply()
        this.$emit('comment')
        // Регистрируем pending в общем сторе — отображается в списке как "Ожидание"
        // до прихода подтверждения через RPC reconcile / WS.
        if (txid) {
          const me = this.currentUserAddress
          useCommentsStore().addPending({
            id: txid,
            postId: this.postId,
            message: text,
            parentId: parentId || '',
            answerId: answerId || '',
            address: me,
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000,
          })
        }
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

    // --- Видимость комментария ---
    /** Скрыт ли коммент по правилам видимости (репутация автора и т.п.) */
    isCommentHiddenByVisibility(comment: GetComment): boolean {
      const me = this.currentUserAddress || undefined
      if (visIsHiddenByReputation(comment, me)) return true
      if (visIsAuthorAccountLocked(comment)) return true
      return false
    },
    /** Раскрыл ли пользователь скрытый коммент через «Показать всё равно» */
    isHiddenRevealed(comment: GetComment): boolean {
      return useCommentsStore().isRevealed(comment.id)
    },
    /** Должен ли быть скрыт контент (с учётом revealed-флага) */
    shouldHideContent(comment: GetComment): boolean {
      if (this.isCommentDeleted(comment)) return false
      if (!this.isCommentHiddenByVisibility(comment)) return false
      return !this.isHiddenRevealed(comment)
    },
    revealHiddenComment(comment: GetComment): void {
      useCommentsStore().revealHidden(comment.id)
    },

    // --- Контекстное меню комментария ---
    isCommentDeleted(comment: GetComment): boolean {
      return !!comment.deleted || this.deletedCommentIdsMap[comment.id] === true
    },
    canShowMenu(comment: GetComment): boolean {
      // Меню скрываем для удалённых, и для случая когда у пользователя нет доступных действий
      if (this.isCommentDeleted(comment)) return false
      return this.canEditComment(comment) || this.canDeleteComment(comment)
    },
    canEditComment(comment: GetComment): boolean {
      // Только свой, не удалённый, не в pending/rejected (legacy: metmenu.html:51-62)
      const me = this.currentUserAddress
      if (!me || comment.address !== me) return false
      if (this.isCommentDeleted(comment)) return false
      if (getCommentTxState(comment) !== 'normal') return false
      return true
    },
    canDeleteComment(comment: GetComment): boolean {
      const me = this.currentUserAddress
      if (!me || this.isCommentDeleted(comment)) return false
      if (getCommentTxState(comment) !== 'normal') return false
      // Свой комментарий — можно. Автор поста может удалять чужие (модерация).
      if (comment.address === me) return true
      if (this.postAuthorAddress && this.postAuthorAddress === me) return true
      return false
    },
    /** Pending TX (свой комментарий, который ещё не подтверждён) */
    isCommentPending(comment: GetComment): boolean {
      return getCommentTxState(comment) === 'pending'
    },
    /** Rejected TX (свой комментарий, отклонённый сетью) */
    isCommentRejected(comment: GetComment): boolean {
      return getCommentTxState(comment) === 'rejected'
    },
    /** Может ли пользователь голосовать / отвечать на этот комментарий */
    canInteractWithComment(comment: GetComment): boolean {
      if (this.isCommentDeleted(comment)) return false
      if (getCommentTxState(comment) !== 'normal') return false
      return true
    },
    onCommentMenuAction(comment: GetComment, action: CommentMenuAction): void {
      if (action === 'delete') {
        this.confirmDeleteComment(comment)
        return
      }
      if (action === 'edit') {
        this.openEditComment(comment)
        return
      }
    },
    confirmDeleteComment(comment: GetComment): void {
      Modal.confirm({
        title: 'Удалить комментарий?',
        icon: h(ExclamationCircleOutlined),
        content: 'Действие нельзя отменить — комментарий будет помечен как удалённый.',
        okText: 'Удалить',
        okType: 'danger',
        cancelText: 'Отмена',
        centered: true,
        onOk: () => this.deleteCommentInternal(comment),
      })
    },
    async deleteCommentInternal(comment: GetComment): Promise<void> {
      if (this.commentDeleteSubmitting === comment.id) return
      this.commentDeleteSubmitting = comment.id
      const commentsStore = useCommentsStore()
      // Optimistic: сразу прячем меню/контент через флаг в общем сторе;
      // при ошибке откатываем — иначе оверрайд снимется при reconcile с RPC / при WS подтверждении.
      commentsStore.markDeleted(comment.id)
      try {
        await deleteComment({
          postId: this.postId,
          commentId: comment.id,
          parentId: comment.parentid || '',
          answerId: comment.answerid || '',
        })
        haptic('medium')
        appToast.success({ message: 'Комментарий удалён' })
      } catch (e) {
        commentsStore.unmarkDeleted(comment.id)
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось удалить комментарий' })
      } finally {
        this.commentDeleteSubmitting = null
      }
    },

    // --- Inline-редактирование ---
    isEditingComment(comment: GetComment): boolean {
      return this.editingCommentId === comment.id
    },
    /** Текущий текст сообщения как plain (для предзаполнения формы редактирования) */
    getCommentMessagePlain(comment: GetComment): string {
      // Если есть локальный override (свежий commentEdit) — используем его,
      // иначе парсим JSON-форму msg, либо возвращаем raw.
      const overridden = this.editedMessagesMap[comment.id]
      if (typeof overridden === 'string') return overridden
      try {
        const parsed = JSON.parse(comment.msg) as { message?: string }
        return parsed?.message ?? comment.msg
      } catch {
        return comment.msg
      }
    },
    openEditComment(comment: GetComment): void {
      // Если открыта другая редактура с непустым изменением — закрыть тихо.
      // (для упрощения: не сохраняем черновик между разными комментариями)
      const initial = this.getCommentMessagePlain(comment)
      this.editingCommentId = comment.id
      this.editDraft = initial
      this.editInitialDraft = initial
      this.editSubmitting = false
    },
    requestCloseEdit(): void {
      // Если изменений нет — закрываем без подтверждения, иначе — confirm-modal
      if ((this.editDraft || '') === (this.editInitialDraft || '')) {
        this.closeEdit()
        return
      }
      Modal.confirm({
        title: 'Отменить изменения?',
        icon: h(ExclamationCircleOutlined),
        content: 'Введённый текст не будет сохранён.',
        okText: 'Да, отменить',
        cancelText: 'Нет',
        centered: true,
        onOk: () => this.closeEdit(),
      })
    },
    closeEdit(): void {
      this.editingCommentId = null
      this.editDraft = ''
      this.editInitialDraft = ''
      this.editSubmitting = false
    },
    async submitEdit(): Promise<void> {
      const id = this.editingCommentId
      if (!id || this.editSubmitting) return
      const text = (this.editDraft || '').trim()
      if (!text) return
      if (!isCommentLengthValid(text)) {
        appToast.error({ message: 'Текст комментария превышает допустимую длину' })
        return
      }
      if (text === (this.editInitialDraft || '').trim()) {
        // Без изменений — просто закрываем
        this.closeEdit()
        return
      }
      // Найдём комментарий чтобы взять parent/answer ids (нужны для serialize)
      const comment = this.findCommentById(id)
      if (!comment) {
        appToast.error({ message: 'Комментарий не найден' })
        return
      }
      this.editSubmitting = true
      try {
        await sendComment(
          this.postId,
          comment.parentid || '',
          comment.answerid || '',
          text,
          id, // editId — переключает sendComment в режим commentEdit
        )
        haptic('small')
        // Optimistic: подменяем текст до прихода обновлённой версии (через стор)
        useCommentsStore().setEditedMessage(id, text)
        appToast.success({ message: 'Комментарий отредактирован' })
        this.closeEdit()
      } catch (e) {
        appToast.error({ message: e instanceof Error ? e.message : 'Не удалось отредактировать комментарий' })
      } finally {
        this.editSubmitting = false
      }
    },
    /** Находит комментарий по id среди корневых и ответов */
    findCommentById(id: string): GetComment | null {
      if (this.allComments) {
        const found = this.allComments.find((c) => c.id === id)
        if (found) return found
      }
      for (const list of Object.values(this.repliesByParentId)) {
        if (Array.isArray(list)) {
          const found = (list as GetComment[]).find((c) => c.id === id)
          if (found) return found
        }
      }
      return null
    },

    // --- WebSocket realtime ---
    subscribeToWs(): void {
      const self = this as unknown as { _wsUnsub: null | (() => void) }
      if (self._wsUnsub) return
      self._wsUnsub = wsService.on('transaction', (data) => {
        // data.txid и data.type приходят от прокси; игнорируем шум, нас интересуют
        // транзакции, относящиеся к нашему посту: comment / commentEdit / commentDelete / cScore.
        const type = (data?.type as string | undefined) || ''
        if (!this.postId) return
        if (!type) return

        if (
          type === 'comment' ||
          type === 'commentEdit' ||
          type === 'commentDelete'
        ) {
          // Снимаем локальный optimistic-флаг по txid (если совпадает с pending)
          const txid = (data?.txid as string | undefined) || ''
          if (txid) useCommentsStore().applyConfirmedTx(this.postId, txid, type)
          // Перезапросить список (с дебаунсом, чтобы не штормить при пачках)
          this.scheduleRefresh()
          return
        }

        if (type === 'cScore') {
          // Голос за чужой комментарий — список нужно перезапросить, чтобы
          // обновить scoreUp/scoreDown. Дебаунсим.
          this.scheduleRefresh()
          return
        }
      })
    },
    unsubscribeFromWs(): void {
      const self = this as unknown as { _wsUnsub: null | (() => void) }
      if (self._wsUnsub) {
        try { self._wsUnsub() } catch { /* noop */ }
        self._wsUnsub = null
      }
    },
    /** Дебаунсенный рефреш списка комментариев (от 1 до N WS-событий пачкой) */
    scheduleRefresh(): void {
      const self = this as unknown as { _refreshDebounce: number | null }
      if (self._refreshDebounce !== null) return
      self._refreshDebounce = window.setTimeout(() => {
        self._refreshDebounce = null
        // Перезагружаем только если список уже был открыт хоть раз — иначе
        // нет смысла нагружать сеть для свёрнутого превью.
        if (this.allComments && !this.commentsCollapsed) {
          this.loadAllComments(false)
        }
      }, 600)
    },
    /** Ручной refresh — кнопка в шапке списка */
    refreshComments(): void {
      if (this.allCommentsLoading) return
      this.loadAllComments(false)
    },
  },
})

/**
 * Конвертирует pending-комментарий из стора в синтетический GetComment-объект
 * для рендера в общем списке. Помечается флагом `temp = true` — UI отрисует
 * статус-бейдж "Ожидание".
 */
function pendingToGetComment(p: PendingComment): GetComment {
  const authStore = useAuthStore()
  const profile = (authStore.getUserProfile as { name?: string; i?: string } | null) ?? null
  return {
    type: 0,
    id: p.id,
    postid: p.postId,
    address: p.address,
    time: Math.floor(p.createdAt / 1000),
    timeUpd: Math.floor(p.createdAt / 1000),
    block: 0,
    msg: JSON.stringify({ message: p.message, url: '', images: [], info: '' }),
    scoreUp: 0,
    scoreDown: 0,
    children: 0,
    deleted: false,
    edit: false,
    flags: {},
    parentid: p.parentId || '',
    answerid: p.answerId || '',
    temp: true,
    userprofile: {
      hash: '',
      address: p.address,
      id: 0,
      name: profile?.name || p.address,
      i: profile?.i || '',
    },
  }
}
