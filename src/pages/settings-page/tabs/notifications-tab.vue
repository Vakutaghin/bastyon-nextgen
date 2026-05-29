<template>
  <SC_SettingsSectionTitle>Фильтр уведомлений</SC_SettingsSectionTitle>
  <SC_NotificationsList>
    <SC_NotificationsRow v-for="key in NOTIFICATION_KEYS" :key="key">
      <SC_NotificationsRowLabel>{{ NOTIFICATION_FILTER_LABELS[key] }}</SC_NotificationsRowLabel>
      <Switch
        :checked="notificationSettings.getFilter(key)"
        @change="(checked: boolean) => onChange(key, checked)"
      />
    </SC_NotificationsRow>
  </SC_NotificationsList>
</template>

<script setup lang="ts">
import { Switch } from 'ant-design-vue'
import { useNotificationSettingsStore } from '@/stores'
import {
  NOTIFICATION_FILTER_LABELS,
  type NotificationFilterKey,
} from '@/stores/notification-settings-store'
import {
  SC_SettingsSectionTitle,
  SC_NotificationsList,
  SC_NotificationsRow,
  SC_NotificationsRowLabel,
} from '../settings-page.styled'

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

const notificationSettings = useNotificationSettingsStore()

async function onChange(key: NotificationFilterKey, checked: boolean): Promise<void> {
  await notificationSettings.setFilter(key, checked)
}
</script>
