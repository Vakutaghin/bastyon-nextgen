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

    <SC_CustomRange v-if="customOpen">
      <span aria-hidden="true">{{ t('explorerStats.from') }}</span>
      <DateTimePicker
        :value="fromSec"
        :show-time="false"
        :allow-clear="false"
        :show-today="false"
        :min="GENESIS_SEC"
        :max="toSec"
        size="middle"
        :aria-label="t('explorerStats.from')"
        @change="(v: number) => pick('from', v)"
      />
      <span aria-hidden="true">{{ t('explorerStats.to') }}</span>
      <DateTimePicker
        :value="toSec"
        :show-time="false"
        :allow-clear="false"
        :min="fromSec"
        :max="nowSec"
        size="middle"
        :aria-label="t('explorerStats.to')"
        @change="(v: number) => pick('to', v)"
      />
    </SC_CustomRange>

    <!-- Своя строка постоянной высоты: «Загружено x из y», дата и ошибки
         сменяют друг друга, не сдвигая графики и таблицы под панелью. -->
    <SC_SyncStatus role="status" aria-live="polite" :title="t('explorerStats.syncHint')">
      <template v-if="sync.progress.value">
        {{
          t('explorerStats.progress', {
            done: sync.progress.value.done,
            total: sync.progress.value.total,
          })
        }}
      </template>
      <template v-else-if="sync.failed.value">
        <span>{{ t('explorerStats.partsFailed', { n: sync.failed.value }) }}</span>
        <SC_SyncButton type="button" @click="sync.refresh">
          {{ t('explorerStats.retry') }}
        </SC_SyncButton>
      </template>
      <template v-else-if="sync.syncedAt.value">
        <span>{{ t('explorerStats.syncedAt', { date: syncedLabel }) }}</span>
        <SC_SyncButton type="button" @click="sync.refresh">
          {{ t('explorerStats.refresh') }}
        </SC_SyncButton>
      </template>
    </SC_SyncStatus>
  </SC_PeriodBar>
</template>

<script setup lang="ts">
// Период статистики: готовые отрезки, свой диапазон двумя календарями (один
// двойной на телефоне не помещается) и шаг графика — только осмысленные для
// периода. Выбор общий для «Обзора» и «Статистики» (use-stats-period). Под
// ним — состояние истории на устройстве (stats-sync) с «Обновить».
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DateTimePicker from '@/components/date-time-picker'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, bcp47, type Locale } from '@/i18n'
import { GENESIS_MS, PERIOD_PRESETS } from '../../stats/stats-period'
import { useStatsPeriod } from '../../stats/use-stats-period'
import { useStatsSync } from '../../stats/stats-sync'
import {
  SC_PeriodBar,
  SC_Segmented,
  SC_SegmentButton,
  SC_CustomRange,
  SC_SyncStatus,
  SC_SyncButton,
} from './stats-period-bar.styled'

defineOptions({ name: 'StatsPeriodBar' })

const { t, locale } = useI18n()
const period = useStatsPeriod()
period.refreshNow()

const customOpen = ref(period.preset.value === 'custom')
const sync = useStatsSync()

const language = computed<Locale>(() =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale.value)
    ? (locale.value as Locale)
    : DEFAULT_LOCALE
)

const syncedLabel = computed(() =>
  sync.syncedAt.value
    ? new Intl.DateTimeFormat(bcp47(language.value), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(sync.syncedAt.value)
    : ''
)

// Календари — в unix-секундах; «по» — последний день периода (его конец — уже
// следующие сутки), не позже сегодня, не раньше «с».
const GENESIS_SEC = Math.floor(GENESIS_MS / 1000)
const fromSec = computed(() => Math.floor(period.range.value.from / 1000))
const toSec = computed(() =>
  Math.floor(Math.max(period.range.value.from, period.range.value.to - 1) / 1000)
)
const nowSec = computed(() => Math.floor(Date.now() / 1000))

function pick(edge: 'from' | 'to', value: number): void {
  if (!value) return
  const day = value * 1000
  if (edge === 'from') period.selectCustom(day, toSec.value * 1000)
  else period.selectCustom(fromSec.value * 1000, day)
}
</script>
