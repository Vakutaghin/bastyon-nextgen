<template>
  <SC_SettingsWork>
    <SC_SettingsPage>
      <SC_SettingsContentWrapper>
        <SC_SettingsSidebar>
          <SC_SettingsSidebarItem
            v-for="tab in tabs"
            :key="tab.key"
            :active="activeTab === tab.key"
            type="button"
            @click="setActiveTab(tab.key)"
          >
            {{ tab.label }}
          </SC_SettingsSidebarItem>
        </SC_SettingsSidebar>

        <SC_SettingsMain>
          <template v-if="activeTab === 'notifications'">
            <SC_SettingsSectionTitle>Фильтр уведомлений</SC_SettingsSectionTitle>
            <SC_NotificationsList>
              <SC_NotificationsRow
                v-for="key in NOTIFICATION_KEYS"
                :key="key"
              >
                <SC_NotificationsRowLabel>{{ NOTIFICATION_FILTER_LABELS[key] }}</SC_NotificationsRowLabel>
                <Switch
                  :checked="notificationSettings.getFilter(key)"
                  @change="(checked) => onNotificationFilterChange(key, checked)"
                />
              </SC_NotificationsRow>
            </SC_NotificationsList>
          </template>
          <SC_SettingsPlaceholder v-else>
            {{ placeholderText() }}
          </SC_SettingsPlaceholder>
        </SC_SettingsMain>
      </SC_SettingsContentWrapper>
    </SC_SettingsPage>
  </SC_SettingsWork>
</template>

<script lang="ts">
import settingsPage from './settings-page'

export default settingsPage
</script>
