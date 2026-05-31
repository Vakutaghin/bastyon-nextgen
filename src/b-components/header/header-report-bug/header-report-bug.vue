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
import { BugOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import { useMessengerStore } from '@/b-components/messenger/store'
import { SC_ReportBugWrapper } from './styled'
import { ICON_SIZE_XL } from '@/styles/icon-styles'

// TODO: заменить на реальный адрес аккаунта-приёмника багов
const BUG_REPORT_ACCOUNT_ADDRESS = ''

const { t } = useI18n()

const authStore = useAuthStore()
const messengerStore = useMessengerStore()

const isVisible = computed<boolean>(() => authStore.isUserAuthenticated)

async function onClick(): Promise<void> {
  if (!authStore.isUserAuthenticated) return
  if (!BUG_REPORT_ACCOUNT_ADDRESS) {
    console.warn('[HeaderReportBug] BUG_REPORT_ACCOUNT_ADDRESS не задан')
    return
  }
  const roomId = await messengerStore.startChatWithAddress(BUG_REPORT_ACCOUNT_ADDRESS)
  if (roomId) {
    messengerStore.switchToChatAndLoad(roomId)
    messengerStore.isFullScreen = true
  }
}
</script>
