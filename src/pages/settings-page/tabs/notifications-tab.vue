<template>
  <SC_SettingsSectionTitle>{{ t('settings.notifications.title') }}</SC_SettingsSectionTitle>
  <SC_NotificationsList>
    <SC_NotificationsRow v-for="key in NOTIFICATION_KEYS" :key="key">
      <SC_NotificationsRowLabel>{{
        t(NOTIFICATION_FILTER_LABEL_KEYS[key])
      }}</SC_NotificationsRowLabel>
      <Switch
        :checked="notificationSettings.getFilter(key)"
        @change="(checked: boolean) => onChange(key, checked)"
      />
    </SC_NotificationsRow>
  </SC_NotificationsList>
</template>

<script setup lang="ts">
import { Switch } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useNotificationSettingsStore } from '@/stores'
import {
  NOTIFICATION_FILTER_LABEL_KEYS,
  type NotificationFilterKey,
} from '@/stores/notification-settings-store'
import { ensureBrowserNotifPermission } from '@/composables/use-browser-notifications'
import {
  SC_SettingsSectionTitle,
  SC_NotificationsList,
  SC_NotificationsRow,
  SC_NotificationsRowLabel,
} from '../settings-page.styled'

const NOTIFICATION_KEYS: NotificationFilterKey[] = [
  'sound',
  'browserNotif',
  'win',
  'transactions',
  'upvotes',
  'downvotes',
  'comments',
  'answers',
  'followers',
  'commentScore',
]

const notificationSettings = useNotificationSettingsStore()
const { t } = useI18n()

async function onChange(key: NotificationFilterKey, checked: boolean): Promise<void> {
  await notificationSettings.setFilter(key, checked)
  // При включении браузерных уведомлений — запрашиваем разрешение браузера.
  if (key === 'browserNotif' && checked) await ensureBrowserNotifPermission()
}
</script>
