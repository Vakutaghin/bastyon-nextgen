<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.whatsNew') }}</SC_SettingsSectionTitle>
  <SC_AppVersion>
    <SC_AppVersionText>
      {{ t('settings.about.version', { version: appVersion }) }}
      <small>{{ platformLabel }} · {{ updateStatus }}</small>
    </SC_AppVersionText>
    <SC_UpdateButton type="button" :disabled="checking" @click="void check()">
      {{ t('update.checkNow') }}
    </SC_UpdateButton>
  </SC_AppVersion>
  <ChangelogView :show-language-switcher="false" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChangelogView from '@/b-components/changelog/changelog-view.vue'
import { isCapacitor, isTauri } from '@/b-components/video-uploader/utils/environment'
import { useAppUpdate } from '@/composables/use-app-update'
import { SC_SettingsSectionTitle } from '../settings-page.styled'
import { SC_AppVersion, SC_AppVersionText, SC_UpdateButton } from './whats-new-tab.styled'

declare const __APP_VERSION__: string

const { t } = useI18n()

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const platformLabel = computed(() =>
  t(
    isTauri()
      ? 'settings.about.desktop'
      : isCapacitor()
        ? 'settings.about.mobile'
        : 'settings.about.browser'
  )
)

// Состояние общее с окном обновления: найденная версия сразу предлагается.
const { available, checking, failed, checked, check } = useAppUpdate()

const updateStatus = computed(() => {
  if (checking.value) return t('update.checking')
  if (failed.value) return t('update.failed')
  if (available.value) return t('update.newVersion', { version: available.value.tag })
  if (checked.value) return t('update.upToDate')
  return t('settings.about.notChecked')
})
</script>
