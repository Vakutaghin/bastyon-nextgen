<template>
  <SC_Settings>
    <SC_SettingItem>
      <SC_Label for="composer-visibility">{{ t('postComposer.visibility') }}</SC_Label>
      <SC_Select
        id="composer-visibility"
        :value="visibility"
        :disabled="isTrial"
        @change="onVisibilityChange"
      >
        <option v-for="opt in VISIBILITY_OPTIONS" :key="opt.value" :value="opt.value">
          {{ t(opt.labelKey) }}
        </option>
      </SC_Select>
      <SC_TrialHint v-if="isTrial">{{ t('postComposer.trialVisibilityHint') }}</SC_TrialHint>
    </SC_SettingItem>

    <SC_SettingItem>
      <SC_Label for="composer-language">{{ t('postComposer.language') }}</SC_Label>
      <SC_Select id="composer-language" :value="language" @change="onLanguageChange">
        <option v-for="lang in LANGUAGE_OPTIONS" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </SC_Select>
    </SC_SettingItem>

    <SC_SettingItem>
      <SC_Label for="composer-schedule">{{ t('postComposer.schedule') }}</SC_Label>
      <SC_DateInput
        id="composer-schedule"
        type="datetime-local"
        :min="nowLocal"
        :value="scheduledLocal"
        @change="onScheduleChange"
      />
      <SC_TrialHint v-if="scheduledTime > 1">{{ t('postComposer.scheduleHint') }}</SC_TrialHint>
    </SC_SettingItem>
  </SC_Settings>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  SC_DateInput,
  SC_Label,
  SC_Select,
  SC_SettingItem,
  SC_Settings,
  SC_TrialHint,
} from './composer-settings.styled'

const props = defineProps<{
  visibility: string
  language: string
  isTrial: boolean
  scheduledTime: number
}>()
const emit = defineEmits<{
  (e: 'update:visibility', value: string): void
  (e: 'update:language', value: string): void
  (e: 'update:scheduledTime', value: number): void
}>()

const { t } = useI18n()

/** unix-секунды → строка для datetime-local (локальное время). */
function unixToLocalInput(unix: number): string {
  if (!unix || unix <= 1) return ''
  const d = new Date(unix * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const scheduledLocal = computed(() => unixToLocalInput(props.scheduledTime))
const nowLocal = computed(() => unixToLocalInput(Math.floor(Date.now() / 1000)))

const onScheduleChange = (e: Event): void => {
  const value = (e.target as HTMLInputElement).value
  const unix = value ? Math.floor(new Date(value).getTime() / 1000) : 0
  emit('update:scheduledTime', Number.isFinite(unix) ? unix : 0)
}

/** Видимость поста (settings.f): legacy kit.js. */
const VISIBILITY_OPTIONS = [
  { value: '0', labelKey: 'postComposer.visibilityAll' },
  { value: '1', labelKey: 'postComposer.visibilitySubscribers' },
  { value: '2', labelKey: 'postComposer.visibilityRegistered' },
  { value: '3', labelKey: 'postComposer.visibilityPaid' },
] as const

const LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const

const onVisibilityChange = (e: Event): void => {
  emit('update:visibility', (e.target as HTMLSelectElement).value)
}
const onLanguageChange = (e: Event): void => {
  emit('update:language', (e.target as HTMLSelectElement).value)
}
</script>
