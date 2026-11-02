<template>
  <SC_PeriodBar>
    <SC_Segmented role="group" :aria-label="t('explorerStats.periodLabel')">
      <SC_SegmentButton
        v-for="p in PERIOD_PRESETS"
        :key="p"
        type="button"
        :class="{ active: period.preset.value === p }"
        :aria-pressed="period.preset.value === p"
        @click="period.selectPreset(p)"
      >
        {{ t(`explorerStats.presets.${p}`) }}
      </SC_SegmentButton>
      <SC_SegmentButton
        type="button"
        :class="{ active: period.preset.value === 'custom' || customOpen }"
        :aria-pressed="period.preset.value === 'custom'"
        :aria-expanded="customOpen"
        @click="customOpen = !customOpen"
      >
        {{ t('explorerStats.presets.custom') }}
      </SC_SegmentButton>
    </SC_Segmented>

    <SC_Segmented
      v-if="period.granularities.value.length > 1"
      role="group"
      :aria-label="t('explorerStats.stepLabel')"
    >
      <SC_SegmentButton
        v-for="g in period.granularities.value"
        :key="g"
        type="button"
        :class="{ active: period.granularity.value === g }"
        :aria-pressed="period.granularity.value === g"
        @click="period.selectGranularity(g)"
      >
        {{ t(`explorerStats.steps.${g}`) }}
      </SC_SegmentButton>
    </SC_Segmented>

    <SC_CustomRange v-if="customOpen && pickerLocale">
      <span>{{ t('explorerStats.from') }}</span>
      <DatePicker
        :value="fromValue"
        :locale="pickerLocale"
        :format="formatDay"
        :disabled-date="disabledFrom"
        :allow-clear="false"
        :input-read-only="true"
        :show-today="false"
        :get-popup-container="popupContainer"
        popup-class-name="ui-picker-dropdown"
        @change="(v: Dayjs | string | null) => pick('from', v)"
      />
      <span>{{ t('explorerStats.to') }}</span>
      <DatePicker
        :value="toValue"
        :locale="pickerLocale"
        :format="formatDay"
        :disabled-date="disabledTo"
        :allow-clear="false"
        :input-read-only="true"
        :get-popup-container="popupContainer"
        popup-class-name="ui-picker-dropdown"
        @change="(v: Dayjs | string | null) => pick('to', v)"
      />
    </SC_CustomRange>
  </SC_PeriodBar>
</template>

<script setup lang="ts">
// Период статистики: готовые отрезки, свой диапазон двумя календарями (один
// двойной на телефоне не помещается) и шаг графика — только осмысленные для
// периода. Выбор общий для «Обзора» и «Статистики» (use-stats-period).
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DatePicker } from 'ant-design-vue'
import type { PickerLocale } from 'ant-design-vue/es/date-picker/generatePicker'
import dayjs, { type Dayjs } from 'dayjs'
import { popupContainer } from '@/components/popup-container'
import { loadPickerLocale } from '@/components/date-time-picker/picker-locale'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, bcp47, type Locale } from '@/i18n'
import { GENESIS_MS, PERIOD_PRESETS } from '../../stats/stats-period'
import { useStatsPeriod } from '../../stats/use-stats-period'
import {
  SC_PeriodBar,
  SC_Segmented,
  SC_SegmentButton,
  SC_CustomRange,
} from './stats-period-bar.styled'

defineOptions({ name: 'StatsPeriodBar' })

const { t, locale } = useI18n()
const period = useStatsPeriod()
period.refreshNow()

const customOpen = ref(period.preset.value === 'custom')

const language = computed<Locale>(() =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale.value)
    ? (locale.value as Locale)
    : DEFAULT_LOCALE
)
const pickerLocale = shallowRef<PickerLocale | null>(null)
watch(
  [language, customOpen],
  async ([lang, open]) => {
    if (!open) return
    try {
      const loaded = await loadPickerLocale(lang)
      if (lang === language.value) pickerLocale.value = loaded
    } catch {
      if (!pickerLocale.value) pickerLocale.value = await loadPickerLocale('en')
    }
  },
  { immediate: true }
)

const fromValue = computed(() => dayjs(period.range.value.from))
const toValue = computed(() => dayjs(Math.max(period.range.value.from, period.range.value.to - 1)))

const formatDay = (value: Dayjs): string =>
  new Intl.DateTimeFormat(bcp47(language.value), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value.toDate())

const disabledFrom = (day: Dayjs): boolean =>
  day.isBefore(dayjs(GENESIS_MS), 'day') || day.isAfter(toValue.value, 'day')
const disabledTo = (day: Dayjs): boolean =>
  day.isBefore(fromValue.value, 'day') || day.isAfter(dayjs(), 'day')

function pick(edge: 'from' | 'to', value: Dayjs | string | null): void {
  if (!value) return
  const day = dayjs(value).valueOf()
  if (edge === 'from') period.selectCustom(day, toValue.value.valueOf())
  else period.selectCustom(fromValue.value.valueOf(), day)
}
</script>
