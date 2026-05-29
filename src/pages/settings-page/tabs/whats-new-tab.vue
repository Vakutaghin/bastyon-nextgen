<template>
  <SC_SettingsSectionTitle>Что нового</SC_SettingsSectionTitle>
  <ChangelogView :show-language-switcher="false" />
</template>

<script setup lang="ts">
import ChangelogView from '@/b-components/changelog/changelog-view.vue'
import { SC_SettingsSectionTitle } from '../settings-page.styled'
</script>
