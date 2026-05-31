<template>
  <SC_ProfileSidebar>
    <div v-if="profile">
      <SC_UserAvatar v-if="userAvatar">
        <img :src="userAvatar" :alt="displayName" />
      </SC_UserAvatar>
      <SC_UserAvatarPlaceholder v-else>
        {{ userInitial }}
      </SC_UserAvatarPlaceholder>

      <SC_UserName>{{ displayName }}</SC_UserName>

      <SC_UserStats>
        <SC_StatItem>
          <SC_StatLabel>{{ t('profile.reputation') }}</SC_StatLabel>
          <SC_StatValue>{{ formattedReputation }}</SC_StatValue>
        </SC_StatItem>

        <SC_StatItem>
          <SC_StatLabel>{{ t('profile.subscribers') }}</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribers_count || 0 }}</SC_StatValue>
        </SC_StatItem>

        <SC_StatItem>
          <SC_StatLabel>{{ t('profile.subscriptions') }}</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribes_count || 0 }}</SC_StatValue>
        </SC_StatItem>
      </SC_UserStats>

      <SC_StartChatButton :disabled="!userAddress" @click="startChatWithUser">
        {{ t('profile.startChat') }}
      </SC_StartChatButton>

      <SC_UserAbout v-if="formattedUserAbout">
        <h3>{{ t('profile.info') }}</h3>

        <p v-html="formattedUserAbout" />
        <hr />

        <SC_UserAddress v-if="userAddress" title="Copy address" @click="copyAddress">
          {{ userAddress }}
        </SC_UserAddress>

        <SC_ExplorerLinkRow v-if="userAddress">
          <RouterLink
            v-slot="{ navigate, href }"
            custom
            :to="{ name: 'explorer-address', params: { address: userAddress } }"
          >
            <SC_ExplorerLink :href="href" @click="navigate">
              <BlockOutlined :style="ICON_SIZE_11" />
              {{ t('profile.openInExplorer') }}
            </SC_ExplorerLink>
          </RouterLink>
        </SC_ExplorerLinkRow>

        <SC_UserSite v-if="userSite" :href="userSite" target="_blank">
          {{ userSite }}
        </SC_UserSite>

        <div>
          <span>{{ t('profile.publications') }} </span>
          <strong>{{ publicationsCount }}</strong>
        </div>

        <div v-if="profile.regdate">
          <span
            >{{ t('profile.registered') }} <strong>{{ formattedDate }}</strong></span
          >
        </div>
      </SC_UserAbout>
    </div>

    <SC_LoadingState v-else>
      <Spin>
        <template #indicator>
          <LoadingOutlined :style="ICON_PRIMARY_24" spin />
        </template>
      </Spin>
    </SC_LoadingState>
  </SC_ProfileSidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined, BlockOutlined } from '@ant-design/icons-vue'
import Spin from '@/components/spin/spin.vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { useMessengerStore } from '@/b-components/messenger/store'
import { ICON_PRIMARY_24, ICON_SIZE_11 } from '@/styles/icon-styles'
import {
  SC_ProfileSidebar,
  SC_UserAvatar,
  SC_UserAvatarPlaceholder,
  SC_UserName,
  SC_UserStats,
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
  SC_UserAbout,
  SC_UserJoined,
  SC_LoadingState,
  SC_UserAddress,
  SC_UserSite,
  SC_StartChatButton,
  SC_ExplorerLinkRow,
  SC_ExplorerLink,
} from './styled'

interface ProfileWithAccSet extends UserProfile {
  accSet?: { image?: string }
  publications_count?: number
}

const props = defineProps<{ profile?: UserProfile | null }>()
const { t } = useI18n()
const messengerStore = useMessengerStore()

const userAvatar = computed<string | null>(() => {
  const p = props.profile as ProfileWithAccSet | null | undefined
  if (p?.accSet?.image) return p.accSet.image
  if (p?.i) return p.i
  return null
})

const displayName = computed<string>(() => {
  return props.profile?.name || props.profile?.address || 'User'
})

const userInitial = computed<string>(() => displayName.value.charAt(0).toUpperCase())

const formattedDate = computed<string>(() => {
  if (!props.profile?.regdate) return ''
  return new Date(props.profile.regdate * 1000).toLocaleDateString()
})

const userSite = computed<string | null>(() => {
  // Поле `s` — каноничный источник; `b` (JSON) — legacy-fallback.
  let url: string | null = props.profile?.s || null

  if (!url && props.profile?.b) {
    try {
      const json = JSON.parse(props.profile.b)
      url = json.site || json.url || null
    } catch {
      // ignore
    }
  }

  if (url && !url.match(/^https?:\/\//)) {
    url = 'https://' + url
  }
  return url
})

const formattedUserAbout = computed<string>(() => {
  let text = props.profile?.a || props.profile?.r || ''
  if (!text) return ''

  // URI-encoded описание встречается в старых записях — декодируем оппортунистически.
  if (typeof text === 'string' && /%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      text = decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      // оставляем как есть
    }
  }

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const urlRegex = /((https?:\/\/)|(www\.))[^\s]+/g

  return escapedText.replace(urlRegex, (url) => {
    let href = url
    if (!href.match(/^https?:\/\//)) href = 'https://' + href
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
})

const userAddress = computed<string>(() => props.profile?.address || '')

function copyAddress(): void {
  if (userAddress.value) {
    navigator.clipboard.writeText(userAddress.value)
  }
}

const formattedReputation = computed<string>(() => {
  const r: unknown = props.profile?.reputation ?? 0
  const num = typeof r === 'number' ? r : Number(r || 0)
  return num.toFixed(1)
})

// `getuserprofile` возвращает `postcnt`; `content[200]` — посты по типу,
// в свежих ответах используется `publications_count`.
const publicationsCount = computed<number>(() => {
  const p = props.profile as ProfileWithAccSet | null | undefined
  if (!p) return 0
  const fromApi = p.publications_count ?? p.postcnt
  if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) return fromApi
  const fromContent = p.content?.[200]
  if (typeof fromContent === 'number' && !Number.isNaN(fromContent)) return fromContent
  return 0
})

async function startChatWithUser(): Promise<void> {
  const address = userAddress.value
  if (!address) return
  try {
    // Передаём профиль из сайдбара — мессенджер не будет повторно
    // запрашивать аватар, имя, подписчиков и т.д.
    await messengerStore.openInviteWithAddress(address, props.profile ?? undefined)
  } catch (e) {
    console.error('[ProfileSidebar] Failed to start chat:', e)
  }
}
</script>
