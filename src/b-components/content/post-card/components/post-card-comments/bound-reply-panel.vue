<template>
  <CommentReplyPanel
    :current-user-avatar-url="currentUserAvatarUrl"
    :current-user-initial="currentUserInitial"
    v-model:show-cancel-modal="showCancelReplyModal"
    v-model:reply-draft="replyDraft"
    :reply-panel-key="replyPanelKey"
    :reply-submitting="replySubmitting"
    :show-mention-list="showMentionList"
    :filtered-mention-users="filteredMentionUsers"
    :mention-highlight-index="mentionHighlightIndex"
    @confirm-cancel="confirmCancelReply"
    @input="handleReplyInput"
    @keydown="handleReplyKeydown"
    @select-mention="selectMentionUser"
    @request-close="requestCloseReply"
    @send="sendReply"
  />
</template>

<script setup lang="ts">
// Плашка ответа со всеми биндингами из контекста дерева комментариев.
// Раньше этот 17-строчный биндинг повторялся 4× в post-card-comments.vue
// (lastComment ×2, ответ 1-го уровня, ответ 2-го уровня) — все идентичные.
import CommentReplyPanel from './comment-reply-panel.vue'
import { useCommentTree } from './comment-tree-context'

const ctx = useCommentTree()
const { currentUserAvatarUrl, currentUserInitial, filteredMentionUsers } = ctx
const {
  showCancelReplyModal,
  replyDraft,
  replyPanelKey,
  replySubmitting,
  showMentionList,
  mentionHighlightIndex,
  confirmCancelReply,
  handleReplyInput,
  handleReplyKeydown,
  selectMentionUser,
  requestCloseReply,
  sendReply,
} = ctx.form
</script>
