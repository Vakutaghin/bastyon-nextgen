import { defineComponent, computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import HeaderLogo from '@/b-components/header/header-logo/header-logo.vue'
import HeaderSearch from '@/b-components/header/header-search/header-search.vue'
import HeaderUser from '@/b-components/header/header-user/header-user.vue'
import HeaderEvents from '@/b-components/header/header-events/header-events.vue'
import HeaderNotifications from '@/b-components/header/header-notifications/header-notifications.vue'
import HeaderTor from '@/b-components/header/header-tor/header-tor.vue'
import HeaderReportBug from '@/b-components/header/header-report-bug/header-report-bug.vue'
import { MobileNavDrawer } from '@/b-components/mobile-nav-drawer'
import {
  SC_Header,
  SC_Sections,
  SC_Right,
  SC_MessengerWrapper,
  SC_UnreadBadge,
  SC_HamburgerButton,
} from './styled'
import { MessageOutlined, CloseOutlined, MenuOutlined } from '@ant-design/icons-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'

export const appHeaderOptions = defineComponent({
  name: 'AppHeader',
  components: {
    HeaderLogo,
    HeaderSearch,
    HeaderUser,
    HeaderEvents,
    HeaderNotifications,
    HeaderTor,
    HeaderReportBug,
    MobileNavDrawer,
    SC_Header,
    SC_Sections,
    SC_Right,
    SC_MessengerWrapper,
    SC_UnreadBadge,
    SC_HamburgerButton,
    MessageOutlined,
    CloseOutlined,
    MenuOutlined,
  },
  setup() {
    const messengerStore = useMessengerStore()
    const authStore = useAuthStore()
    const { isFullScreen, totalUnreadCount } = storeToRefs(messengerStore)
    const { isMobileOrTablet } = useViewport()

    const drawerOpen = ref(false)

    const toggleMessenger = () => {
      if (!authStore.isUserAuthenticated) return
      messengerStore.isFullScreen = !messengerStore.isFullScreen
    }

    const openDrawer = () => {
      drawerOpen.value = true
    }
    const closeDrawer = () => {
      drawerOpen.value = false
    }

    // Иконка чата в хедере показывается всегда для авторизованного юзера —
    // на десктопе это альтернатива floating-кнопке, на мобилке единственный способ.
    const showMessengerIcon = computed(() => authStore.isUserAuthenticated)

    const unreadBadge = computed(() => {
      const n = totalUnreadCount.value
      if (!n || n <= 0) return ''
      return n > 99 ? '99+' : String(n)
    })

    return {
      isFullScreen,
      toggleMessenger,
      showMessengerIcon,
      unreadBadge,
      mobile: isMobileOrTablet,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }
  },
  directives: {
    hideZeroWidth: {
      mounted(el: HTMLElement) {
        const checkWidth = () => {
          const children = Array.from(el.children) as HTMLElement[]
          children.forEach((child) => {
            const rect = child.getBoundingClientRect()
            if (rect.width === 0) {
              child.style.display = 'none'
            } else {
              child.style.display = ''
            }
          })
        }

        // Проверяем при монтировании
        checkWidth()

        // Используем ResizeObserver для отслеживания изменений размера
        const resizeObserver = new ResizeObserver(() => {
          checkWidth()
        })

        resizeObserver.observe(el)
        const children = Array.from(el.children) as HTMLElement[]
        children.forEach((child) => {
          resizeObserver.observe(child)
        })

        // Сохраняем observer для очистки
        ;(el as any)._resizeObserver = resizeObserver
      },
      unmounted(el: HTMLElement) {
        const observer = (el as any)._resizeObserver
        if (observer) {
          observer.disconnect()
        }
      },
    },
  },
})
