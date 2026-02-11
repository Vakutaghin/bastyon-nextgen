import { defineComponent, ref } from 'vue'

import {
  SC_SettingsWork,
  SC_SettingsPage,
  SC_SettingsContentWrapper,
  SC_SettingsSidebar,
  SC_SettingsSidebarItem,
  SC_SettingsMain,
  SC_SettingsPlaceholder,
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

export default defineComponent({
  name: 'SettingsPage',
  components: {
    SC_SettingsWork,
    SC_SettingsPage,
    SC_SettingsContentWrapper,
    SC_SettingsSidebar,
    SC_SettingsSidebarItem,
    SC_SettingsMain,
    SC_SettingsPlaceholder,
  },
  setup() {
    const activeTab = ref<SettingsTabKey>('notifications')
    return {
      tabs: SETTINGS_TABS,
      activeTab,
    }
  },

  methods: {
    setActiveTab(key: SettingsTabKey) {
      this.activeTab = key
    },

    placeholderText(): string {
      const item = SETTINGS_TABS.find((t) => t.key === this.activeTab)
      return item ? `Раздел «${item.label}» — контент будет добавлен позже.` : ''
    },
  },
})
