<template>
  <SC_FeedSettings>
    <SC_TopFirstWrapper>
      <SC_TopFirstLabel>{{ t('sidebar.topFirst') }}</SC_TopFirstLabel>
      <ASwitch
        :aria-label="t('sidebar.topFirst')"
        :checked="filtersStore.topFirst"
        size="small"
        @change="filtersStore.toggleTopFirst()"
      />
    </SC_TopFirstWrapper>
    <!-- «Новые посты сразу» — в ленте по дате; у «Сначала лучшее» наверху не новое. -->
    <SC_TopFirstWrapper :title="t('sidebar.liveFeedHint')">
      <SC_FeedLanguageLabel :for="liveFeedId">{{ t('sidebar.liveFeed') }}</SC_FeedLanguageLabel>
      <ASwitch
        :id="liveFeedId"
        :checked="filtersStore.liveFeed"
        :disabled="filtersStore.topFirst"
        size="small"
        @change="filtersStore.toggleLiveFeed()"
      />
    </SC_TopFirstWrapper>
    <!-- Языки ленты — свои, можно несколько; язык интерфейса (шапка, «Настройки») переключает и их. -->
    <SC_TopFirstWrapper :title="t('sidebar.feedLanguageHint')">
      <SC_FeedLanguageLabel :for="feedLanguageId">
        {{ t('sidebar.feedLanguage') }}
      </SC_FeedLanguageLabel>
      <SC_FeedLanguageSelect data-testid="feed-languages">
        <Select
          :id="feedLanguageId"
          mode="multiple"
          size="middle"
          :value="uiStore.contentLanguages"
          :options="FEED_LANGUAGE_OPTIONS"
          :max-tag-count="0"
          :max-tag-placeholder="languagesSummary"
          :show-search="false"
          show-arrow
          @change="onFeedLanguagesChange"
        />
      </SC_FeedLanguageSelect>
    </SC_TopFirstWrapper>
    <!-- «Репутация авторов»: посты авторов ниже порога в ленте не показываются. -->
    <SC_TopFirstWrapper :title="t('sidebar.minReputationHint')">
      <SC_FeedLanguageLabel :for="reputationId">{{
        t('sidebar.minReputation')
      }}</SC_FeedLanguageLabel>
      <SC_FeedLanguageSelect data-testid="feed-min-reputation">
        <Select
          :id="reputationId"
          size="middle"
          :value="reputationChoice"
          :options="reputationOptions"
          @change="onReputationChoice"
        />
      </SC_FeedLanguageSelect>
    </SC_TopFirstWrapper>
    <SC_TopFirstWrapper v-if="customOpen || isCustomValue">
      <SC_FeedLanguageLabel :for="reputationValueId">
        {{ t('sidebar.minReputationValue') }}
      </SC_FeedLanguageLabel>
      <SC_ReputationInput
        :id="reputationValueId"
        type="number"
        inputmode="numeric"
        step="1"
        :min="MIN_REPUTATION_RANGE.min"
        :max="MIN_REPUTATION_RANGE.max"
        :value="filtersStore.minReputation ?? ''"
        data-testid="feed-min-reputation-value"
        @change="onReputationValue"
        @keydown.enter="onReputationValue"
      />
    </SC_TopFirstWrapper>
  </SC_FeedSettings>
</template>

<script setup lang="ts">
// «Сначала лучшее», «Новые посты сразу», «Язык ленты» и «Репутация авторов»
// над категориями. Отдельный блок: в «Шапке и панелях» его прячут и
// переставляют сам по себе.

import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Switch as ASwitch } from 'ant-design-vue'
import Select, { type SelectOption } from '@/components/select'
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n'
import { formatTopReputation } from '@/pages/top-accounts-page/top-format'
import { useFiltersStore } from '@/stores/filters-store'
import { MIN_REPUTATION_RANGE, REPUTATION_PRESETS } from '@/stores/filters-store-consts'
import { useUIStore } from '@/stores/ui-store'
import {
  SC_FeedSettings,
  SC_FeedLanguageLabel,
  SC_FeedLanguageSelect,
  SC_ReputationInput,
  SC_TopFirstWrapper,
  SC_TopFirstLabel,
} from './styled'

const { t } = useI18n()
const filtersStore = useFiltersStore()
const uiStore = useUIStore()
// Панель бывает дважды (левая и меню телефона) — id подписи у каждой свой.
const feedLanguageId = useId()
const liveFeedId = useId()
const reputationId = useId()
const reputationValueId = useId()

const FEED_LANGUAGE_OPTIONS: SelectOption[] = SUPPORTED_LOCALES.map((value) => ({
  value,
  label: LOCALE_NAMES[value],
}))

/** В поле: один язык — названием, несколько — кодами («RU, EN, DE»). */
function languagesSummary(): string {
  const langs = uiStore.contentLanguages
  return langs.length === 1
    ? LOCALE_NAMES[langs[0]!]
    : langs.map((lang) => lang.toUpperCase()).join(', ')
}

/** Только лента: язык интерфейса остаётся прежним. Сняли все — как у интерфейса. */
function onFeedLanguagesChange(value: unknown): void {
  const list = Array.isArray(value) ? value : [value]
  uiStore.setFeedLanguages(
    list.filter((lang): lang is Locale => (SUPPORTED_LOCALES as readonly unknown[]).includes(lang))
  )
}

const ANY = 'any'
const CUSTOM = 'custom'
/** Выбрали «Своя…»: поле видно, пока не выбрали готовый порог. */
const customOpen = ref(false)

const isCustomValue = computed<boolean>(() => {
  const min = filtersStore.minReputation
  return min !== null && !REPUTATION_PRESETS.includes(min)
})

const fromLabel = (n: number): string =>
  t('sidebar.minReputationFrom', { n: formatTopReputation(n) })

const reputationOptions = computed<SelectOption[]>(() => {
  const min = filtersStore.minReputation
  return [
    { value: ANY, label: t('sidebar.minReputationAny') },
    ...REPUTATION_PRESETS.map((n) => ({ value: n, label: fromLabel(n) })),
    // Своё значение — тоже строкой «От 250», чтобы было видно, что выбрано.
    ...(isCustomValue.value && min !== null ? [{ value: min, label: fromLabel(min) }] : []),
    { value: CUSTOM, label: t('sidebar.minReputationCustom') },
  ]
})

const reputationChoice = computed<string | number>(() => {
  const min = filtersStore.minReputation
  if (customOpen.value && !isCustomValue.value) return CUSTOM
  return min ?? ANY
})

function onReputationChoice(value: unknown): void {
  if (value === CUSTOM) {
    customOpen.value = true
    // По id: ref styled-компонента — его экземпляр, а не поле.
    void nextTick(() => document.getElementById(reputationValueId)?.focus())
    return
  }
  customOpen.value = false
  filtersStore.setMinReputation(value === ANY ? null : Number(value))
}

/** Своё целое; пустое или не число — остаётся прежнее. */
function onReputationValue(e: Event): void {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (input.value.trim() !== '' && Number.isFinite(value)) filtersStore.setMinReputation(value)
  input.value = String(filtersStore.minReputation ?? '')
}

// «Сначала лучшее» хранится с фильтрами: без категорий на экране их тоже надо прочитать.
onMounted(() => {
  void filtersStore.init()
})
</script>
