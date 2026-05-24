import { defineComponent, ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { Switch } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { useNotificationSettingsStore, useAuthStore } from '@/stores'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
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

export const SETTINGS_TABS: { key: T_SettingsTabKey; label: string }[] = [
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

export default defineComponent({
  name: 'SettingsPage',
  components: {
    RouterLink,
    Switch,
    CopyOutlined,
    ChangelogView,
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
  },
  setup() {
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
    const languageLabel = computed(() => (appLanguage.value === 'ru' ? 'Язык' : 'Language'))
    return {
      tabs: SETTINGS_TABS,
      activeTab,
      notificationSettings,
      authStore,
      NOTIFICATION_FILTER_LABELS,
      NOTIFICATION_KEYS,
      preferredNode,
      availableExplorerNodes,
      setPreferredNode,
      appLanguage,
      onSetLanguage,
      supportedLanguages,
      languageLabel,
    }
  },

  data() {
    return {
      // Private key section state
      pkConfirmVisible: false,
      pkMnemonic: '',
      pkPrivateKeyHex: '',
      pkRevealed: false,
      pkLoading: false,
    }
  },

  methods: {
    setActiveTab(key: T_SettingsTabKey) {
      this.activeTab = key
      // Hide key when switching tabs
      if (key !== 'privateKey') {
        this.pkHide()
      }
    },

    isNodePinned(node: AvailableNode): boolean {
      const p = this.preferredNode as PreferredNode | null
      return !!p && p.host === node.host && p.port === node.port
    },

    onPickPreferredNode(node: AvailableNode | null) {
      this.setPreferredNode(node ? { host: node.host, port: node.port } : null)
      appToast.success({
        message: node ? `Закреплена нода ${node.host}` : 'Включён авто-режим',
      })
    },

    placeholderText(): string {
      const item = SETTINGS_TABS.find((t) => t.key === this.activeTab)
      return item ? `Раздел «${item.label}» — контент будет добавлен позже.` : ''
    },

    async onNotificationFilterChange(key: NotificationFilterKey, checked: boolean) {
      await this.notificationSettings.setFilter(key, checked)
    },

    // ── Private key methods ──

    pkShowConfirm() {
      this.pkConfirmVisible = true
    },

    pkCancelConfirm() {
      this.pkConfirmVisible = false
    },

    async pkConfirmAndReveal() {
      this.pkConfirmVisible = false
      this.pkLoading = true

      try {
        const address = this.authStore.getUserAddress
        if (!address) {
          throw new Error('Нет активного аккаунта')
        }

        const { loadEncryptedData, loadEncryptedMnemonic } = await import('@/blockchain/storage')

        const mnemonicResult = loadEncryptedData({
          persistent: true,
          storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
        })

        const rawData = mnemonicResult.success && mnemonicResult.data
          ? mnemonicResult.data
          : (() => {
              const generalResult = loadEncryptedMnemonic()
              if (generalResult.success && generalResult.data) return generalResult.data
              return null
            })()

        if (!rawData || !rawData.trim()) {
          throw new Error('Нет сохранённой сид-фразы или ключа для этого аккаунта')
        }

        const format = detectPrivateKeyFormat(rawData.trim())
        if (format === 'mnemonic') {
          this.pkMnemonic = rawData.trim()
          // Derive hex from mnemonic
          try {
            const { keyPair } = recoverKeyPair(rawData.trim())
            this.pkPrivateKeyHex = keyPair?.privateKey
              ? (Buffer.isBuffer(keyPair.privateKey) ? keyPair.privateKey.toString('hex') : String(keyPair.privateKey))
              : ''
          } catch {
            this.pkPrivateKeyHex = ''
          }
        } else if (format === 'hex') {
          this.pkMnemonic = ''
          this.pkPrivateKeyHex = rawData.trim()
        } else if (format === 'wif') {
          try {
            const { keyPair } = recoverKeyPair(rawData.trim())
            this.pkMnemonic = ''
            this.pkPrivateKeyHex = keyPair?.privateKey
              ? (Buffer.isBuffer(keyPair.privateKey) ? keyPair.privateKey.toString('hex') : String(keyPair.privateKey))
              : ''
          } catch {
            throw new Error('Не удалось прочитать ключ')
          }
        } else {
          throw new Error('Неизвестный формат данных')
        }

        this.pkRevealed = true
      } catch (error) {
        console.error('Failed to load private key:', error)
        appToast.error({ message: error instanceof Error ? error.message : 'Не удалось загрузить ключ' })
      } finally {
        this.pkLoading = false
      }
    },

    pkHide() {
      this.pkRevealed = false
      this.pkMnemonic = ''
      this.pkPrivateKeyHex = ''
      this.pkConfirmVisible = false
    },

    async pkCopyMnemonic() {
      if (!this.pkMnemonic) return
      const ok = await this.pkCopyToClipboard(this.pkMnemonic)
      if (ok) appToast.success({ message: 'Сид-фраза скопирована' })
    },

    async pkCopyKey() {
      if (!this.pkPrivateKeyHex) return
      const ok = await this.pkCopyToClipboard(this.pkPrivateKeyHex)
      if (ok) appToast.success({ message: 'Приватный ключ скопирован' })
    },

    async pkCopyToClipboard(text: string): Promise<boolean> {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
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
    },
  },
})
