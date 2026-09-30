<template>
  <SC_Settings>
    <SC_SettingItem>
      <SC_Label for="composer-visibility">{{ t('postComposer.visibility') }}</SC_Label>
      <Select
        id="composer-visibility"
        :value="visibility"
        :options="visibilityOptions"
        :disabled="isTrial || disabled"
        @change="onVisibilityChange"
      />
      <SC_TrialHint v-if="isTrial">{{ t('postComposer.trialVisibilityHint') }}</SC_TrialHint>
    </SC_SettingItem>

    <SC_SettingItem>
      <SC_Label for="composer-language">{{ t('postComposer.language') }}</SC_Label>
      <Select
        id="composer-language"
        :value="language"
        :options="LANGUAGE_OPTIONS"
        :disabled="disabled"
        @change="onLanguageChange"
      />
    </SC_SettingItem>

    <SC_SettingItem>
      <SC_Label for="composer-schedule">{{ t('postComposer.schedule') }}</SC_Label>
      <DateTimePicker
        id="composer-schedule"
        :value="scheduledTime > 1 ? scheduledTime : 0"
        :future="true"
        :placeholder="t('postComposer.schedulePlaceholder')"
        :disabled="disabled"
        @change="emit('update:scheduledTime', $event)"
      />
      <SC_TrialHint v-if="scheduledTime > 1">{{ t('postComposer.scheduleHint') }}</SC_TrialHint>
    </SC_SettingItem>
  </SC_Settings>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import Select, { type SelectOption } from '@/components/select'
import { SC_Placeholder as SC_PickerLoading } from '@/components/date-time-picker/styled'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n'
import { SC_Label, SC_SettingItem, SC_Settings, SC_TrialHint } from './composer-settings.styled'

// Календарь antd с dayjs тяжёлый — отдельным чанком, когда открывают окно поста.
const DateTimePicker = defineAsyncComponent({
  loader: () => import('@/components/date-time-picker'),
  loadingComponent: SC_PickerLoading,
  delay: 0,
})

const props = defineProps<{
  visibility: string
  language: string
  isTrial: boolean
  /** У автора назначена цена платной подписки — можно публиковать для платных подписчиков. */
  paidAvailable: boolean
  scheduledTime: number
  /** Идёт публикация поста: настройки уже в нём. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:visibility', value: string): void
  (e: 'update:language', value: string): void
  (e: 'update:scheduledTime', value: number): void
}>()

const { t } = useI18n()

/** Видимость поста (settings.f): legacy kit.js. */
const VISIBILITY_OPTIONS = [
  { value: '0', labelKey: 'postComposer.visibilityAll' },
  { value: '1', labelKey: 'postComposer.visibilitySubscribers' },
  { value: '2', labelKey: 'postComposer.visibilityRegistered' },
  { value: '3', labelKey: 'postComposer.visibilityPaid' },
] as const

// «Платным подписчикам» — только при назначенной цене подписки; у правки поста,
// уже опубликованного так, пункт остаётся, чтобы видимость не сбрасывалась молча.
const visibilityOptions = computed<SelectOption[]>(() =>
  VISIBILITY_OPTIONS.filter(
    (opt) => opt.value !== '3' || props.paidAvailable || props.visibility === '3'
  ).map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))
)

/** Язык поста — те же коды, что у языка интерфейса: по ним нода собирает ленты. */
const LANGUAGE_OPTIONS: SelectOption[] = SUPPORTED_LOCALES.map((value) => ({
  value,
  label: LOCALE_NAMES[value],
}))

const onVisibilityChange = (value: unknown): void => {
  emit('update:visibility', String(value))
}
const onLanguageChange = (value: unknown): void => {
  emit('update:language', String(value))
}
</script>
