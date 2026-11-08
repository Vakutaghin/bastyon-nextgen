<template>
  <!-- Шестерёнка в шапке списка чатов — «Настройки → Чаты». -->
  <SC_SearchToggle
    type="button"
    data-testid="chat-settings"
    :aria-label="t('messenger.chatSettings')"
    :title="t('messenger.chatSettings')"
    @click="openChatSettings()"
  >
    <SettingOutlined />
  </SC_SearchToggle>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SettingOutlined } from '@/components/icons'
import { useOpenChatSettings } from './use-open-chat-settings'
import { SC_SearchToggle } from './styled'

const { t } = useI18n()
const openChatSettings = useOpenChatSettings()
</script>
