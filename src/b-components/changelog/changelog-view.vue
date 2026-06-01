<template>
  <div>
    <SC_LangSwitcher v-if='showLanguageSwitcher'>
      <SC_LangButton
        v-for='lang in supportedLanguages'
        :key='lang'
        :active='language === lang'
        type='button'
        @click='onSetLanguage(lang)'
      >
        {{ lang.toUpperCase() }}
      </SC_LangButton>
    </SC_LangSwitcher>

    <SC_Empty v-if='!entries.length'>
      {{ t('changelog.empty') }}
    </SC_Empty>

    <SC_ChangelogList v-else>
      <SC_ChangelogEntry
        v-for='entry in entries'
        :key='entry.version'
      >
        <SC_EntryHeader>
          <SC_VersionLabel>{{ entry.displayVersion }}</SC_VersionLabel>
        </SC_EntryHeader>
        <SC_MarkdownBody>
          <div v-html='entry.html' />
        </SC_MarkdownBody>
      </SC_ChangelogEntry>
    </SC_ChangelogList>
  </div>
</template>

<script setup lang='ts'>
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useChangelog } from '@/composables/use-changelog'
import { useUIStore, type AppLanguage } from '@/stores/ui-store'
import { SUPPORTED_LANGUAGES } from '@/helpers/changelog/changelog-loader'
import {
  SC_ChangelogList,
  SC_ChangelogEntry,
  SC_VersionLabel,
  SC_MarkdownBody,
  SC_LangSwitcher,
  SC_LangButton,
  SC_EntryHeader,
  SC_Empty,
} from './styled'

withDefaults(
  defineProps<{
    showLanguageSwitcher?: boolean
  }>(),
  { showLanguageSwitcher: true }
)

const { t } = useI18n()
const uiStore = useUIStore()
const { language } = storeToRefs(uiStore)
const { entries } = useChangelog()

const supportedLanguages = SUPPORTED_LANGUAGES

async function onSetLanguage(lang: AppLanguage): Promise<void> {
  await uiStore.setLanguage(lang)
}
</script>
