/**
 * Выбранный период статистики — общий для «Обзора» и «Статистики» и
 * запомненный в браузере: вернувшись, человек видит тот же отрезок.
 */

import { computed, ref } from 'vue'
import type { Granularity } from './stats-model'
import {
  PERIOD_PRESETS,
  customRange,
  defaultGranularity,
  granularityOptions,
  presetRange,
  type PeriodPreset,
  type PeriodRange,
} from './stats-period'

const STORAGE_KEY = 'explorer-stats-period'
const DEFAULT_PRESET: PeriodPreset = '30d'

interface Saved {
  preset: PeriodPreset | 'custom'
  custom?: [number, number] | null
  granularity?: Granularity | null
}

function readSaved(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null
    if (raw && (raw.preset === 'custom' || PERIOD_PRESETS.includes(raw.preset))) return raw
  } catch {
    /* нет хранилища или мусор в нём */
  }
  return { preset: DEFAULT_PRESET }
}

const saved = readSaved()
const preset = ref<PeriodPreset | 'custom'>(
  saved.preset === 'custom' && !saved.custom ? DEFAULT_PRESET : saved.preset
)
const custom = ref<[number, number] | null>(saved.custom ?? null)
const chosenGranularity = ref<Granularity | null>(saved.granularity ?? null)
/** «Сейчас» периода: фиксируется при выборе, чтобы отрезок не полз каждую секунду. */
const now = ref(Date.now())

function persist(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        preset: preset.value,
        custom: custom.value,
        granularity: chosenGranularity.value,
      } satisfies Saved)
    )
  } catch {
    /* не запомнили — не беда */
  }
}

export function useStatsPeriod() {
  const range = computed<PeriodRange>(() =>
    preset.value === 'custom' && custom.value
      ? customRange(custom.value[0], custom.value[1], now.value)
      : presetRange(preset.value === 'custom' ? DEFAULT_PRESET : preset.value, now.value)
  )
  const granularities = computed(() => granularityOptions(range.value, now.value))
  const granularity = computed<Granularity>(() =>
    chosenGranularity.value && granularities.value.includes(chosenGranularity.value)
      ? chosenGranularity.value
      : defaultGranularity(range.value, now.value)
  )

  function selectPreset(next: PeriodPreset): void {
    now.value = Date.now()
    preset.value = next
    chosenGranularity.value = null
    persist()
  }

  function selectCustom(from: number, to: number): void {
    now.value = Date.now()
    custom.value = [from, to]
    preset.value = 'custom'
    chosenGranularity.value = null
    persist()
  }

  function selectGranularity(next: Granularity): void {
    chosenGranularity.value = next
    persist()
  }

  /** Обновить «сейчас» — например, когда страницу открыли заново. */
  function refreshNow(): void {
    if (Date.now() - now.value > 60_000) now.value = Date.now()
  }

  return {
    preset: computed(() => preset.value),
    custom: computed(() => custom.value),
    range,
    granularity,
    granularities,
    selectPreset,
    selectCustom,
    selectGranularity,
    refreshNow,
  }
}
