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
          :title="LOCALE_NAMES[lang]"
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
    <!-- Ширина — только на компьютере: на телефоне и планшете страница и так во всю ширину. -->
    <SC_GeneralRow v-if="!mobile" data-testid="page-width-setting">
      <SC_GeneralText>
        <SC_GeneralLabel>{{ t('settings.general.pageWidth') }}</SC_GeneralLabel>
        <SC_GeneralHint>{{ t('settings.general.pageWidthHint') }}</SC_GeneralHint>
      </SC_GeneralText>
      <SC_LangSwitcher>
        <SC_LangButton
          v-for="opt in pageWidthOptions"
          :key="opt.value"
          :active="pageWidth === opt.value"
          type="button"
          @click="setPageWidth(opt.value)"
        >
          {{ t(opt.labelKey) }}
        </SC_LangButton>
      </SC_LangSwitcher>
    </SC_GeneralRow>
    <SC_GeneralRow v-if="!mobile">
      <SC_GeneralText>
        <SC_GeneralLabel>{{ t('settings.general.pageWidthButton') }}</SC_GeneralLabel>
        <SC_GeneralHint>{{ t('settings.general.pageWidthButtonHint') }}</SC_GeneralHint>
      </SC_GeneralText>
      <Switch
        :checked="widthButtonShown"
        :aria-label="t('settings.general.pageWidthButton')"
        @change="onWidthButton"
      />
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

    <!-- Круглая кнопка чата есть только на компьютере: на телефоне чаты — в нижней панели. -->
    <SC_SystemRow v-if="!mobile">
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.content.chatButton') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.content.chatButtonHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch
        :checked="prefs.chatButton"
        :aria-label="t('settings.content.chatButton')"
        @change="setFlag('chatButton', $event)"
      />
    </SC_SystemRow>
  </SC_SystemSection>
  <!-- Скачиваемые модули (IPFS, Tor, голосовой ввод, сжатие видео, mesh) — на
       вкладке «Модули». -->
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Switch } from 'ant-design-vue'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n'
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
import { usePageWidth, type PageWidth } from '@/composables/use-page-width'
import { useViewport } from '@/composables/use-viewport'
import { useHeaderLayoutStore } from '@/stores/header-layout-store'
import {
  SC_SettingsSectionTitle,
  SC_GeneralBlock,
  SC_GeneralRow,
  SC_GeneralHint,
  SC_GeneralLabel,
  SC_GeneralText,
  SC_LangSwitcher,
  SC_LangButton,
} from '../settings-page.styled'

const uiStore = useUIStore()
const { language: appLanguage } = storeToRefs(uiStore)
const supportedLanguages: readonly AppLanguage[] = SUPPORTED_LOCALES

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

// Ширина страницы и кнопка для неё в шапке. Кнопка — пункт раскладки шапки:
// тот же, что в «Шапке и меню».
const { width: pageWidth, setWidth: setPageWidth } = usePageWidth()
const { isMobileOrTablet: mobile } = useViewport()
const pageWidthOptions: { value: PageWidth; labelKey: string }[] = [
  { value: 'limited', labelKey: 'settings.general.pageWidthLimited' },
  { value: 'full', labelKey: 'settings.general.pageWidthFull' },
]
const headerLayout = useHeaderLayoutStore()
void headerLayout.ensureLoaded()
const widthButtonShown = computed(
  () => headerLayout.headerLayout.find((e) => e.id === 'pageWidth')?.visible ?? true
)

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
type BooleanPreferenceKey = 'embeddedVideo' | 'videoAutoplay' | 'linkPreviews' | 'chatButton'

function setFlag(key: BooleanPreferenceKey, checked: SwitchValue): void {
  void prefs.set(key, Boolean(checked))
}

function onWidthButton(checked: SwitchValue): void {
  void headerLayout.setVisible('header', 'pageWidth', Boolean(checked))
}

function setOrder(value: AppPreferencesState['commentsOrder']): void {
  void prefs.set('commentsOrder', value)
}
</script>
