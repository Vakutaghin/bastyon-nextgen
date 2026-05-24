import { defineComponent, computed } from 'vue'
import type { PropType } from 'vue'
import { RouterLink } from 'vue-router'
import Spin from '@/components/spin/spin.vue'
import { LoadingOutlined, BlockOutlined } from '@ant-design/icons-vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
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
  SC_ExplorerLink
} from './styled'
import { useMessengerStore } from '@/b-components/messenger/store'

export default defineComponent({
  name: 'ProfileSidebar',
  components: {
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
    RouterLink,
    Spin,
    LoadingOutlined,
    BlockOutlined
  },
  props: {
    profile: {
      type: Object as PropType<UserProfile | null>,
      default: null
    }
  },
  setup(props) {
    const messengerStore = useMessengerStore()
    const userAvatar = computed(() => {
      // 1. Пробуем из accSet (настройки аккаунта) - это приоритетный источник, если есть
      const profileAny = props.profile as any
      if (profileAny?.accSet?.image) {
        return profileAny.accSet.image
      }

      // 2. Стандартное поле i
      if (props.profile?.i) {
        return props.profile.i
      }

      return null
    })

    const displayName = computed(() => {
      return props.profile?.name || props.profile?.address || 'User'
    })

    const userInitial = computed(() => {
      const name = displayName.value
      return name.charAt(0).toUpperCase()
    })

    const formattedDate = computed(() => {
      if (!props.profile?.regdate) return ''
      return new Date(props.profile.regdate * 1000).toLocaleDateString()
    })

    const userSite = computed(() => {
      // Пользователь указал, что ссылка находится в поле 's'
      let url = props.profile?.s || null

      // Если в 's' пусто, пробуем старый способ через 'b' (на всякий случай, или можно убрать)
      if (!url && props.profile?.b) {
        try {
          const json = JSON.parse(props.profile.b)
          url = json.site || json.url || null
        } catch (e) {
          // ignore
        }
      }

      if (url && !url.match(/^https?:\/\//)) {
          url = 'https://' + url
      }
      return url
    })

    const formattedUserAbout = computed(() => {
      let text = props.profile?.a || props.profile?.r || ''
      if (!text) return ''

      // Если описание пришло в URI-encoded виде — декодируем
      if (typeof text === 'string' && /%[0-9A-Fa-f]{2}/.test(text)) {
        try {
          text = decodeURIComponent(text.replace(/\+/g, ' '))
        } catch {
          // оставляем как есть при ошибке декодирования
        }
      }

      // Escape HTML
      const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")

      // URL regex
      const urlRegex = /((https?:\/\/)|(www\.))[^\s]+/g

      return escapedText.replace(urlRegex, (url) => {
        let href = url
        if (!href.match(/^https?:\/\//)) {
          href = 'https://' + href
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
      })
    })

    const userAddress = computed(() => {
      return props.profile?.address || ''
    })

    const copyAddress = () => {
      if (userAddress.value) {
        navigator.clipboard.writeText(userAddress.value)
      }
    }

    const formattedReputation = computed(() => {
      const r: unknown = props.profile?.reputation ?? 0
      const num = typeof r === 'number' ? r : Number(r || 0)
      return num.toFixed(1)
    })

    // Количество публикаций: API getuserprofile возвращает postcnt; content[200] — посты по типам
    const publicationsCount = computed(() => {
      const p = props.profile
      if (!p) return 0
      const fromApi = (p as any).publications_count ?? p.postcnt
      if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) return fromApi
      const fromContent = p.content?.[200]
      if (typeof fromContent === 'number' && !Number.isNaN(fromContent)) return fromContent
      return 0
    })

    const startChatWithUser = async () => {
      const address = userAddress.value
      if (!address) return
      try {
        // Передаём профиль из сайдбара — мессенджер не будет повторно запрашивать аватар, имя, подписчиков и т.д.
        await messengerStore.openInviteWithAddress(address, props.profile ?? undefined)
      } catch (e) {
        console.error('[ProfileSidebar] Failed to start chat:', e)
      }
    }

    return {
      userAvatar,
      displayName,
      userInitial,
      formattedDate,
      userSite,
      formattedUserAbout,
      userAddress,
      copyAddress,
      formattedReputation,
      publicationsCount,
      startChatWithUser
    }
  }
})
