<template>
  <SC_FeedSettings>
    <SC_TopFirstWrapper>
      <SC_TopFirstLabel>{{ t('sidebar.topFirst') }}</SC_TopFirstLabel>
      <ASwitch
        :checked="filtersStore.topFirst"
        size="small"
        @change="filtersStore.toggleTopFirst()"
      />
    </SC_TopFirstWrapper>
    <!-- Язык ленты — свой; язык интерфейса (шапка, «Настройки») переключает и его. -->
    <SC_TopFirstWrapper>
      <SC_FeedLanguageLabel :for="feedLanguageId">
        {{ t('sidebar.feedLanguage') }}
      </SC_FeedLanguageLabel>
      <SC_FeedLanguageSelect>
        <Select
          :id="feedLanguageId"
          size="middle"
          :value="uiStore.contentLanguage"
          :options="FEED_LANGUAGE_OPTIONS"
          @change="onFeedLanguageChange"
        />
      </SC_FeedLanguageSelect>
    </SC_TopFirstWrapper>
  </SC_FeedSettings>
</template>

<script setup lang="ts">
// «Сначала лучшее» и «Язык ленты» над категориями. Отдельный блок: в «Шапке и
// панелях» его прячут и переставляют сам по себе.

import { onMounted, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Switch as ASwitch } from 'ant-design-vue'
import Select, { type SelectOption } from '@/components/select'
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n'
import { useFiltersStore } from '@/stores/filters-store'
import { useUIStore } from '@/stores/ui-store'
import {
  SC_FeedSettings,
  SC_FeedLanguageLabel,
  SC_FeedLanguageSelect,
  SC_TopFirstWrapper,
  SC_TopFirstLabel,
} from './styled'

const { t } = useI18n()
const filtersStore = useFiltersStore()
const uiStore = useUIStore()
// Панель бывает дважды (левая и меню телефона) — id подписи у каждой свой.
const feedLanguageId = useId()

const FEED_LANGUAGE_OPTIONS: SelectOption[] = SUPPORTED_LOCALES.map((value) => ({
  value,
  label: LOCALE_NAMES[value],
}))

/** Только лента: язык интерфейса остаётся прежним. */
function onFeedLanguageChange(value: unknown): void {
  if ((SUPPORTED_LOCALES as readonly unknown[]).includes(value)) {
    uiStore.setFeedLanguage(value as Locale)
  }
}

// «Сначала лучшее» хранится с фильтрами: без категорий на экране их тоже надо прочитать.
onMounted(() => {
  void filtersStore.init()
})
</script>
