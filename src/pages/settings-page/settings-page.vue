<template>
  <SC_SettingsWork>
    <SC_SettingsPage>
      <h1 class="visually-hidden">Настройки</h1>
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
              <SC_GeneralRow>
                <SC_GeneralLabel>Тема оформления</SC_GeneralLabel>
                <SC_LangSwitcher>
                  <SC_LangButton
                    v-for="opt in themeOptions"
                    :key="opt.value"
                    :active="themeMode === opt.value"
                    type="button"
                    @click="setTheme(opt.value)"
                  >
                    {{ opt.label }}
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
              <SC_NotificationsRow v-for="key in NOTIFICATION_KEYS" :key="key">
                <SC_NotificationsRowLabel>{{
                  NOTIFICATION_FILTER_LABELS[key]
                }}</SC_NotificationsRowLabel>
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
                  <SC_ConfirmTitle> ⚠️ Показать приватный ключ? </SC_ConfirmTitle>
                  <SC_ConfirmText>
                    Передавать приватный ключ или сид-фразу кому-либо небезопасно. Любой, кто
                    получит доступ к ним, сможет получить полный контроль над вашим аккаунтом и
                    средствами.
                  </SC_ConfirmText>
                  <SC_ConfirmButtons>
                    <SC_ConfirmBtnDefault type="button" @click="pkCancelConfirm"
                      >Отмена</SC_ConfirmBtnDefault
                    >
                    <SC_ConfirmBtnPrimary type="button" @click="pkConfirmAndReveal"
                      >Да, показать</SC_ConfirmBtnPrimary
                    >
                  </SC_ConfirmButtons>
                </SC_ConfirmOverlay>
              </template>

              <!-- Revealed keys -->
              <template v-else-if="pkRevealed">
                <SC_PrivateKeyWarning>
                  ⚠️ Никогда не делитесь приватным ключом или сид-фразой. Сохраните их в безопасном
                  месте.
                </SC_PrivateKeyWarning>

                <SC_PrivateKeyBox v-if="pkMnemonic">
                  <SC_PrivateKeyLabel>Сид-фраза</SC_PrivateKeyLabel>
                  <SC_PrivateKeyValue>{{ pkMnemonic }}</SC_PrivateKeyValue>
                  <SC_CopyIconBtn
                    type="button"
                    title="Копировать сид-фразу"
                    @click="pkCopyMnemonic"
                  >
                    <CopyOutlined />
                  </SC_CopyIconBtn>
                </SC_PrivateKeyBox>

                <SC_PrivateKeyBox v-if="pkPrivateKeyHex">
                  <SC_PrivateKeyLabel>Приватный ключ (hex)</SC_PrivateKeyLabel>
                  <SC_PrivateKeyValue>{{ pkPrivateKeyHex }}</SC_PrivateKeyValue>
                  <SC_CopyIconBtn
                    type="button"
                    title="Копировать приватный ключ"
                    @click="pkCopyKey"
                  >
                    <CopyOutlined />
                  </SC_CopyIconBtn>
                </SC_PrivateKeyBox>

                <SC_HideKeyButton type="button" @click="pkHide"> Скрыть </SC_HideKeyButton>
              </template>

              <!-- Initial state: show button -->
              <template v-else>
                <SC_PrivateKeyWarning>
                  Приватный ключ обеспечивает полный доступ к вашему аккаунту. Убедитесь, что рядом
                  нет посторонних, прежде чем показывать его.
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
                <RouterLink v-slot="{ navigate, href }" custom :to="{ name: 'explorer' }">
                  <SC_ExplorerOpenFullButton
                    :href="href"
                    @click="
                      (e) => {
                        e.preventDefault()
                        navigate()
                      }
                    "
                  >
                    Открыть эксплорер →
                  </SC_ExplorerOpenFullButton>
                </RouterLink>
              </SC_ExplorerSettingsBlock>

              <SC_ExplorerSettingsBlock>
                <SC_SettingsSectionTitle as="h3" style="font-size: 14px; margin: 0">
                  Предпочитаемая нода
                </SC_SettingsSectionTitle>
                <SC_ExplorerSettingsLead>
                  По умолчанию эксплорер использует автоматический round-robin по списку публичных
                  нод. Можно закрепить конкретную ноду — все запросы эксплорера будут идти к ней. На
                  остальное приложение это не влияет.
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

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { Switch } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { useNotificationSettingsStore, useAuthStore } from '@/stores'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { useTheme, type ThemeMode } from '@/composables/use-theme'
import ChangelogView from '@/b-components/changelog/changelog-view.vue'
import type { NotificationFilterKey } from '@/stores/notification-settings-store'
import { NOTIFICATION_FILTER_LABELS } from '@/stores/notification-settings-store'
import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { detectPrivateKeyFormat, recoverKeyPair } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import {
  useExplorerPreferredNode,
  type AvailableNode,
  type PreferredNode,
} from '@/composables/use-explorer-preferred-node'
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
  SC_PrivateKeySection,
  SC_PrivateKeyWarning,
  SC_PrivateKeyBox,
  SC_PrivateKeyLabel,
  SC_PrivateKeyValue,
  SC_CopyIconBtn,
  SC_ShowKeyButton,
  SC_HideKeyButton,
  SC_ConfirmOverlay,
  SC_ConfirmTitle,
  SC_ConfirmText,
  SC_ConfirmButtons,
  SC_ConfirmBtnPrimary,
  SC_ConfirmBtnDefault,
  SC_ExplorerSettingsSection,
  SC_ExplorerSettingsBlock,
  SC_ExplorerSettingsLead,
  SC_ExplorerOpenFullButton,
  SC_ExplorerNodeList,
  SC_ExplorerNodeRow,
  SC_ExplorerNodeRadio,
  SC_ExplorerNodeLabel,
  SC_ExplorerNodeHint,
  SC_GeneralBlock,
  SC_GeneralRow,
  SC_GeneralLabel,
  SC_LangSwitcher,
  SC_LangButton,
} from './settings-page.styled'

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

const activeTab = ref<T_SettingsTabKey>('notifications')
const notificationSettings = useNotificationSettingsStore()
const authStore = useAuthStore()
const uiStore = useUIStore()
const { language: appLanguage } = storeToRefs(uiStore)
const {
  preferredNode,
  availableNodes: availableExplorerNodes,
  setPreferredNode,
} = useExplorerPreferredNode()

onMounted(() => {
  notificationSettings.load()
  void uiStore.loadLanguage()
})

async function onSetLanguage(language: AppLanguage): Promise<void> {
  await uiStore.setLanguage(language)
}

const supportedLanguages: AppLanguage[] = ['ru', 'en']
const { t } = useI18n()
// Реактивно следует за активной локалью i18n.
const languageLabel = computed(() => t('language.label'))

const { mode: themeMode, setMode: setTheme } = useTheme()
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

const tabs = SETTINGS_TABS

// Private key section state
const pkConfirmVisible = ref(false)
const pkMnemonic = ref('')
const pkPrivateKeyHex = ref('')
const pkRevealed = ref(false)
const pkLoading = ref(false)

function setActiveTab(key: T_SettingsTabKey): void {
  activeTab.value = key
  // При переключении вкладок прячем ранее открытый ключ.
  if (key !== 'privateKey') pkHide()
}

function isNodePinned(node: AvailableNode): boolean {
  const p = preferredNode.value as PreferredNode | null
  return !!p && p.host === node.host && p.port === node.port
}

function onPickPreferredNode(node: AvailableNode | null): void {
  setPreferredNode(node ? { host: node.host, port: node.port } : null)
  appToast.success({
    message: node ? `Закреплена нода ${node.host}` : 'Включён авто-режим',
  })
}

function placeholderText(): string {
  const item = SETTINGS_TABS.find((tab) => tab.key === activeTab.value)
  return item ? `Раздел «${item.label}» — контент будет добавлен позже.` : ''
}

async function onNotificationFilterChange(
  key: NotificationFilterKey,
  checked: boolean
): Promise<void> {
  await notificationSettings.setFilter(key, checked)
}

// ── Private key methods ──

function pkShowConfirm(): void {
  pkConfirmVisible.value = true
}

function pkCancelConfirm(): void {
  pkConfirmVisible.value = false
}

async function pkConfirmAndReveal(): Promise<void> {
  pkConfirmVisible.value = false
  pkLoading.value = true

  try {
    const address = authStore.getUserAddress
    if (!address) throw new Error('Нет активного аккаунта')

    const { loadEncryptedData, loadEncryptedMnemonic } = await import('@/blockchain/storage')

    const mnemonicResult = loadEncryptedData({
      persistent: true,
      storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
    })

    const rawData =
      mnemonicResult.success && mnemonicResult.data
        ? mnemonicResult.data
        : (() => {
            const generalResult = loadEncryptedMnemonic()
            if (generalResult.success && generalResult.data) return generalResult.data
            return null
          })()

    if (!rawData || !rawData.trim()) {
      throw new Error('Нет сохранённой сид-фразы или ключа для этого аккаунта')
    }

    const trimmed = rawData.trim()
    const format = detectPrivateKeyFormat(trimmed)
    if (format === 'mnemonic') {
      pkMnemonic.value = trimmed
      // Derive hex из мнемоники, чтобы пользователь видел оба формата.
      try {
        const { keyPair } = recoverKeyPair(trimmed)
        pkPrivateKeyHex.value = keyPair?.privateKey
          ? Buffer.isBuffer(keyPair.privateKey)
            ? keyPair.privateKey.toString('hex')
            : String(keyPair.privateKey)
          : ''
      } catch {
        pkPrivateKeyHex.value = ''
      }
    } else if (format === 'hex') {
      pkMnemonic.value = ''
      pkPrivateKeyHex.value = trimmed
    } else if (format === 'wif') {
      try {
        const { keyPair } = recoverKeyPair(trimmed)
        pkMnemonic.value = ''
        pkPrivateKeyHex.value = keyPair?.privateKey
          ? Buffer.isBuffer(keyPair.privateKey)
            ? keyPair.privateKey.toString('hex')
            : String(keyPair.privateKey)
          : ''
      } catch {
        throw new Error('Не удалось прочитать ключ')
      }
    } else {
      throw new Error('Неизвестный формат данных')
    }

    pkRevealed.value = true
  } catch (error) {
    console.error('Failed to load private key:', error)
    appToast.error({
      message: error instanceof Error ? error.message : 'Не удалось загрузить ключ',
    })
  } finally {
    pkLoading.value = false
  }
}

function pkHide(): void {
  pkRevealed.value = false
  pkMnemonic.value = ''
  pkPrivateKeyHex.value = ''
  pkConfirmVisible.value = false
}

async function pkCopyMnemonic(): Promise<void> {
  if (!pkMnemonic.value) return
  if (await pkCopyToClipboard(pkMnemonic.value)) {
    appToast.success({ message: 'Сид-фраза скопирована' })
  }
}

async function pkCopyKey(): Promise<void> {
  if (!pkPrivateKeyHex.value) return
  if (await pkCopyToClipboard(pkPrivateKeyHex.value)) {
    appToast.success({ message: 'Приватный ключ скопирован' })
  }
}

async function pkCopyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback для контекстов без Clipboard API (старые WebView, file://).
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch (err) {
      console.error('Failed to copy:', err)
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}
</script>
