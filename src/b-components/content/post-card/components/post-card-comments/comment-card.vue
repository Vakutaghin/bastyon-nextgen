<template>
  <component :is="wrapper" :class="{ 'is-pending': isCommentPending(comment) }">
    <router-link :to="getCommentProfileLink(comment)">
      <CommentAvatar
        :url="getCommentAvatarUrl(comment.userprofile)"
        :name="comment.userprofile?.name || '?'"
      />
    </router-link>

    <SC_CommentContent>
      <SC_CommentMeta>
        <router-link :to="getCommentProfileLink(comment)">
          <SC_CommentAuthor>{{ comment.userprofile?.name || comment.address }}</SC_CommentAuthor>
        </router-link>
        <SC_CommentMetaRight>
          <SC_CommentDate :title="formatCommentDateFull(comment.time)">{{
            formatCommentDate(comment.time)
          }}</SC_CommentDate>
          <SC_TxStatusBadge v-if="isCommentPending(comment)" :title="t('comments.txPending')">
            <ClockCircleOutlined />
            <span>{{ t('comments.txPendingShort') }}</span>
          </SC_TxStatusBadge>
          <SC_TxStatusBadge
            v-else-if="isCommentRejected(comment)"
            class="tx-status--rejected"
            :title="t('comments.txRejected')"
          >
            <StopOutlined />
            <span>{{ t('comments.txRejectedShort') }}</span>
          </SC_TxStatusBadge>
          <SC_EditedMark
            v-else-if="!isCommentDeleted(comment) && isCommentEdited(comment)"
            :title="t('comments.edited')"
          >
            <EditOutlined />
          </SC_EditedMark>
          <CommentMenu
            v-if="canShowMenu(comment)"
            :can-edit="canEditComment(comment)"
            :can-delete="canDeleteComment(comment)"
            @action="(a) => onCommentMenuAction(comment, a)"
          />
        </SC_CommentMetaRight>
      </SC_CommentMeta>

      <SC_CommentDeleted v-if="isCommentDeleted(comment)">
        {{ t('comments.deleted') }}
      </SC_CommentDeleted>
      <CommentEditForm
        v-else-if="isEditingComment(comment)"
        :edit-draft="editDraft"
        :initial-draft="editInitialDraft"
        :edit-submitting="editSubmitting"
        @update:edit-draft="(v) => (editDraft = v)"
        @request-close="requestCloseEdit"
        @save="submitEdit"
      />
      <SC_HiddenBanner v-else-if="shouldHideContent(comment)">
        <span>{{ t('comments.hiddenLowReputation') }}</span>
        <SC_RevealBtn type="button" @click.stop.prevent="revealHiddenComment(comment)">
          {{ t('comments.showAnyway') }}
        </SC_RevealBtn>
      </SC_HiddenBanner>
      <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
      <SC_CommentText v-else v-html="formatCommentMessageHtml(comment)"></SC_CommentText>

      <SC_CommentImages
        v-if="
          !isCommentDeleted(comment) &&
          !isEditingComment(comment) &&
          !shouldHideContent(comment) &&
          getCommentImagesList(comment).length > 0
        "
      >
        <PostCardImages :images="getCommentImagesList(comment)" />
      </SC_CommentImages>

      <SC_CommentActions
        v-if="
          canInteractWithComment(comment) &&
          !isEditingComment(comment) &&
          !shouldHideContent(comment)
        "
      >
        <button
          type="button"
          :class="[
            'comment-score',
            {
              'comment-score--voted': isCommentLiked(comment),
              'comment-score--clickable': commentCanClickLike(comment),
            },
          ]"
          @click.stop.prevent="onCommentScoreUp(comment)"
        >
          👍 {{ formatScore(comment.scoreUp) }}
        </button>

        <button
          type="button"
          :class="[
            'comment-score',
            {
              'comment-score--voted': isCommentDisliked(comment),
              'comment-score--clickable': commentCanClickDislike(comment),
            },
          ]"
          @click.stop.prevent="onCommentScoreDown(comment)"
        >
          👎 {{ formatScore(comment.scoreDown) }}
        </button>
        <SC_CommentRepliesLink
          v-if="level === 1 && (comment.children ?? 0) > 0"
          type="button"
          @click.stop.prevent="onRepliesClick(comment)"
        >
          {{ t('comments.replies', { count: comment.children }) }}
        </SC_CommentRepliesLink>
        <button type="button" @click.stop.prevent="onReply">
          {{ t('comments.reply') }}
        </button>
        <button type="button" @click.stop.prevent="onReplyToAuthor">
          {{ t('comments.replyToAuthor') }}
        </button>
      </SC_CommentActions>
    </SC_CommentContent>
  </component>
</template>

<script setup lang="ts">
// Узел комментария: аватар + мета + тело + изображения + действия.
// Используется для корневых комментариев (level 1, обёртка SC_CommentRow) и
// ответов второго уровня (level 2, обёртка SC_CommentItem). Отличие — обёртка,
// ссылка «Ответы» (только level 1) и адресат reply-хендлеров. Всё остальное и
// все хелперы берутся из контекста дерева комментариев (provide/inject).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClockCircleOutlined, StopOutlined, EditOutlined } from '@ant-design/icons-vue'

import type { GetComment } from '@/types/rpc-responses/get-comments'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import CommentAvatar from './comment-avatar.vue'
import CommentMenu from './comment-menu.vue'
import CommentEditForm from './comment-edit-form.vue'
import { getCommentAvatarUrl, getCommentProfileLink } from './helpers'
import {
  SC_CommentItem,
  SC_CommentRow,
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
  SC_EditedMark,
  SC_TxStatusBadge,
  SC_CommentActions,
  SC_CommentRepliesLink,
} from './styled'
import { useCommentTree } from './comment-tree-context'

const props = defineProps<{
  comment: GetComment
  /** 1 — корневой комментарий, 2 — ответ. Влияет на обёртку и reply-хендлеры. */
  level: 1 | 2
}>()

const { t } = useI18n()

const ctx = useCommentTree()
const { onCommentMenuAction } = ctx
const { formatScore, formatCommentDate, formatCommentDateFull, formatCommentMessageHtml, isCommentEdited, getCommentImagesList } =
  ctx.display
const {
  isCommentLiked,
  isCommentDisliked,
  commentCanClickLike,
  commentCanClickDislike,
  onCommentScoreUp,
  onCommentScoreDown,
} = ctx.scoring
const {
  isCommentPending,
  isCommentRejected,
  isCommentDeleted,
  isEditingComment,
  canShowMenu,
  canEditComment,
  canDeleteComment,
  canInteractWithComment,
  editDraft,
  editInitialDraft,
  editSubmitting,
  requestCloseEdit,
  submitEdit,
} = ctx.editDelete
const { shouldHideContent, revealHiddenComment } = ctx.visibility
const { onRepliesClick } = ctx.replies

const wrapper = computed(() => (props.level === 1 ? SC_CommentRow : SC_CommentItem))

function onReply(): void {
  if (props.level === 1) ctx.form.onReplyToFirstLevel(props.comment)
  else ctx.form.onReplyToSecondLevel(props.comment)
}
function onReplyToAuthor(): void {
  if (props.level === 1) ctx.form.onReplyToAuthorFirstLevel(props.comment)
  else ctx.form.onReplyToComment(props.comment)
}
</script>
