<template>
  <SC_SettingsWork>
    <SC_SettingsPage>
      <h1 class="visually-hidden">Настройки</h1>
      <SC_SettingsContentWrapper>
        <SC_SettingsSidebar>
          <SC_SettingsSidebarItem
            v-for="tab in SETTINGS_TABS"
            :key="tab.key"
            :active="activeTab === tab.key"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </SC_SettingsSidebarItem>
        </SC_SettingsSidebar>

        <SC_SettingsMain>
          <GeneralTab v-if="activeTab === 'general'" />
          <WhatsNewTab v-else-if="activeTab === 'whatsNew'" />
          <NotificationsTab v-else-if="activeTab === 'notifications'" />
          <PrivateKeyTab v-else-if="activeTab === 'privateKey'" />
          <BlockExplorerTab v-else-if="activeTab === 'blockExplorer'" />
          <SC_SettingsPlaceholder v-else>
            {{ placeholderText }}
          </SC_SettingsPlaceholder>
        </SC_SettingsMain>
      </SC_SettingsContentWrapper>
    </SC_SettingsPage>
  </SC_SettingsWork>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNotificationSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui-store'
import GeneralTab from './tabs/general-tab.vue'
import NotificationsTab from './tabs/notifications-tab.vue'
import PrivateKeyTab from './tabs/private-key-tab.vue'
import BlockExplorerTab from './tabs/block-explorer-tab.vue'
import WhatsNewTab from './tabs/whats-new-tab.vue'
import {
  SC_SettingsWork,
  SC_SettingsPage,
  SC_SettingsContentWrapper,
  SC_SettingsSidebar,
  SC_SettingsSidebarItem,
  SC_SettingsMain,
  SC_SettingsPlaceholder,
} from './settings-page.styled'

defineOptions({ name: 'SettingsPage' })

export type T_SettingsTabKey =
  | 'general'
  | 'notifications'
  | 'wallets'
  | 'accounts'
  | 'system'
  | 'privateKey'
  | 'blockExplorer'
  | 'whatsNew'

const SETTINGS_TABS: { key: T_SettingsTabKey; label: string }[] = [
  { key: 'general', label: 'Общие' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'wallets', label: 'Кошельки' },
  { key: 'accounts', label: 'Аккаунты' },
  { key: 'system', label: 'Система' },
  { key: 'privateKey', label: 'Приватный ключ' },
  { key: 'blockExplorer', label: 'Block Explorer' },
  { key: 'whatsNew', label: 'Что нового' },
]

const activeTab = ref<T_SettingsTabKey>('notifications')

// Подгружаем стартовые состояния (язык, фильтры) до того, как соответствующие
// табы будут открыты — иначе при первом переключении на «Уведомления» switch
// показал бы дефолтные значения вместо сохранённых.
const notificationSettings = useNotificationSettingsStore()
const uiStore = useUIStore()
onMounted(() => {
  notificationSettings.load()
  void uiStore.loadLanguage()
})

const placeholderText = computed(() => {
  const item = SETTINGS_TABS.find((tab) => tab.key === activeTab.value)
  return item ? `Раздел «${item.label}» — контент будет добавлен позже.` : ''
})
</script>
