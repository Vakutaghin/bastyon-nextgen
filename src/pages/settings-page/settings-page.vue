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
          <LayoutTab v-else-if="activeTab === 'layout'" />
          <WhatsNewTab v-else-if="activeTab === 'whatsNew'" />
          <NotificationsTab v-else-if="activeTab === 'notifications'" />
          <PrivateKeyTab v-else-if="activeTab === 'privateKey'" />
          <BlacklistTab v-else-if="activeTab === 'blacklist'" />
          <AppPermissionsTab v-else-if="activeTab === 'appPermissions'" />
          <SystemTab v-else-if="activeTab === 'system'" />
          <ModulesTab v-else-if="activeTab === 'modules'" />
        </SC_SettingsMain>
      </SC_SettingsContentWrapper>
    </SC_SettingsPage>
  </SC_SettingsWork>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationSettingsStore } from '@/stores'
import { useUIStore } from '@/stores/ui-store'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import GeneralTab from './tabs/general-tab.vue'
import LayoutTab from './tabs/layout-tab.vue'
import NotificationsTab from './tabs/notifications-tab.vue'
import PrivateKeyTab from './tabs/private-key-tab.vue'
import BlacklistTab from './tabs/blacklist-tab.vue'
import AppPermissionsTab from './tabs/app-permissions-tab.vue'
import SystemTab from './tabs/system-tab.vue'
import ModulesTab from './tabs/modules-tab.vue'
import WhatsNewTab from './tabs/whats-new-tab.vue'
import {
  SC_SettingsWork,
  SC_SettingsPage,
  SC_SettingsContentWrapper,
  SC_SettingsSidebar,
  SC_SettingsSidebarItem,
  SC_SettingsMain,
} from './settings-page.styled'

defineOptions({ name: 'SettingsPage' })

export type T_SettingsTabKey =
  | 'general'
  | 'layout'
  | 'notifications'
  | 'system'
  | 'modules'
  | 'privateKey'
  | 'blacklist'
  | 'appPermissions'
  | 'whatsNew'

// labelKey — ключ i18n; рендерим через t(), чтобы метки реактивно следовали за локалью.
// Модули скачивает только приложение для компьютера.
const SETTINGS_TABS: { key: T_SettingsTabKey; labelKey: string }[] = [
  { key: 'general', labelKey: 'settings.tabs.general' },
  { key: 'layout', labelKey: 'settings.tabs.layout' },
  { key: 'notifications', labelKey: 'settings.tabs.notifications' },
  { key: 'system', labelKey: 'settings.tabs.system' },
  ...(isTauri() ? [{ key: 'modules' as const, labelKey: 'settings.tabs.modules' }] : []),
  { key: 'privateKey', labelKey: 'settings.tabs.privateKey' },
  { key: 'blacklist', labelKey: 'settings.tabs.blacklist' },
  { key: 'appPermissions', labelKey: 'settings.tabs.appPermissions' },
  { key: 'whatsNew', labelKey: 'settings.tabs.whatsNew' },
]

const { t } = useI18n()
// Глубокая ссылка `?tab=privateKey` (напоминание о бэкапе и т.п.).
const route = useRoute()
const router = useRouter()
// Ноды и сеть переехали из настроек в «Блокчейн-обозреватель».
if (route.query.tab === 'blockExplorer' || route.query.tab === 'diagnostics') {
  void router.replace({ name: 'explorer-network' })
}
const tabFromQuery = SETTINGS_TABS.find((tab) => tab.key === route.query.tab)?.key
const activeTab = ref<T_SettingsTabKey>(tabFromQuery ?? 'notifications')

// Подгружаем стартовые состояния (язык, фильтры) до того, как соответствующие
// табы будут открыты — иначе при первом переключении на «Уведомления» switch
// показал бы дефолтные значения вместо сохранённых.
const notificationSettings = useNotificationSettingsStore()
const uiStore = useUIStore()
onMounted(() => {
  notificationSettings.load()
  void uiStore.loadLanguage()
})
</script>
