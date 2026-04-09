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

          <template v-else-if="activeTab === 'privateKey'">
            <SC_PrivateKeySection>
              <SC_SettingsSectionTitle>Приватный ключ</SC_SettingsSectionTitle>

              <!-- Confirm dialog -->
              <template v-if="pkConfirmVisible">
                <SC_ConfirmOverlay>
                  <SC_ConfirmTitle>
                    ⚠️ Показать приватный ключ?
                  </SC_ConfirmTitle>
                  <SC_ConfirmText>
                    Передавать приватный ключ или сид-фразу кому-либо небезопасно. Любой, кто получит доступ к ним, сможет получить полный контроль над вашим аккаунтом и средствами.
                  </SC_ConfirmText>
                  <SC_ConfirmButtons>
                    <SC_ConfirmBtnDefault type="button" @click="pkCancelConfirm">Отмена</SC_ConfirmBtnDefault>
                    <SC_ConfirmBtnPrimary type="button" @click="pkConfirmAndReveal">Да, показать</SC_ConfirmBtnPrimary>
                  </SC_ConfirmButtons>
                </SC_ConfirmOverlay>
              </template>

              <!-- Revealed keys -->
              <template v-else-if="pkRevealed">
                <SC_PrivateKeyWarning>
                  ⚠️ Никогда не делитесь приватным ключом или сид-фразой. Сохраните их в безопасном месте.
                </SC_PrivateKeyWarning>

                <SC_PrivateKeyBox v-if="pkMnemonic">
                  <SC_PrivateKeyLabel>Сид-фраза</SC_PrivateKeyLabel>
                  <SC_PrivateKeyValue>{{ pkMnemonic }}</SC_PrivateKeyValue>
                  <SC_CopyIconBtn type="button" title="Копировать сид-фразу" @click="pkCopyMnemonic">
                    <CopyOutlined />
                  </SC_CopyIconBtn>
                </SC_PrivateKeyBox>

                <SC_PrivateKeyBox v-if="pkPrivateKeyHex">
                  <SC_PrivateKeyLabel>Приватный ключ (hex)</SC_PrivateKeyLabel>
                  <SC_PrivateKeyValue>{{ pkPrivateKeyHex }}</SC_PrivateKeyValue>
                  <SC_CopyIconBtn type="button" title="Копировать приватный ключ" @click="pkCopyKey">
                    <CopyOutlined />
                  </SC_CopyIconBtn>
                </SC_PrivateKeyBox>

                <SC_HideKeyButton type="button" @click="pkHide">
                  Скрыть
                </SC_HideKeyButton>
              </template>

              <!-- Initial state: show button -->
              <template v-else>
                <SC_PrivateKeyWarning>
                  Приватный ключ обеспечивает полный доступ к вашему аккаунту. Убедитесь, что рядом нет посторонних, прежде чем показывать его.
                </SC_PrivateKeyWarning>
                <SC_ShowKeyButton type="button" :disabled="pkLoading" @click="pkShowConfirm">
                  {{ pkLoading ? 'Загрузка...' : 'Показать приватный ключ' }}
                </SC_ShowKeyButton>
              </template>
            </SC_PrivateKeySection>
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
