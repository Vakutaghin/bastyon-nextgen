<template>
  <SC_CommentWithReplies>
    <SC_CommentItem>
      <router-link :to="lastCommentProfileLink">
        <CommentAvatar :url="lastCommentAvatarUrl" :name="post.lastComment?.authorName" />
      </router-link>

      <SC_CommentContent>
        <SC_CommentMeta>
          <router-link :to="lastCommentProfileLink">
            <SC_CommentAuthor>{{ post.lastComment?.authorName }}</SC_CommentAuthor>
          </router-link>

          <SC_CommentDate :title="lastCommentDateFull">{{ lastCommentDateOnly }}</SC_CommentDate>
        </SC_CommentMeta>

        <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
        <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

        <SC_CommentActions>
          <button
            type="button"
            :class="[
              'comment-score',
              {
                'comment-score--voted': lastCommentUserLiked,
                'comment-score--clickable': lastCommentCanClickLike,
              },
            ]"
            @click.stop.prevent="onLastCommentScoreUp()"
          >
            👍 {{ formatScore(post.lastComment?.scoreUp) }}
          </button>

          <button
            type="button"
            :class="[
              'comment-score',
              {
                'comment-score--voted': lastCommentUserDisliked,
                'comment-score--clickable': lastCommentCanClickDislike,
              },
            ]"
            @click.stop.prevent="onLastCommentScoreDown()"
          >
            👎 {{ formatScore(post.lastComment?.scoreDown) }}
          </button>
          <SC_CommentRepliesLink
            v-if="lastCommentChildren > 0"
            type="button"
            @click.stop.prevent="onLastCommentRepliesClick"
          >
            {{ t('comments.replies', { count: lastCommentChildren }) }}
          </SC_CommentRepliesLink>
          <button type="button" @click.stop.prevent="onLastCommentReply">
            {{ t('comments.reply') }}
          </button>
          <button type="button" @click.stop.prevent="onLastCommentReplyToAuthor">
            {{ t('comments.replyToAuthor') }}
          </button>
        </SC_CommentActions>
      </SC_CommentContent>
    </SC_CommentItem>

    <SC_ReplyPanelNested v-if="lastCommentId && isReplyPanelOpen(lastCommentId)">
      <BoundReplyPanel />
    </SC_ReplyPanelNested>

    <!-- Оптимистично-добавленные pending-ответы к lastComment.
         В компактном виде real-ответы не подгружаются (клик «Ответы» переключает в развёрнутый),
         поэтому getReplies здесь возвращает только pending — это и показываем. -->
    <SC_CommentReplies v-if="lastCommentId && getReplies(lastCommentId).length > 0">
      <SC_ReplyItemWrapper v-for="reply in getReplies(lastCommentId)" :key="reply.id">
        <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
          <CommentAvatar
            :url="getCommentAvatarUrl(reply.userprofile)"
            :name="reply.userprofile?.name || '?'"
          />
          <SC_CommentContent>
            <SC_CommentMeta>
              <SC_CommentAuthor>{{ reply.userprofile?.name || reply.address }}</SC_CommentAuthor>
              <SC_CommentMetaRight>
                <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{
                  formatCommentDate(reply.time)
                }}</SC_CommentDate>
                <SC_TxStatusBadge v-if="isCommentPending(reply)" :title="t('comments.txPending')">
                  <ClockCircleOutlined />
                  <span>{{ t('comments.txPendingShort') }}</span>
                </SC_TxStatusBadge>
                <SC_TxStatusBadge
                  v-else-if="isCommentRejected(reply)"
                  class="tx-status--rejected"
                  :title="t('comments.txRejected')"
                >
                  <StopOutlined />
                  <span>{{ t('comments.txRejectedShort') }}</span>
                </SC_TxStatusBadge>
              </SC_CommentMetaRight>
            </SC_CommentMeta>
            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
            <SC_CommentText v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
          </SC_CommentContent>
        </SC_CommentItem>
      </SC_ReplyItemWrapper>
    </SC_CommentReplies>
  </SC_CommentWithReplies>
</template>

<script setup lang="ts">
// Компактный блок «последнего комментария» поста — показывается, пока полный
// список не загружен или свёрнут. Раньше дублировался дословно в двух ветках
// post-card-comments.vue. Хендлеры onLastComment* обслуживают только этот блок,
// поэтому живут здесь; скоринг/реплаи/edit берутся из контекста дерева.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClockCircleOutlined, StopOutlined } from '@ant-design/icons-vue'

import { resolveImageUrl } from '@/helpers/common/url-transformer'
import type { PostForComments } from './types'
import CommentAvatar from './comment-avatar.vue'
import BoundReplyPanel from './bound-reply-panel.vue'
import {
  getCommentAvatarUrl,
  formatCommentMessageHtml as formatCommentMessageHtmlRaw,
} from './helpers'
import {
  SC_CommentWithReplies,
  SC_CommentItem,
  SC_CommentContent,
  SC_CommentMeta,
  SC_CommentMetaRight,
  SC_CommentAuthor,
  SC_CommentText,
  SC_CommentDate,
  SC_CommentActions,
  SC_CommentRepliesLink,
  SC_CommentReplies,
  SC_ReplyItemWrapper,
  SC_ReplyPanelNested,
  SC_TxStatusBadge,
} from './styled'
import { useCommentTree } from './comment-tree-context'
import type { GetComment } from '@/types/rpc-responses/get-comments'

const props = defineProps<{ post: PostForComments }>()

const { t } = useI18n()

const ctx = useCommentTree()
const { loader, replies, form } = ctx
const { formatScore, formatCommentDate, formatCommentDateFull, formatCommentMessageHtml } =
  ctx.display
const {
  lastCommentUserLiked,
  lastCommentUserDisliked,
  lastCommentCanClickLike,
  lastCommentCanClickDislike,
  onLastCommentScoreUp,
  onLastCommentScoreDown,
} = ctx.scoring
const { isCommentPending, isCommentRejected } = ctx.editDelete
const { getReplies } = replies
const { isReplyPanelOpen } = form

// --- Last comment отображение. ---
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
const lastCommentDateOnly = computed<string>(() =>
  formatCommentDate(props.post.lastComment?.time || 0)
)
const lastCommentDateFull = computed<string>(() =>
  formatCommentDateFull(props.post.lastComment?.time || 0)
)
const lastCommentId = computed<string | null>(() => props.post.lastComment?.id ?? null)
const lastCommentChildren = computed<number>(() => props.post.lastComment?.children ?? 0)

// --- LastComment handlers (обслуживают только этот блок). ---
async function onLastCommentRepliesClick(): Promise<void> {
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

function onLastCommentReply(): void {
  const id = props.post.lastComment?.id
  if (!id) return
  form.openReplyEmpty(id, id)
}
function onLastCommentReplyToAuthor(): void {
  const lc = props.post.lastComment
  if (!lc?.id) return
  form.openReplyToAuthor(lc.id, lc.id, lc.authorName || lc.address || '')
}
</script>
