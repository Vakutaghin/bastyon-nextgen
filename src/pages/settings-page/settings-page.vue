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
          <SC_SettingsPlaceholder>
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
