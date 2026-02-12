import { defineComponent, ref, onMounted } from 'vue'
import { Switch } from 'ant-design-vue'
import { useNotificationSettingsStore } from '@/stores'
import type { NotificationFilterKey } from '@/stores/notification-settings-store'
import { NOTIFICATION_FILTER_LABELS } from '@/stores/notification-settings-store'

import {
  SC_SettingsWork,
  SC_SettingsPage,
  SC_SettingsContentWrapper,
  SC_SettingsSidebar,
  SC_SettingsSidebarItem,
  SC_SettingsMain,
  SC_SettingsPlaceholder,
  SC_SettingsSectionTitle,
  SC_NotificationsList,
  SC_NotificationsRow,
  SC_NotificationsRowLabel,
} from './settings-page.styled'

export type T_SettingsTabKey =
  | 'general'
  | 'notifications'
  | 'limits'
  | 'wallet'
  | 'accounts'
  | 'system'
  | 'myVideos'
  | 'privateKey'
  | 'blockExplorer'

export const SETTINGS_TABS: { key: T_SettingsTabKey; label: string }[] = [
  { key: 'general', label: 'Общие' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'limits', label: 'Лимиты' },
  { key: 'wallet', label: 'Кошелёк' },
  { key: 'accounts', label: 'Аккаунты' },
  { key: 'system', label: 'Система' },
  { key: 'myVideos', label: 'Мои видео' },
  { key: 'privateKey', label: 'Приватный ключ' },
  { key: 'blockExplorer', label: 'Block Explorer' },
]

const NOTIFICATION_KEYS: NotificationFilterKey[] = [
  'sound',
  'win',
  'transactions',
  'upvotes',
  'downvotes',
  'comments',
  'answers',
  'followers',
  'commentScore',
]

export default defineComponent({
  name: 'SettingsPage',
  components: {
    Switch,
    SC_SettingsWork,
    SC_SettingsPage,
    SC_SettingsContentWrapper,
    SC_SettingsSidebar,
    SC_SettingsSidebarItem,
    SC_SettingsMain,
    SC_SettingsPlaceholder,
    SC_SettingsSectionTitle,
    SC_NotificationsList,
    SC_NotificationsRow,
    SC_NotificationsRowLabel,
  },
  setup() {
    const activeTab = ref<T_SettingsTabKey>('notifications')
    const notificationSettings = useNotificationSettingsStore()
    onMounted(() => {
      notificationSettings.load()
    })
    return {
      tabs: SETTINGS_TABS,
      activeTab,
      notificationSettings,
      NOTIFICATION_FILTER_LABELS,
      NOTIFICATION_KEYS,
    }
  },

  methods: {
    setActiveTab(key: T_SettingsTabKey) {
      this.activeTab = key
    },

    placeholderText(): string {
      const item = SETTINGS_TABS.find((t) => t.key === this.activeTab)
      return item ? `Раздел «${item.label}» — контент будет добавлен позже.` : ''
    },

    async onNotificationFilterChange(key: NotificationFilterKey, checked: boolean) {
      await this.notificationSettings.setFilter(key, checked)
    },
  },
})
