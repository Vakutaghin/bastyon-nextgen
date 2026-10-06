<template>
  <Tooltip v-if="isVisible" :title="t('header.reportBug')" placement="bottom">
    <SC_ReportBugWrapper @click="onClick">
      <BugOutlined :style="ICON_SIZE_XL" />
    </SC_ReportBugWrapper>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'
import { BugOutlined } from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import {
  SUPPORT_ACCOUNT_NAME,
  resolveSupportAddress,
} from '@/b-components/messenger/lib/support-account'
import { SC_ReportBugWrapper } from './styled'
import { ICON_SIZE_XL } from '@/styles/icon-styles'

const { t } = useI18n()

const authStore = useAuthStore()
const messengerStore = useMessengerStore()

// Отчёт уходит в чат: с выключенным мессенджером кнопка молча ничего не делала.
const prefs = useAppPreferencesStore()
const isVisible = computed<boolean>(() => authStore.isUserAuthenticated && prefs.messengerEnabled)

async function onClick(): Promise<void> {
  if (!authStore.isUserAuthenticated) return
  const address = await resolveSupportAddress()
  if (!address) {
    console.warn(`[HeaderReportBug] аккаунт "${SUPPORT_ACCOUNT_NAME}" не найден в сети`)
    return
  }
  const roomId = await messengerStore.startChatWithAddress(address)
  if (roomId) {
    messengerStore.switchToChatAndLoad(roomId)
    messengerStore.isFullScreen = true
  }
}
</script>
