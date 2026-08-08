<template>
  <SC_ProfileWork class="adj">
    <SC_ProfilePage>
      <h1 class="visually-hidden">
        {{ profile?.name || ($route.params.userName as string) || t('profile.title') }}
      </h1>
      <ProfileCover :profile="profile" />

      <SC_ProfileContentWrapper>
        <ProfileSidebar :profile="profile" @profile-updated="onSidebarProfileUpdated" />

        <SC_ProfileMainContent>
          <SC_LoadingProfile v-if="loading">
            <Spin :tip="t('profile.loadingProfile')">
              <template #indicator>
                <LoadingOutlined :style="ICON_PRIMARY_40" spin />
              </template>
            </Spin>
          </SC_LoadingProfile>

          <SC_ErrorProfile v-else-if="error">
            {{ error }}
          </SC_ErrorProfile>

          <SC_PendingProfile v-else-if="isOwnPendingProfile">
            <div class="pending-icon">
              <ClockCircleOutlined />
            </div>
            <div class="pending-title">{{ t('profile.pendingTitle') }}</div>
            <div>
              {{ t('profile.pendingDescription') }}
            </div>
          </SC_PendingProfile>

          <div v-else-if="userAddress">
            <SC_ProfileCreatePost v-if="isOwnProfile">
              <Button type="primary" @click="openComposer">
                <template #icon>
                  <PlusOutlined />
                </template>
                {{ t('postCard.createPost') }}
              </Button>
            </SC_ProfileCreatePost>

            <ProfileFeed
              :address="userAddress"
              :profile="profile"
              :lang="''"
              @profile-loaded="onProfileLoaded"
            />
          </div>
        </SC_ProfileMainContent>
      </SC_ProfileContentWrapper>
    </SC_ProfilePage>
  </SC_ProfileWork>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined, ClockCircleOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useDocumentTitle } from '@/composables/use-document-title'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth, getByPRC } from '@/helpers/api/request'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useModalStore } from '@/stores'
import Button from '@/components/button/button.vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type { GetUserAddressResponse } from '@/types/rpc-responses/get-user-address'
import ProfileCover from '@/b-components/profile/profile-cover/profile-cover.vue'
import ProfileSidebar from '@/b-components/profile/profile-sidebar/profile-sidebar.vue'
import ProfileFeed from '@/b-components/profile/profile-feed/profile-feed.vue'
import Spin from '@/components/spin/spin.vue'
import { ICON_PRIMARY_40 } from '@/styles/icon-styles'
import {
  SC_ProfileWork,
  SC_ProfileMainContent,
  SC_ProfilePage,
  SC_ProfileContentWrapper,
  SC_LoadingProfile,
  SC_ErrorProfile,
  SC_PendingProfile,
  SC_ProfileCreatePost,
} from './profile-page.styled'

interface ProfileWithAccSet extends UserProfile {
  accSet?: unknown
}

const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const modalStore = useModalStore()
const userAddress = ref<string>('')
const profile = ref<ProfileWithAccSet | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const isOwnPendingProfile = ref(false)

// Своя страница профиля: резолвнутый адрес совпадает с адресом текущего аккаунта.
const isOwnProfile = computed<boolean>(() => {
  const my = authStore.getUserAddress
  return !!my && userAddress.value === my
})

// Открыть модалку композера поста (та же, что в шапке ленты).
function openComposer(): void {
  modalStore.openPostComposerModal()
}

function readPendingNickname(): string | null {
  try {
    return localStorage.getItem('pending_nickname')
  } catch {
    return null
  }
}

async function fetchUserProfile(identifier: string): Promise<void> {
  loading.value = true
  error.value = null
  profile.value = null
  userAddress.value = ''

  try {
    let address = identifier

    // Address у Pocketnet — 33-34 символа. Если короче, считаем что это nickname
    // и резолвим в адрес. Иначе сразу используем как адрес.
    if (identifier.length < 30) {
      const myAddress = authStore.getUserAddress
      const myProfileName = (authStore.getUserProfile as { name?: string } | null)?.name
      const myName = myProfileName || authStore.getCachedAccountName || readPendingNickname()

      if (myAddress && myName && identifier.toLowerCase() === myName.toLowerCase()) {
        // Это наш собственный профиль — берём адрес из store напрямую, без
        // getuseraddress. Иначе свежезарегистрированное имя, ещё не
        // распространившееся по всем нодам, давало бы «Пользователь не найден».
        address = myAddress
      } else {
        const addressResponse = (await getByPRC({
          method: rpcEndpoints.getUserAddress,
          parameters: [identifier],
          options: { auth: false },
        })) as GetUserAddressResponse

        if (
          addressResponse?.data &&
          addressResponse.data.length > 0 &&
          addressResponse.data[0]?.address
        ) {
          address = addressResponse.data[0].address
        } else {
          throw new Error(t('profile.userNotFound'))
        }
      }
    }

    userAddress.value = address

    // Свой профиль: берём данные из auth-store, getuserprofile не дёргаем
    // (нам они доступны без сетевого запроса).
    const myAddress = authStore.getUserAddress
    const myProfile = authStore.getUserProfile
    if (myAddress && address === myAddress) {
      if (myProfile) {
        profile.value = { ...myProfile } as UserProfile
      } else {
        // Регистрация в процессе — собираем заглушку из pending-nickname.
        const pendingNickname = readPendingNickname()
        profile.value = {
          address: myAddress,
          name: pendingNickname || identifier,
          hash: '',
          id: 0,
        }
      }
    } else {
      const profileResponse = (await getByPRCWithAuth({
        method: rpcEndpoints.getUserProfile,
        parameters: [[address]],
        options: { auth: false },
      })) as { data?: UserProfile[] } | UserProfile[]

      if (
        !Array.isArray(profileResponse) &&
        profileResponse?.data &&
        profileResponse.data.length > 0
      ) {
        profile.value = profileResponse.data[0]
      } else if (Array.isArray(profileResponse) && profileResponse.length > 0) {
        // Legacy-формат: массив напрямую вместо { data: [...] }.
        profile.value = profileResponse[0]
      } else {
        profile.value = { address, name: identifier, hash: '', id: 0 }
      }
    }

    // Догружаем accSet (обложка, кастомные настройки аккаунта). Это опционально —
    // 502/таймаут не должен ронять профиль.
    try {
      const settingsResponse = (await getByPRC({
        method: rpcEndpoints.getAccountSetting,
        parameters: [address],
        options: { auth: false },
      })) as { data?: unknown } | unknown

      let accSet: unknown =
        settingsResponse && typeof settingsResponse === 'object' && 'data' in settingsResponse
          ? (settingsResponse as { data?: unknown }).data
          : settingsResponse

      if (accSet) {
        if (typeof accSet === 'string') {
          try {
            accSet = JSON.parse(accSet)
          } catch (e) {
            console.warn('Failed to parse accSet JSON:', e)
          }
        }

        if (profile.value && typeof accSet === 'object') {
          profile.value = { ...profile.value, accSet }
        }
      }
    } catch (e) {
      console.warn('Failed to load account settings:', e)
    }
  } catch (e) {
    console.error('Failed to load profile:', e)
    error.value = e instanceof Error ? e.message : t('profile.loadFailed')
  } finally {
    loading.value = false
  }
}

function onProfileLoaded(newProfile: UserProfile): void {
  // Лента может прислать более свежие поля профиля (subscribers_count и т.п.) —
  // мерджим поверх существующего.
  if (newProfile) {
    profile.value = { ...(profile.value ?? {}), ...newProfile }
  }
}

// Оптимистичный апдейт после редактирования профиля (edit-profile-modal).
function onSidebarProfileUpdated(patch: Partial<UserProfile>): void {
  if (patch) {
    profile.value = { ...(profile.value ?? {}), ...patch } as ProfileWithAccSet
  }
}

watch(
  () => route.params.userName,
  (newUserName) => {
    if (newUserName) fetchUserProfile(newUserName as string)
  },
  { immediate: true }
)

useDocumentTitle(
  () => profile.value?.name ?? (route.params.userName as string) ?? t('profile.title')
)

// Наш профиль без id — регистрация в процессе.
watch(profile, (p) => {
  isOwnPendingProfile.value = !!(
    p &&
    p.address &&
    authStore.getUserAddress === p.address &&
    (!p.id || p.id === 0)
  )
})
</script>
