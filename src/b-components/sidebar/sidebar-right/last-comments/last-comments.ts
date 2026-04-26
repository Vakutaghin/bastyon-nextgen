import { defineComponent, computed } from 'vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import Spin from '@/components/spin/spin.vue'
import { useLastComments } from '@/composables/use-comments-queries'
import { useUserProfiles } from '@/composables/use-user-queries'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import type { GetLastComment } from '@/types/rpc-responses/get-last-comments'
import type { CommentMessage } from '@/types/rpc-responses/get-last-comments'
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
  SC_LastCommentsEmpty
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
  if (c.addressCommentAnswer && c.addressCommentAnswer !== c.address) return c.addressCommentAnswer
  if (c.addressCommentParent && c.addressCommentParent !== c.address) return c.addressCommentParent
  if (c.addressContent && c.addressContent !== c.address) return c.addressContent
  return ''
}

function trimText(text: string, maxLen: number): string {
  const plain = text.replace(/\s+/g, ' ').trim()
  if (plain.length <= maxLen) return plain
  return plain.slice(0, maxLen) + '…'
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

export const lastCommentsOptions = defineComponent({
  name: 'LastComments',
  components: {
    LoadingOutlined,
    Spin,
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
    SC_LastCommentsEmpty
  },
  setup() {
    const modalStore = useModalStore()
    const postsStore = usePostsStore()

    const { data: lastCommentsResponse, isLoading } = useLastComments(true)
    const comments = computed(() => {
      const d = lastCommentsResponse.value?.data
      return Array.isArray(d) ? d : []
    })

    const uniqueAddresses = computed(() => {
      const set = new Set<string>()
      comments.value.forEach((c) => {
        set.add(c.address)
        const to = getCommentTo(c)
        if (to) set.add(to)
      })
      return Array.from(set)
    })

    const { data: profilesResponse } = useUserProfiles(uniqueAddresses, true)
    const profilesByAddress = computed(() => {
      const arr = profilesResponse.value
      if (!Array.isArray(arr)) return {} as Record<string, UserProfile>
      const map: Record<string, UserProfile> = {}
      arr.forEach((p) => {
        if (p?.address) map[p.address] = p
      })
      return map
    })

    const displayComments = computed(() => {
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
            toProfile: commentTo ? profilesByAddress.value[commentTo] : undefined
          }
        })
        .filter(Boolean) as Array<{
        id: string
        postid: string
        parentid: string
        answerid: string
        address: string
        commentTo: string
        message: string
        authorProfile: UserProfile | undefined
        toProfile: UserProfile | undefined
      }>
    })

    function openPost(postid: string) {
      const post = postsStore.getPostByShareId(postid)
      if (post) {
        modalStore.openPostModal(post as any)
      }
    }

    return {
      isLoading,
      displayComments,
      getAvatarUrl,
      getDisplayName,
      openPost
    }
  }
})
