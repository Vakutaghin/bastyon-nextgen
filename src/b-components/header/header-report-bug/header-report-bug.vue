<template>
  <Tooltip v-if="isVisible" :title="t('header.reportBug')" placement="bottom">
    <SC_ReportBugWrapper
      role="button"
      tabindex="0"
      :aria-label="t('header.reportBug')"
      @click="onClick"
      @keydown.enter="onClick"
    >
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
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { openSupportChat } from './open-support-chat'
import { SC_ReportBugWrapper } from './styled'
import { ICON_SIZE_XL } from '@/styles/icon-styles'

const { t } = useI18n()

const authStore = useAuthStore()

// Отчёт уходит в чат: с выключенным мессенджером кнопка молча ничего не делала.
const prefs = useAppPreferencesStore()
const isVisible = computed<boolean>(() => authStore.isUserAuthenticated && prefs.messengerEnabled)

async function onClick(): Promise<void> {
  if (!authStore.isUserAuthenticated) return
  await openSupportChat()
}
</script>
