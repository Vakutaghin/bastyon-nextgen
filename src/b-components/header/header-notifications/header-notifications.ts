import { defineComponent, computed, ref, onMounted, watch } from 'vue'
import { Dropdown, Badge } from 'ant-design-vue'
import { BellOutlined } from '@ant-design/icons-vue'
import { SC_NotificationsWrapper } from './styled'
import { useAuthStore, useNotificationsStore } from '@/stores'
import type { NotificationItem } from '@/stores/notifications-store'

function formatNotificationTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'только что'
  if (diffM < 60) return `${diffM} мин.`
  if (diffH < 24) return `${diffH} ч.`
  if (diffD < 7) return `${diffD} дн.`
  return d.toLocaleDateString()
}

export const headerNotificationsOptions = defineComponent({
  name: 'HeaderNotifications',
  components: {
    Dropdown,
    Badge,
    BellOutlined,
    SC_NotificationsWrapper
  },
  setup() {
    const authStore = useAuthStore()
    const notificationsStore = useNotificationsStore()

    const runInit = () => {
      if (authStore.isUserAuthenticated && authStore.getUserAddress) {
        notificationsStore.init()
      }
    }

    onMounted(runInit)

    watch(
      () => authStore.isUserAuthenticated && authStore.getUserAddress,
      (authenticated) => {
        if (authenticated) runInit()
      }
    )

    const visible = ref(false)
    const unreadCount = computed(() => notificationsStore.unreadCount)
    const list = computed(() => notificationsStore.list.slice(0, 20))
    const isLoading = computed(() => notificationsStore.loading)

    const formatTime = (n: NotificationItem) => formatNotificationTime(n.time)

    const onItemClick = (item: NotificationItem) => {
      notificationsStore.markSeen(item.id)
      if (item.link) {
        visible.value = false
        window.location.href = item.link
      }
    }

    const onOpenChange = (open: boolean) => {
      visible.value = open
      if (open) {
        notificationsStore.markAllSeenAndPersistBlock()
        if (notificationsStore.list.length === 0 && !notificationsStore.loading) {
          notificationsStore.init({ forceRefresh: true })
        }
      }
    }

    return {
      authStore,
      notificationsStore,
      visible,
      unreadCount,
      list,
      isLoading,
      formatTime,
      onItemClick,
      onOpenChange
    }
  },
  computed: {
    isAuthenticated(): boolean {
      return this.authStore.isUserAuthenticated
    }
  }
})
