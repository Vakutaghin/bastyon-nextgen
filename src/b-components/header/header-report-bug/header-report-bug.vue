<template>
  <Tooltip v-if="isVisible" :title="t('header.reportBug')" placement="bottom">
    <SC_ReportBugWrapper
      role="button"
      tabindex="0"
      :aria-label="t('header.reportBug')"
      v-key-activate
      @click="onClick"
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
import { openSupportChat } from './open-support-chat'
import { SC_ReportBugWrapper } from './styled'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import { vKeyActivate } from '@/helpers/a11y/key-activate'

const { t } = useI18n()

const authStore = useAuthStore()

// Отчёт уходит в чат поддержки: без входа его некуда отправить.
const isVisible = computed<boolean>(() => authStore.isUserAuthenticated)

async function onClick(): Promise<void> {
  if (!authStore.isUserAuthenticated) return
  await openSupportChat()
}
</script>
