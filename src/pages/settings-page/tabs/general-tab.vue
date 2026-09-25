<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.general') }}</SC_SettingsSectionTitle>
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
      <SC_GeneralLabel>{{ t('settings.general.theme') }}</SC_GeneralLabel>
      <SC_LangSwitcher>
        <SC_LangButton
          v-for="opt in themeOptions"
          :key="opt.value"
          :active="themeMode === opt.value"
          type="button"
          @click="setTheme(opt.value)"
        >
          {{ t(opt.labelKey) }}
        </SC_LangButton>
      </SC_LangSwitcher>
    </SC_GeneralRow>
  </SC_GeneralBlock>

  <SC_SettingsSectionTitle>{{ t('settings.content.title') }}</SC_SettingsSectionTitle>
  <SC_SystemSection>
    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.embeddedVideo') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.embeddedVideoHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.embeddedVideo" @change="setFlag('embeddedVideo', $event)" />
    </SC_SystemRow>

    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.videoAutoplay') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.videoAutoplayHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.videoAutoplay" @change="setFlag('videoAutoplay', $event)" />
    </SC_SystemRow>

    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.linkPreviews') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.linkPreviewsHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.linkPreviews" @change="setFlag('linkPreviews', $event)" />
    </SC_SystemRow>

    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.commentsOrder') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.commentsOrderHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <SC_ScaleRow>
        <SC_ScaleButton
          v-for="opt in COMMENTS_ORDER_OPTIONS"
          :key="opt.value"
          :active="prefs.commentsOrder === opt.value"
          type="button"
          @click="setOrder(opt.value)"
        >
          {{ t(opt.labelKey) }}
        </SC_ScaleButton>
      </SC_ScaleRow>
    </SC_SystemRow>

    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.messenger') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.messengerHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.messengerEnabled" @change="setFlag('messengerEnabled', $event)" />
    </SC_SystemRow>
  </SC_SystemSection>

  <!-- Управление десктоп-модулем IPFS (Kubo): сам блок скрыт, если не установлен. -->
  <IpfsSection />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Switch } from 'ant-design-vue'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { useAppPreferencesStore, type AppPreferencesState } from '@/stores/app-preferences-store'
import {
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemRow,
  SC_SystemSection,
  SC_SystemTitle,
} from './system-tab.styled'
import { useTheme, type ThemeMode } from '@/composables/use-theme'
import IpfsSection from './ipfs-section.vue'
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
const themeOptions: { value: ThemeMode; labelKey: string }[] = [
  { value: 'auto', labelKey: 'settings.general.themeAuto' },
  { value: 'light', labelKey: 'settings.general.themeLight' },
  { value: 'dark', labelKey: 'settings.general.themeDark' },
]

// Настройки содержимого — те, что в старом клиенте жили в группах «посты»,
// «видео» и «интерфейс».
const prefs = useAppPreferencesStore()

const COMMENTS_ORDER_OPTIONS: {
  value: AppPreferencesState['commentsOrder']
  labelKey: string
}[] = [
  { value: 'interesting', labelKey: 'comments.sortInteresting' },
  { value: 'newest', labelKey: 'comments.sortNewest' },
  { value: 'oldest', labelKey: 'comments.sortOldest' },
]

/** Тип значения, который отдаёт ant-свитч. */
type SwitchValue = string | number | boolean

/** Настройки-тумблеры: перечислены явно, чтобы не приводить типы силой. */
type BooleanPreferenceKey = 'embeddedVideo' | 'videoAutoplay' | 'linkPreviews' | 'messengerEnabled'

function setFlag(key: BooleanPreferenceKey, checked: SwitchValue): void {
  void prefs.set(key, Boolean(checked))
}

function setOrder(value: AppPreferencesState['commentsOrder']): void {
  void prefs.set('commentsOrder', value)
}
</script>
