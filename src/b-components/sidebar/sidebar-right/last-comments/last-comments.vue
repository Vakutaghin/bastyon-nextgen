<template>
  <SC_LastCommentsRoot>
    <SC_LastCommentsCaption>{{ t('sidebar.lastComments') }}</SC_LastCommentsCaption>
    <SC_LastCommentsLoading v-if="isLoading">
      <Spin size="small">
        <template #indicator>
          <LoadingOutlined :style="ICON_PRIMARY_24" spin />
        </template>
      </Spin>
    </SC_LastCommentsLoading>
    <SC_LastCommentsEmpty v-else-if="!displayComments.length">
      {{ t('sidebar.noComments') }}
    </SC_LastCommentsEmpty>
    <SC_LastCommentsList v-else>
      <SC_LastCommentItem v-for="item in displayComments" :key="item.id" @click="openPost(item)">
        <SC_LastCommentIcons>
          <SC_LastCommentAvatar>
            <img
              v-if="item.authorAvatar"
              :src="item.authorAvatar"
              :alt="item.authorName"
              loading="lazy"
              decoding="async"
            />
            <SC_LastCommentLetter v-else>
              {{ item.authorName.charAt(0).toUpperCase() }}
            </SC_LastCommentLetter>
          </SC_LastCommentAvatar>
          <SC_LastCommentArrow class="fas fa-long-arrow-alt-right" />
          <SC_LastCommentAvatar>
            <img
              v-if="item.toAvatar"
              :src="item.toAvatar"
              :alt="item.toName"
              loading="lazy"
              decoding="async"
            />
            <SC_LastCommentLetter v-else>
              {{ item.toName ? item.toName.charAt(0).toUpperCase() : '?' }}
            </SC_LastCommentLetter>
          </SC_LastCommentAvatar>
        </SC_LastCommentIcons>
        <SC_LastCommentContent>
          <SC_LastCommentNames>{{ item.authorName }}</SC_LastCommentNames>
          <span> → </span>
          <SC_LastCommentNames>{{ item.toName || '—' }}</SC_LastCommentNames>
          : <SC_LastCommentMessage>{{ item.message }}</SC_LastCommentMessage>
        </SC_LastCommentContent>
      </SC_LastCommentItem>
    </SC_LastCommentsList>
  </SC_LastCommentsRoot>
</template>

<script setup lang="ts">
// «Последние комментарии» справа: свежие комментарии сети, раз в минуту
// обновляются (use-comments-queries), имена — из общего кэша подписей
// (user-names), чтобы обновление списка не сбрасывало ники на адреса.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined } from '@/components/icons'
import Spin from '@/components/spin/spin.vue'
import { lastCommentRecipient, useLastComments } from '@/composables/use-comments-queries'
import { userAvatar, userName } from '@/services/user-names'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import type { GetLastComment, CommentMessage } from '@/types/rpc-responses/get-last-comments'
import { ICON_PRIMARY_24 } from '@/styles/icon-styles'
import {
  SC_LastCommentsRoot,
  SC_LastCommentsCaption,
  SC_LastCommentsList,
  SC_LastCommentItem,
  SC_LastCommentIcons,
  SC_LastCommentAvatar,
  SC_LastCommentLetter,
  SC_LastCommentArrow,
  SC_LastCommentContent,
  SC_LastCommentNames,
  SC_LastCommentMessage,
  SC_LastCommentsLoading,
  SC_LastCommentsEmpty,
} from './styled'

const MESSAGE_TRIM_LENGTH = 120

function parseMessage(msg: string): string {
  if (!msg) return ''
  try {
    const parsed = JSON.parse(msg) as CommentMessage
    return parsed?.message ?? ''
  } catch {
    return msg
  }
}

function trimText(text: string, maxLen: number): string {
  const plain = text.replace(/\s+/g, ' ').trim()
  return plain.length <= maxLen ? plain : plain.slice(0, maxLen) + '…'
}

const { t } = useI18n()
const router = useRouter()
const modalStore = useModalStore()
const postsStore = usePostsStore()

const { data: lastCommentsResponse, isLoading } = useLastComments(true)

const comments = computed<GetLastComment[]>(() => {
  const d = lastCommentsResponse.value?.data
  return Array.isArray(d) ? d : []
})

interface DisplayComment {
  id: string
  postid: string
  parentid: string
  authorName: string
  authorAvatar: string | null
  /** Пусто, если комментарий к своему посту. */
  toName: string
  toAvatar: string | null
  message: string
}

const displayComments = computed<DisplayComment[]>(() => {
  const authors = new Set<string>()
  const list: DisplayComment[] = []
  for (const c of comments.value) {
    const message = parseMessage(c.msg)
    // Один комментарий на автора, как в старом клиенте: иначе серия «👍»
    // одного человека занимала весь блок.
    if (!message || authors.has(c.address)) continue
    authors.add(c.address)
    const to = lastCommentRecipient(c)
    list.push({
      id: c.id,
      postid: c.postid,
      parentid: c.parentid ?? '',
      authorName: userName(c.address),
      authorAvatar: userAvatar(c.address),
      toName: to ? userName(to) : '',
      toAvatar: to ? userAvatar(to) : null,
      message: trimText(message, MESSAGE_TRIM_LENGTH),
    })
  }
  return list
})

function openPost(item: DisplayComment): void {
  const post = postsStore.getPostByShareId(item.postid)
  if (post) {
    modalStore.openPostModal(post as Parameters<typeof modalStore.openPostModal>[0])
    return
  }
  // Поста нет среди загруженных (почти всегда у свежих комментариев) —
  // страница поста с переходом к этому комментарию, как в старом клиенте.
  void router.push({
    name: 'post',
    params: { txid: item.postid },
    query: item.parentid ? { commentid: item.id, parentid: item.parentid } : { commentid: item.id },
  })
}
</script>
