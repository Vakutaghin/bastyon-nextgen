import { defineComponent, computed } from 'vue'
import HeaderLogo from '@/b-components/header/header-logo/header-logo.vue'
import HeaderSearch from '@/b-components/header/header-search/header-search.vue'
import HeaderUser from '@/b-components/header/header-user/header-user.vue'
import HeaderEvents from '@/b-components/header/header-events/header-events.vue'
import { SC_Header, SC_Sections, SC_Right, SC_MessengerWrapper } from './styled'
import { MessageOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain'

export const appHeaderOptions = defineComponent({
  name: 'AppHeader',
  components: {
    HeaderLogo,
    HeaderSearch,
    HeaderUser,
    HeaderEvents,
    SC_Header,
    SC_Sections,
    SC_Right,
    SC_MessengerWrapper,
    MessageOutlined,
    CloseOutlined
  },
  setup() {
    const messengerStore = useMessengerStore()
    const authStore = useAuthStore()
    
    const toggleMessenger = () => {
      if (!authStore.isUserAuthenticated) return
      messengerStore.isFullScreen = !messengerStore.isFullScreen
    }

    const showMessengerIcon = computed(() => authStore.isUserAuthenticated)

    return {
      messengerStore,
      toggleMessenger,
      showMessengerIcon
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
      }
    }
  }
})
