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
          <template v-if="activeTab === 'general'">
            <SC_SettingsSectionTitle>Общие</SC_SettingsSectionTitle>
            <SC_GeneralBlock>
              <SC_GeneralRow>
                <SC_GeneralLabel>{{ languageLabel }}</SC_GeneralLabel>
                <SC_LangSwitcher>
                  <SC_LangButton
                    v-for="lang in supportedLanguages"
                    :key="lang"
                    :active="appLanguage === lang"
                    type="button"
                    @click="onSetLanguage(lang)"
                  >
                    {{ lang.toUpperCase() }}
                  </SC_LangButton>
                </SC_LangSwitcher>
              </SC_GeneralRow>
            </SC_GeneralBlock>
          </template>

          <template v-else-if="activeTab === 'whatsNew'">
            <SC_SettingsSectionTitle>Что нового</SC_SettingsSectionTitle>
            <ChangelogView :show-language-switcher="false" />
          </template>

          <template v-else-if="activeTab === 'notifications'">
            <SC_SettingsSectionTitle>Фильтр уведомлений</SC_SettingsSectionTitle>
            <SC_NotificationsList>
              <SC_NotificationsRow
                v-for="key in NOTIFICATION_KEYS"
                :key="key"
              >
                <SC_NotificationsRowLabel>{{ NOTIFICATION_FILTER_LABELS[key] }}</SC_NotificationsRowLabel>
                <Switch
                  :checked="notificationSettings.getFilter(key)"
                  @change="(checked: boolean) => onNotificationFilterChange(key, checked)"
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

          <template v-else-if="activeTab === 'blockExplorer'">
            <SC_ExplorerSettingsSection>
              <SC_SettingsSectionTitle>Блок-эксплорер</SC_SettingsSectionTitle>

              <SC_ExplorerSettingsBlock>
                <SC_ExplorerSettingsLead>
                  Встроенный блок-эксплорер работает на тех же нодах, что и остальное приложение —
                  без внешних редиректов.
                </SC_ExplorerSettingsLead>
                <RouterLink
                  v-slot="{ navigate, href }"
                  custom
                  :to="{ name: 'explorer' }"
                >
                  <SC_ExplorerOpenFullButton :href="href" @click="(e) => { e.preventDefault(); navigate() }">
                    Открыть эксплорер →
                  </SC_ExplorerOpenFullButton>
                </RouterLink>
              </SC_ExplorerSettingsBlock>

              <SC_ExplorerSettingsBlock>
                <SC_SettingsSectionTitle as="h3" style="font-size: 14px; margin: 0">
                  Предпочитаемая нода
                </SC_SettingsSectionTitle>
                <SC_ExplorerSettingsLead>
                  По умолчанию эксплорер использует автоматический round-robin по списку
                  публичных нод. Можно закрепить конкретную ноду — все запросы эксплорера
                  будут идти к ней. На остальное приложение это не влияет.
                </SC_ExplorerSettingsLead>

                <SC_ExplorerNodeList>
                  <SC_ExplorerNodeRow :active="!preferredNode">
                    <SC_ExplorerNodeRadio
                      type="radio"
                      name="explorer-node"
                      :checked="!preferredNode"
                      @change="onPickPreferredNode(null)"
                    />
                    <SC_ExplorerNodeLabel>Авто (round-robin)</SC_ExplorerNodeLabel>
                    <SC_ExplorerNodeHint>По умолчанию</SC_ExplorerNodeHint>
                  </SC_ExplorerNodeRow>

                  <SC_ExplorerNodeRow
                    v-for="node in availableExplorerNodes"
                    :key="`${node.host}:${node.port}`"
                    :active="isNodePinned(node)"
                  >
                    <SC_ExplorerNodeRadio
                      type="radio"
                      name="explorer-node"
                      :checked="isNodePinned(node)"
                      @change="onPickPreferredNode(node)"
                    />
                    <SC_ExplorerNodeLabel>{{ node.host }}:{{ node.port }}</SC_ExplorerNodeLabel>
                    <SC_ExplorerNodeHint v-if="isNodePinned(node)">Закреплена</SC_ExplorerNodeHint>
                  </SC_ExplorerNodeRow>
                </SC_ExplorerNodeList>
              </SC_ExplorerSettingsBlock>
            </SC_ExplorerSettingsSection>
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
