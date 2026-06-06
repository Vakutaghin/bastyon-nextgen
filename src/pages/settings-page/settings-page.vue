<template>
  <SC_SettingsWork>
    <SC_SettingsPage>
      <h1 class="visually-hidden">{{ t('settings.title') }}</h1>
      <SC_SettingsContentWrapper>
        <SC_SettingsSidebar>
          <SC_SettingsSidebarItem
            v-for="tab in SETTINGS_TABS"
            :key="tab.key"
            :active="activeTab === tab.key"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ t(tab.labelKey) }}
          </SC_SettingsSidebarItem>
        </SC_SettingsSidebar>

        <SC_SettingsMain>
          <GeneralTab v-if="activeTab === 'general'" />
          <WhatsNewTab v-else-if="activeTab === 'whatsNew'" />
          <NotificationsTab v-else-if="activeTab === 'notifications'" />
          <PrivateKeyTab v-else-if="activeTab === 'privateKey'" />
          <BlockExplorerTab v-else-if="activeTab === 'blockExplorer'" />
          <BlacklistTab v-else-if="activeTab === 'blacklist'" />
          <AppPermissionsTab v-else-if="activeTab === 'appPermissions'" />
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
import { useI18n } from 'vue-i18n'
import { useNotificationSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui-store'
import GeneralTab from './tabs/general-tab.vue'
import NotificationsTab from './tabs/notifications-tab.vue'
import PrivateKeyTab from './tabs/private-key-tab.vue'
import BlockExplorerTab from './tabs/block-explorer-tab.vue'
import BlacklistTab from './tabs/blacklist-tab.vue'
import AppPermissionsTab from './tabs/app-permissions-tab.vue'
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
  | 'blacklist'
  | 'appPermissions'
  | 'whatsNew'

// labelKey — ключ i18n; рендерим через t(), чтобы метки реактивно следовали за локалью.
const SETTINGS_TABS: { key: T_SettingsTabKey; labelKey: string }[] = [
  { key: 'general', labelKey: 'settings.tabs.general' },
  { key: 'notifications', labelKey: 'settings.tabs.notifications' },
  { key: 'wallets', labelKey: 'settings.tabs.wallets' },
  { key: 'accounts', labelKey: 'settings.tabs.accounts' },
  { key: 'system', labelKey: 'settings.tabs.system' },
  { key: 'privateKey', labelKey: 'settings.tabs.privateKey' },
  { key: 'blockExplorer', labelKey: 'settings.tabs.blockExplorer' },
  { key: 'blacklist', labelKey: 'settings.tabs.blacklist' },
  { key: 'appPermissions', labelKey: 'settings.tabs.appPermissions' },
  { key: 'whatsNew', labelKey: 'settings.tabs.whatsNew' },
]

const { t } = useI18n()
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
  return item ? t('settings.placeholder', { section: t(item.labelKey) }) : ''
})
</script>
