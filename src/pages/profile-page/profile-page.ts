import { defineComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  SC_ProfileWork,
  SC_ProfileMainContent,
  SC_ProfilePage,
  SC_ProfileContentWrapper,
  SC_LoadingProfile,
  SC_ErrorProfile
} from './profile-page.styled'
import ProfileCover from '@/b-components/profile/profile-cover/profile-cover.vue'
import ProfileSidebar from '@/b-components/profile/profile-sidebar/profile-sidebar.vue'
import ProfileFeed from '@/b-components/profile/profile-feed/profile-feed.vue'
import Spin from '@/components/spin/spin.vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { getByPRCWithAuth, getByPRC } from '@/helpers/api/request'
import { useAuthStore } from '@/blockchain/store/auth-store'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type { GetUserAddressResponse } from '@/types/rpc-responses/get-user-address'

export default defineComponent({
  name: 'ProfileView',
  components: {
    SC_ProfileWork,
    SC_ProfileMainContent,
    SC_ProfilePage,
    SC_ProfileContentWrapper,
    SC_LoadingProfile,
    SC_ErrorProfile,
    ProfileCover,
    ProfileSidebar,
    ProfileFeed,
    Spin,
    LoadingOutlined
  },
  setup() {
    const route = useRoute()
    const authStore = useAuthStore()
    const userAddress = ref<string>('')
    const profile = ref<UserProfile | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)

    const fetchUserProfile = async (identifier: string) => {
      loading.value = true
      error.value = null
      profile.value = null
      userAddress.value = ''

      try {
        let address = identifier

        // Если это не адрес (адрес обычно начинается с P и длинный), пробуем получить адрес по имени
        // Простая проверка: адрес Pocketnet 33-34 символа
        if (identifier.length < 30) {
          const addressResponse = await getByPRC({
            method: 'getuseraddress',
            parameters: [identifier],
            options: { auth: false }
          }) as GetUserAddressResponse

          if (addressResponse && addressResponse.data && addressResponse.data.length > 0 && addressResponse.data[0].address) {
            address = addressResponse.data[0].address
          } else {
            throw new Error('Пользователь не найден')
          }
        }

        userAddress.value = address

        // Свой профиль: используем данные из auth-store, getuserprofile не вызываем
        const myAddress = authStore.getUserAddress
        const myProfile = authStore.getUserProfile
        if (myAddress && myProfile && address === myAddress) {
          profile.value = { ...myProfile } as UserProfile
        } else {
          // Теперь получаем профиль по адресу
          const profileResponse = await getByPRCWithAuth({
            method: 'getuserprofile',
            parameters: [[address]],
            options: { auth: false }
          }) as any

          if (profileResponse && profileResponse.data && profileResponse.data.length > 0) {
            profile.value = profileResponse.data[0]
          } else if (profileResponse && Array.isArray(profileResponse) && profileResponse.length > 0) {
             // Иногда возвращает массив напрямую (в старых версиях/legacy)
             profile.value = profileResponse[0]
          } else {
            // Если профиль не найден, создаем заглушку с адресом
            profile.value = {
              address: address,
              name: identifier,
              hash: '',
              id: 0
            }
          }
        }

        // Пытаемся получить дополнительные настройки аккаунта (включая обложку из accSet)
        try {
          const settingsResponse = await getByPRC({
            method: 'getaccountsetting',
            parameters: [address],
            options: { auth: false }
          }) as any

          // getByPRC возвращает data как есть, если это JSON
          let accSet: any = null

          if (settingsResponse && settingsResponse.data) {
             accSet = settingsResponse.data
          } else if (settingsResponse) {
            // Если ответ пришел не в структуре { data: ... }, а напрямую
            accSet = settingsResponse
          }

          if (accSet) {
            // Если пришла строка, парсим её
            if (typeof accSet === 'string') {
              try {
                accSet = JSON.parse(accSet)
              } catch (e) {
                // Если не парсится, оставляем как есть или пустой объект
                console.warn('Failed to parse accSet JSON:', e)
              }
            }

            // Добавляем accSet в профиль
            if (profile.value && typeof accSet === 'object') {
              profile.value = { ...profile.value, accSet }
            }
          }
        } catch (e) {
          console.warn('Failed to load account settings:', e)
          // Не прерываем загрузку профиля, если настройки не загрузились
        }

      } catch (e: any) {
        console.error('Failed to load profile:', e)
        error.value = e.message || 'Не удалось загрузить профиль'
      } finally {
        loading.value = false
      }
    }

    const onProfileLoaded = (newProfile: UserProfile) => {
      // Обновляем профиль данными из ленты (они могут быть свежее или содержать дополнительные поля)
      if (newProfile) {
        profile.value = { ...profile.value, ...newProfile }
      }
    }

    watch(() => route.params.userName, (newUserName) => {
      if (newUserName) {
        fetchUserProfile(newUserName as string)
      }
    }, { immediate: true })

    return {
      userAddress,
      profile,
      loading,
      error,
      onProfileLoaded
    }
  }
})
