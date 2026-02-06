import { defineComponent, computed, ref } from 'vue'
import { Dropdown, Menu, Badge } from 'ant-design-vue'
import { HourglassOutlined } from '@ant-design/icons-vue'
import { SC_EventsWrapper } from './styled'
import { useAuthStore } from '@/blockchain'
import { usePendingRatingsStore } from '@/stores'

export const headerEventsOptions = defineComponent({
  name: 'HeaderEvents',
  components: {
    Dropdown,
    Menu,
    Badge,
    HourglassOutlined,
    SC_EventsWrapper,
  },
  setup() {
    const authStore = useAuthStore()
    const pendingStore = usePendingRatingsStore()
    pendingStore.init()
    const pendingCount = computed(() => pendingStore.count)
    
    const visible = ref(false)

    return { authStore, pendingStore, pendingCount, visible }
  },
  computed: {
    isAuthenticated() {
      return this.authStore.isUserAuthenticated
    },
    pendingItems() {
      const items: any[] = []
      const keys = Array.from(this.pendingStore.items.keys())
      keys.forEach((k) => {
        const item = this.pendingStore.getPendingItem(k)
        if (item) {
          items.push(item)
        }
      })
      return items
    },
    menuItems() {
      // Deprecated, kept for compatibility if needed, but we use custom template now
      const items: any[] = []
      return items
    }
  }
})
