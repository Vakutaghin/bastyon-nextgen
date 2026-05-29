<template>
  <SC_SettingsSectionTitle>Общие</SC_SettingsSectionTitle>
  <SC_GeneralBlock>
    <SC_GeneralRow>
      <SC_GeneralLabel>{{ languageLabel }}</SC_GeneralLabel>
      <SC_LangSwitcher>
        <SC_LangButton
          v-for="lang in supportedLanguages"
          :key="lang"
          :active="appLanguage === lang"
          type="button"
          @click="onSetLanguage(lang)"
        >
          {{ lang.toUpperCase() }}
        </SC_LangButton>
      </SC_LangSwitcher>
    </SC_GeneralRow>
    <SC_GeneralRow>
      <SC_GeneralLabel>Тема оформления</SC_GeneralLabel>
      <SC_LangSwitcher>
        <SC_LangButton
          v-for="opt in themeOptions"
          :key="opt.value"
          :active="themeMode === opt.value"
          type="button"
          @click="setTheme(opt.value)"
        >
          {{ opt.label }}
        </SC_LangButton>
      </SC_LangSwitcher>
    </SC_GeneralRow>
  </SC_GeneralBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { useTheme, type ThemeMode } from '@/composables/use-theme'
import {
  SC_SettingsSectionTitle,
  SC_GeneralBlock,
  SC_GeneralRow,
  SC_GeneralLabel,
  SC_LangSwitcher,
  SC_LangButton,
} from '../settings-page.styled'

const uiStore = useUIStore()
const { language: appLanguage } = storeToRefs(uiStore)
const supportedLanguages: AppLanguage[] = ['ru', 'en']

const { t } = useI18n()
// Реактивно следует за активной локалью i18n.
const languageLabel = computed(() => t('language.label'))

async function onSetLanguage(language: AppLanguage): Promise<void> {
  await uiStore.setLanguage(language)
}

const { mode: themeMode, setMode: setTheme } = useTheme()
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]
</script>
