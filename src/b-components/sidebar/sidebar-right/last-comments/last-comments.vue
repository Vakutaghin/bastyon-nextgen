<template>
  <SC_LastCommentsRoot>
    <SC_LastCommentsCaption>Последние комментарии</SC_LastCommentsCaption>
    <SC_LastCommentsLoading v-if="isLoading">
      <Spin size="small">
        <template #indicator>
          <LoadingOutlined :style="{ fontSize: '24px', color: 'var(--color-primary)' }" spin />
        </template>
      </Spin>
    </SC_LastCommentsLoading>
    <SC_LastCommentsEmpty v-else-if="!displayComments.length">
      Нет комментариев
    </SC_LastCommentsEmpty>
    <SC_LastCommentsList v-else>
      <SC_LastCommentItem
        v-for="item in displayComments"
        :key="item.id"
        @click="openPost(item.postid)"
      >
        <SC_LastCommentIcons>
          <SC_LastCommentAvatar>
            <img
              v-if="getAvatarUrl(item.authorProfile)"
              :src="getAvatarUrl(item.authorProfile)!"
              :alt="getDisplayName(item.authorProfile, item.address)"
            />
            <SC_LastCommentLetter v-else>
              {{ getDisplayName(item.authorProfile, item.address).charAt(0).toUpperCase() }}
            </SC_LastCommentLetter>
          </SC_LastCommentAvatar>
          <SC_LastCommentArrow class="fas fa-long-arrow-alt-right" />
          <SC_LastCommentAvatar>
            <img
              v-if="item.commentTo && getAvatarUrl(item.toProfile)"
              :src="getAvatarUrl(item.toProfile)!"
              :alt="item.commentTo ? getDisplayName(item.toProfile, item.commentTo) : ''"
            />
            <SC_LastCommentLetter v-else>
              {{
                item.commentTo
                  ? getDisplayName(item.toProfile, item.commentTo).charAt(0).toUpperCase()
                  : '?'
              }}
            </SC_LastCommentLetter>
          </SC_LastCommentAvatar>
        </SC_LastCommentIcons>
        <SC_LastCommentContent>
          <SC_LastCommentNames>
            {{ getDisplayName(item.authorProfile, item.address) }}
          </SC_LastCommentNames>
          <span> → </span>
          <SC_LastCommentNames>
            {{ item.commentTo ? getDisplayName(item.toProfile, item.commentTo) : '—' }}
          </SC_LastCommentNames>
          : <SC_LastCommentMessage>{{ item.message }}</SC_LastCommentMessage>
        </SC_LastCommentContent>
      </SC_LastCommentItem>
    </SC_LastCommentsList>
  </SC_LastCommentsRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import Spin from '@/components/spin/spin.vue'
import { useLastComments } from '@/composables/use-comments-queries'
import { useUserProfiles } from '@/composables/use-user-profile'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import type { GetLastComment, CommentMessage } from '@/types/rpc-responses/get-last-comments'
import type { UserProfile } from '@/types/rpc-responses/user-get'
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
const AVATAR_BASE = 'https://pocketnet.app:8092/i/'

function parseMessage(msg: string): string {
  if (!msg) return ''
  try {
    const parsed = JSON.parse(msg) as CommentMessage
    return parsed?.message ?? ''
  } catch {
    return msg
  }
}

function getCommentTo(c: GetLastComment): string {
  if (c.addressCommentAnswer && c.addressCommentAnswer !== c.address) {
    return c.addressCommentAnswer
  }
  if (c.addressCommentParent && c.addressCommentParent !== c.address) {
    return c.addressCommentParent
  }
  if (c.addressContent && c.addressContent !== c.address) {
    return c.addressContent
  }
  return ''
}

function trimText(text: string, maxLen: number): string {
  const plain = text.replace(/\s+/g, ' ').trim()
  return plain.length <= maxLen ? plain : plain.slice(0, maxLen) + '…'
}

function getAvatarUrl(profile: UserProfile | undefined): string | null {
  if (!profile) return null
  const i = profile.i
  if (!i) return null
  if (i.startsWith('http://') || i.startsWith('https://')) {
    return i.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
  }
  return `${AVATAR_BASE}${i}`
}

function getDisplayName(profile: UserProfile | undefined, address: string): string {
  return profile?.name?.trim() || address.slice(0, 8) + '…'
}

const modalStore = useModalStore()
const postsStore = usePostsStore()

const { data: lastCommentsResponse, isLoading } = useLastComments(true)

const comments = computed<GetLastComment[]>(() => {
  const d = lastCommentsResponse.value?.data
  return Array.isArray(d) ? d : []
})

const uniqueAddresses = computed<string[]>(() => {
  const set = new Set<string>()
  for (const c of comments.value) {
    set.add(c.address)
    const to = getCommentTo(c)
    if (to) set.add(to)
  }
  return Array.from(set)
})

const { data: profilesResponse } = useUserProfiles(uniqueAddresses, true)

const profilesByAddress = computed<Record<string, UserProfile>>(() => {
  const arr = profilesResponse.value
  if (!Array.isArray(arr)) return {}
  const map: Record<string, UserProfile> = {}
  for (const p of arr) {
    if (p?.address) map[p.address] = p
  }
  return map
})

interface DisplayComment {
  id: string
  postid: string
  parentid: string
  answerid: string
  address: string
  commentTo: string
  message: string
  authorProfile: UserProfile | undefined
  toProfile: UserProfile | undefined
}

const displayComments = computed<DisplayComment[]>(() => {
  return comments.value
    .map((c) => {
      const message = parseMessage(c.msg)
      if (!message) return null
      const commentTo = getCommentTo(c)
      return {
        id: c.id,
        postid: c.postid,
        parentid: c.parentid,
        answerid: c.answerid,
        address: c.address,
        commentTo,
        message: trimText(message, MESSAGE_TRIM_LENGTH),
        authorProfile: profilesByAddress.value[c.address],
        toProfile: commentTo ? profilesByAddress.value[commentTo] : undefined,
      }
    })
    .filter((x): x is DisplayComment => x !== null)
})

function openPost(postid: string): void {
  const post = postsStore.getPostByShareId(postid)
  if (post) {
    modalStore.openPostModal(post as Parameters<typeof modalStore.openPostModal>[0])
  }
}
</script>
