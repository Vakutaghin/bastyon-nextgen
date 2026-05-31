<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.whatsNew') }}</SC_SettingsSectionTitle>
  <ChangelogView :show-language-switcher="false" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ChangelogView from '@/b-components/changelog/changelog-view.vue'
import { SC_SettingsSectionTitle } from '../settings-page.styled'

const { t } = useI18n()
</script>
