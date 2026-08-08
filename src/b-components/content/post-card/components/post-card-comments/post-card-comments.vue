<template>
  <SC_CommentsPreview ref="commentsRootRef">
    <h3>{{ t('comments.title', { count: totalCommentsCount }) }}</h3>

    <!-- Компактный вид: комментарии ещё не загружены -->
    <template v-if="!allComments">
      <LastCommentPreview v-if="hasUserComments" :post="post" />

      <SC_CommentsActionsRow v-if="totalCommentsCount > 0">
        <SC_CommentsActionsLeft>
          <SC_CommentsLoading v-if="allCommentsLoading">
            <LoadingOutlined :style="ICON_BRAND_CYAN_18" spin />
          </SC_CommentsLoading>

          <template v-else>
            <SC_ShowCommentsBtn type="button" @click.stop.prevent="loadAllComments(false)">
              {{ t('comments.showMoreFixed', { count: 15 }) }}
            </SC_ShowCommentsBtn>

            <SC_ShowCommentsBtnSecondary type="button" @click.stop.prevent="loadAllComments(true)">
              {{ t('comments.showAll') }}
            </SC_ShowCommentsBtnSecondary>
          </template>
        </SC_CommentsActionsLeft>
      </SC_CommentsActionsRow>
    </template>

    <!-- Компактный вид: комментарии загружены, но свернуты -->
    <template v-else-if="commentsCollapsed">
      <LastCommentPreview v-if="hasUserComments" :post="post" />

      <SC_ShowCommentsBtn type="button" @click.stop.prevent="expandComments">
        {{ t('comments.expand', { count: actualCommentsCount }) }}
      </SC_ShowCommentsBtn>
    </template>

    <!-- Развёрнутый вид: сортировка + список с пагинацией -->
    <template v-else>
      <SC_CommentsSortRow>
        <label for="comments-sort">{{ t('comments.sortLabel') }}</label>
        <SC_CommentsSortSelect
          id="comments-sort"
          :value="commentsSortOrder"
          @change="setCommentsSortOrder($event)"
        >
          <option value="interesting">{{ t('comments.sortInteresting') }}</option>
          <option value="newest">{{ t('comments.sortNewest') }}</option>
          <option value="oldest">{{ t('comments.sortOldest') }}</option>
        </SC_CommentsSortSelect>
        <SC_RefreshBtn
          type="button"
          :disabled="allCommentsLoading"
          :title="t('comments.refresh')"
          @click.stop.prevent="refreshComments"
        >
          <LoadingOutlined v-if="allCommentsLoading" :style="ICON_SIZE_SM" spin />
          <SyncOutlined v-else />
        </SC_RefreshBtn>
      </SC_CommentsSortRow>

      <SC_CommentWithReplies v-for="comment in visibleComments" :key="comment.id">
        <CommentCard :comment="comment" :level="1" />

        <!-- Плашка ответа под комментарием первого уровня -->
        <SC_ReplyPanelNested v-if="isReplyPanelOpen(comment.id)">
          <BoundReplyPanel />
        </SC_ReplyPanelNested>

        <!-- Ветка ответов второго уровня -->
        <template v-if="isRepliesExpanded(comment.id)">
          <SC_CommentReplies v-if="getReplies(comment.id).length > 0">
            <SC_ReplyItemWrapper v-for="reply in getReplies(comment.id)" :key="reply.id">
              <CommentCard :comment="reply" :level="2" />
              <!-- Плашка ответа под комментарием второго уровня -->
              <SC_ReplyPanelNestedLevel2 v-if="isReplyPanelOpen(reply.id)">
                <BoundReplyPanel />
              </SC_ReplyPanelNestedLevel2>
            </SC_ReplyItemWrapper>
          </SC_CommentReplies>
          <SC_CommentRepliesToggle
            v-if="!isRepliesLoading(comment.id)"
            type="button"
            @click.stop.prevent="toggleRepliesExpanded(comment.id)"
          >
            {{
              getReplies(comment.id).length > 0
                ? t('comments.collapseReplies')
                : t('comments.collapse')
            }}
          </SC_CommentRepliesToggle>
          <SC_CommentsLoading v-if="isRepliesLoading(comment.id)">
            <LoadingOutlined :style="ICON_BRAND_CYAN_16" spin />
          </SC_CommentsLoading>
        </template>
      </SC_CommentWithReplies>

      <SC_CommentsActionsRow>
        <SC_CommentsActionsLeft>
          <SC_ShowCommentsBtn
            v-if="hasMoreCommentsToShow"
            type="button"
            @click.stop.prevent="showMoreComments"
          >
            {{ t('comments.showMore', { count: nextCommentsPageSize }) }}
          </SC_ShowCommentsBtn>

          <SC_ShowCommentsBtnSecondary
            v-if="hasMoreCommentsToShow"
            type="button"
            @click.stop.prevent="showAllComments"
          >
            {{ t('comments.showAll') }}
          </SC_ShowCommentsBtnSecondary>
        </SC_CommentsActionsLeft>

        <SC_ShowCommentsBtnCollapse type="button" @click.stop.prevent="collapseComments">
          {{ t('comments.collapse') }}
        </SC_ShowCommentsBtnCollapse>
      </SC_CommentsActionsRow>
    </template>

    <!-- Запрет публикации (лимит/репутация/удалённый аккаунт/не авторизован) -->
    <SC_ComposerDisabled v-if="composerDisableReason">
      {{ composerDisableReason.message }}
    </SC_ComposerDisabled>

    <!-- Бар «написать комментарий к посту» -->
    <SC_ReplyPanel v-else-if="isRootReplyActive">
      <div v-if="currentUserAvatarUrl" class="reply-avatar">
        <img
          :src="currentUserAvatarUrl"
          :alt="t('comments.yourAvatar')"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
      <SC_ReplyInputWrap>
        <SC_ReplyTextarea
          :key="'root-' + replyPanelKey"
          ref="rootReplyTextareaRef"
          :value="isRootReplyActive ? replyDraft : ''"
          :placeholder="t('comments.composerPlaceholder')"
          rows="2"
          @input="
            (e) => {
              if (isRootReplyActive) handleRootReplyInput(e)
            }
          "
          @focus="onComposerFocus"
          @keydown="handleReplyKeydown"
        />
        <SC_MentionList
          ref="rootMentionListRef"
          v-if="showMentionList && filteredMentionUsers.length > 0 && isRootReplyActive"
        >
          <SC_MentionItem
            v-for="(u, idx) in filteredMentionUsers"
            :key="u.address"
            type="button"
            :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
            @click.stop.prevent="selectMentionUser(u)"
          >
            {{ u.name }}
          </SC_MentionItem>
        </SC_MentionList>
        <SC_LengthCounter
          v-if="isRootReplyActive && rootLengthHint"
          :class="{ 'length-counter--bad': rootLengthHint.isOver }"
        >
          {{ rootLengthHint.text }}
        </SC_LengthCounter>
      </SC_ReplyInputWrap>
      <APopover v-model:open="emojiOpenRoot" trigger="click" placement="topRight">
        <template #content>
          <CommentEmojiPicker @select="onRootEmojiSelect" />
        </template>
        <SC_EmojiTriggerBtn type="button" :title="t('comments.emoji')" @click.stop>
          <SmileOutlined />
        </SC_EmojiTriggerBtn>
      </APopover>
      <SC_ReplySendBtn
        type="button"
        :title="t('comments.send')"
        :disabled="
          !isRootReplyActive || !(replyDraft || '').trim() || replySubmitting || !rootLengthValid
        "
        @click.stop.prevent="sendReply"
      >
        <LoadingOutlined v-if="replySubmitting" :style="ICON_SIZE_SM" spin />
        <SendOutlined v-else />
      </SC_ReplySendBtn>
    </SC_ReplyPanel>
  </SC_CommentsPreview>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover } from 'ant-design-vue'
import { ICON_SIZE_SM, ICON_BRAND_CYAN_16, ICON_BRAND_CYAN_18 } from '@/styles/icon-styles'
import { LoadingOutlined, SendOutlined, SyncOutlined, SmileOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import { useCommentsStore, useUserRelationsStore, useDonateStore, useReportStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatRelativeTime } from '@/helpers/common/date-formatter'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { PostForComments } from './types'
import type { CommentMenuAction } from './comment-menu.vue'
import LastCommentPreview from './last-comment-preview.vue'
import CommentCard from './comment-card.vue'
import BoundReplyPanel from './bound-reply-panel.vue'
import CommentEmojiPicker from './comment-emoji-picker.vue'
import {
  formatCommentMessageHtml as formatCommentMessageHtmlRaw,
  formatCommentDateAndTime,
  getCommentImages,
  compressedNumber,
} from './helpers'
import { getCommentPostingDisableReason, type DisableReason } from './visibility'
import {
  SC_CommentsPreview,
  SC_CommentWithReplies,
  SC_CommentReplies,
  SC_CommentRepliesToggle,
  SC_ReplyItemWrapper,
  SC_ReplyPanelNested,
  SC_ReplyPanelNestedLevel2,
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_MentionList,
  SC_MentionItem,
  SC_ReplyPanel,
  SC_ReplySendBtn,
  SC_EmojiTriggerBtn,
  SC_LengthCounter,
  SC_ComposerDisabled,
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
import { provideCommentTree } from './comment-tree-context'

export type { PostForComments }

const props = defineProps<{
  post: PostForComments
  /** Deep-link: txid комментария, к которому проскроллить и подсветить (#40/#41). */
  targetCommentId?: string
  /** Deep-link: txid корневого коммента ветки, если цель — ответ (раскрыть ветку). */
  targetParentId?: string
}>()

const emit = defineEmits<{
  collapsed: []
  replyToComment: []
  comment: []
}>()

const { t } = useI18n()

const APopover = Popover

// --- Базовая идентификация поста / пользователя. ---
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

const currentUserStateData = computed<import('@/types/rpc-responses/user-state').UserState | null>(
  () => {
    const profile = useAuthStore().getUserProfile as
      | (import('@/types/rpc-responses/user-state').UserState & { reputation?: number })
      | null
    return profile ?? null
  }
)

const composerDisableReason = computed<DisableReason | null>(() => {
  // #34: автор поста заблокировал текущего пользователя → запрет комментировать.
  if (
    isUserAuthenticated.value &&
    postAuthorAddress.value &&
    useUserRelationsStore().isBannedBy(postAuthorAddress.value)
  ) {
    return { kind: 'banned', message: t('commentsMsg.disableBannedByAuthor') }
  }
  return getCommentPostingDisableReason(isUserAuthenticated.value, currentUserStateData.value)
})

// --- Тик для реактивного обновления относительного времени (раз в минуту). ---
const nowTick = ref(0)
const relativeTimer = window.setInterval(() => {
  nowTick.value++
}, 60_000)

// --- Композаблы. ---
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

// Гидрируем блок-лист текущего пользователя из ноды (один раз за сессию).
if (isUserAuthenticated.value) void useUserRelationsStore().init()

// --- Deep-link к комментарию (#40/#41): скролл + подсветка. ---
const commentsRootRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const highlightedCommentId = ref<string | null>(null)

// --- Вычисляемые списки. ---
const pendingRootComments = computed<GetComment[]>(() => {
  const list = useCommentsStore().getPendingForPost(postId.value)
  if (!list.length) return []
  return list.filter((p) => !p.parentId).map((p) => pendingToGetComment(p))
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
// Прокидываем актуальный массив в forward-ref для loader.getSortedLength.
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
  // COMMENTS_PAGE_SIZE используется в loader; дублирование захардкодом здесь
  // дешевле, чем поднимать из consts ради одного computed.
  return Math.min(20, remainingCommentsCount.value)
})

const hasMoreCommentsToShow = computed<boolean>(() => remainingCommentsCount.value > 0)

const totalCommentsCount = computed<number>(() => props.post.comments ?? 0)
const actualCommentsCount = computed<number>(() => loader.allComments.value?.length ?? 0)
const hasUserComments = computed<boolean>(() => {
  const lc = props.post.lastComment
  return !!lc && !!lc.message && (props.post.comments || 0) > 0
})

// --- Текущий пользователь — аватар/инициал. ---
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

// --- @mention candidates. ---
const mentionUsers = computed(() =>
  buildMentionUsers(props.post, loader.allComments.value, replies.repliesByParentId.value)
)

// --- Template refs для form composable. ---
const rootMentionListRef = ref<unknown>(null)
const mentionListRef = ref<unknown>(null)
const rootReplyTextareaRef = ref<unknown>(null)
const replyTextareaRef = ref<unknown>(null)

// form composable нужен filteredMentionUsers (вынесен сюда, потому что
// зависит от mentionQuery, которое живёт внутри form composable —
// форвардим через ref-прокси).
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

// Синхронизация mentionQuery формы с прокси (для computed filtered).
Object.defineProperty(mentionQueryProxy, 'value', {
  get: () => form.mentionQuery.value,
  set: (v: string) => {
    form.mentionQuery.value = v
  },
})

// --- WS (требует уже инициализированный loader). ---
const ws = useCommentsWs({
  postId,
  isLoading: loader.allCommentsLoading,
  hasLoaded: computed(
    () => loader.allComments.value !== null
  ) as unknown as import('vue').Ref<boolean>,
  isCollapsed: loader.commentsCollapsed,
  reload: () => loader.loadAllComments(false),
})

function collapseComments(): void {
  loader.collapseComments()
  emit('collapsed')
}

// --- Display helpers (передаются детям через контекст дерева комментариев). ---
function formatCommentDate(time: number): string {
  void nowTick.value
  return formatRelativeTime(time)
}
function formatCommentDateFull(time: number): string {
  return formatCommentDateAndTime(time)
}
function getCommentImagesList(comment: GetComment): string[] {
  return getCommentImages(comment)
}

function formatScore(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return '0'
  return compressedNumber(n) || String(n)
}

function formatCommentMessageHtml(comment: GetComment): string {
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
function isCommentEdited(comment: GetComment): boolean {
  if (typeof useCommentsStore().editedMessages[comment.id] === 'string') return true
  return !!comment.edit || comment.timeUpd > comment.time
}

// --- Menu action handler. ---
function onCommentMenuAction(comment: GetComment, action: CommentMenuAction): void {
  if (action === 'delete') {
    editDelete.confirmDeleteComment(comment)
    return
  }
  if (action === 'edit') {
    editDelete.openEditComment(comment)
    return
  }
  if (action === 'block') {
    editDelete.confirmBlockUser(comment)
    return
  }
  if (action === 'unblock') {
    void editDelete.unblockUser(comment)
    return
  }
  if (action === 'share') {
    void shareComment(comment)
    return
  }
  if (action === 'donate') {
    useDonateStore().open({
      address: comment.address,
      name: (comment as GetComment & { userprofile?: { name?: string } }).userprofile?.name,
    })
    return
  }
  if (action === 'report') {
    useReportStore().open({
      contentHash: comment.id,
      authorAddress: comment.address,
      type: 'comment',
    })
    return
  }
}

// #16: ссылка-permalink на комментарий (deep-link на /post/:txid?commentid=&parentid=).
// Web Share API на мобильных, иначе — копирование в буфер.
async function shareComment(comment: GetComment): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({ commentid: comment.id })
  if (comment.parentid && comment.parentid !== comment.id) {
    params.set('parentid', comment.parentid)
  }
  const url = `${origin}/post/${postId.value}?${params.toString()}`
  const nav = window.navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ url })
      return
    } catch (e) {
      // AbortError — пользователь закрыл диалог, не ошибка; иначе падаем в clipboard.
      if ((e instanceof Error ? e.name : '') === 'AbortError') return
    }
  }
  try {
    await window.navigator.clipboard.writeText(url)
    appToast.success({ message: t('commentsMsg.linkCopied'), description: url })
  } catch {
    appToast.error({ message: t('commentsMsg.shareFailed') })
  }
}

// --- Provide контекста дерева комментариев для дочерних узлов. ---
provideCommentTree({
  loader,
  replies,
  scoring,
  form,
  editDelete,
  visibility,
  display: {
    formatScore,
    formatCommentDate,
    formatCommentDateFull,
    formatCommentMessageHtml,
    isCommentEdited,
    getCommentImagesList,
  },
  currentUserAvatarUrl,
  currentUserInitial,
  filteredMentionUsers,
  highlightedCommentId,
  onCommentMenuAction,
})

// --- Cleanup. ---
onBeforeUnmount(() => {
  clearInterval(relativeTimer)
})

// --- Deep-link (#40/#41): развернуть комментарии, проскроллить и подсветить. ---
onMounted(() => {
  if (props.targetCommentId) void deepLinkToComment(props.targetCommentId, props.targetParentId)
})

async function deepLinkToComment(targetId: string, parentId?: string): Promise<void> {
  try {
    await loader.loadAllComments(true) // загрузить и показать все корневые
  } catch {
    /* игнорируем — поищем среди уже загруженных */
  }
  if (parentId && parentId !== targetId) {
    try {
      await replies.loadReplies(parentId) // загрузить + раскрыть ветку ответа
    } catch {
      /* noop */
    }
  }
  void nextTick(() => tryScrollHighlight(targetId, 0))
}

function tryScrollHighlight(id: string, attempt: number): void {
  const raw = commentsRootRef.value
  const root =
    raw && '$el' in (raw as object)
      ? (raw as { $el?: HTMLElement }).$el
      : (raw as HTMLElement | null)
  // id — txid (hex) или pending `local-...`; кавычек не содержит → селектор безопасен.
  const el = root?.querySelector?.(`[data-comment-id="${id}"]`) as HTMLElement | null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedCommentId.value = id
    window.setTimeout(() => {
      if (highlightedCommentId.value === id) highlightedCommentId.value = null
    }, 4000)
    return
  }
  // DOM ещё не готов (async-загрузка) — повторяем до ~3.2 c.
  if (attempt < 16) window.setTimeout(() => tryScrollHighlight(id, attempt + 1), 200)
}

// Деструктурируем композаблы в плоские const'ы — Vue в template распакует ref'ы автоматически.
const {
  allComments,
  allCommentsLoading,
  commentsCollapsed,
  commentsSortOrder,
  loadAllComments,
  expandComments,
  setCommentsSortOrder,
  showMoreComments,
  showAllComments,
} = loader

const { getReplies, isRepliesExpanded, isRepliesLoading, toggleRepliesExpanded } = replies

const {
  replyDraft,
  showMentionList,
  mentionHighlightIndex,
  replySubmitting,
  replyPanelKey,
  isRootReplyActive,
  rootLengthHint,
  rootLengthValid,
  isReplyPanelOpen,
  onRootBarFocus,
  handleRootReplyInput,
  handleReplyKeydown,
  selectMentionUser,
  insertRootEmoji,
  sendReply,
} = form

const emojiOpenRoot = ref(false)
function onRootEmojiSelect(emoji: string): void {
  emojiOpenRoot.value = false
  insertRootEmoji(emoji)
}

// Фокус composer = момент реальной вовлечённости: тут проверяем, не заблокировал
// ли нас автор поста (#34). Кешируется в сторе, поэтому повторный фокус бесплатен.
function onComposerFocus(): void {
  if (isUserAuthenticated.value && postAuthorAddress.value) {
    void useUserRelationsStore().checkBannedBy(postAuthorAddress.value)
  }
  onRootBarFocus()
}

const refreshComments = ws.refresh
</script>
