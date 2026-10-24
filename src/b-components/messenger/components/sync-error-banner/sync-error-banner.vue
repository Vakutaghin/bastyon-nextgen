<template>
  <!-- Причина и техническая подпись: на телефоне консоли не видно, а с
       подписью поддержке есть с чем разбираться. -->
  <SC_SyncErrorBanner v-if="store.syncError" role="alert" data-testid="sync-error">
    <SC_SyncErrorText>
      {{ store.syncError }}
      <SC_SyncErrorDetail v-if="store.syncErrorDetail">{{
        store.syncErrorDetail
      }}</SC_SyncErrorDetail>
    </SC_SyncErrorText>
    <SC_SyncRetryButton type="button" @click="store.retrySync">{{
      t('appMsg.messenger.syncRetry')
    }}</SC_SyncRetryButton>
  </SC_SyncErrorBanner>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMessengerStore } from '../../store'
import {
  SC_SyncErrorBanner,
  SC_SyncErrorDetail,
  SC_SyncErrorText,
  SC_SyncRetryButton,
} from './styled'

const { t } = useI18n()
const store = useMessengerStore()
</script>
