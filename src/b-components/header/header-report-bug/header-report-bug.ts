import { defineComponent, computed } from 'vue'
import { Tooltip } from 'ant-design-vue'
import { BugOutlined } from '@ant-design/icons-vue'
import { SC_ReportBugWrapper } from './styled'
import { useAuthStore } from '@/blockchain'
import { useMessengerStore } from '@/b-components/messenger/store'

// TODO: заменить на реальный адрес аккаунта-приёмника багов
const BUG_REPORT_ACCOUNT_ADDRESS = ''

export const headerReportBugOptions = defineComponent({
  name: 'HeaderReportBug',
  components: {
    Tooltip,
    BugOutlined,
    SC_ReportBugWrapper,
  },
  setup() {
    const authStore = useAuthStore()
    const messengerStore = useMessengerStore()

    const isVisible = computed(() => authStore.isUserAuthenticated)

    const onClick = async () => {
      if (!authStore.isUserAuthenticated) return
      if (!BUG_REPORT_ACCOUNT_ADDRESS) {
        console.warn('[HeaderReportBug] BUG_REPORT_ACCOUNT_ADDRESS не задан')
        return
      }
      const roomId = await messengerStore.startChatWithAddress(BUG_REPORT_ACCOUNT_ADDRESS)
      if (roomId) {
        messengerStore.switchToChatAndLoad(roomId)
        messengerStore.isFullScreen = true
      }
    }

    return { isVisible, onClick }
  },
})
