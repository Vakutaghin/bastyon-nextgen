<template>
  <DevUiSection title="Select">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>
        <label for="dev-select-language">Язык поста</label>
      </SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Select
          id="dev-select-language"
          v-model:value="language"
          :options="LANGUAGES"
          data-testid="dev-select"
        />
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>middle, 32px</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Select
          v-model:value="sort"
          size="middle"
          :options="SORT"
          aria-label="Порядок комментариев"
        />
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Подсказка, пусто</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Select
          v-model:value="file"
          :options="[]"
          placeholder="Выберите файл"
          not-found-content="Других публичных файлов нет"
          aria-label="Новая версия"
        />
        <Select :value="'en'" :options="LANGUAGES" disabled aria-label="Выключено" />
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>
        <label for="dev-select-feed">Несколько</label>
      </SC_DevUiRowLabel>
      <SC_DevUiNarrow>
        <Select
          id="dev-select-feed"
          v-model:value="feed"
          mode="multiple"
          size="middle"
          :options="LANGUAGES"
          :format-value="codes"
          data-testid="dev-select-multiple"
        />
      </SC_DevUiNarrow>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Select from '@/components/select'
import type { SelectOption, SelectValue } from '@/components/select'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiNarrow, SC_DevUiRow, SC_DevUiRowLabel, SC_DevUiStack } from '../dev-ui-page.styled'

const LANGUAGES: SelectOption[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'kr', label: '한국어' },
  { value: 'zh', label: '中文' },
  { value: 'sr', label: 'Српски' },
  { value: 'xx', label: 'Недоступный', disabled: true },
]

const SORT: SelectOption[] = [
  { value: 'interesting', label: 'Сначала интересные' },
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
]

const language = ref<SelectValue>('ru')
const sort = ref<SelectValue>('interesting')
const file = ref<SelectValue>()
const feed = ref<SelectValue[]>(['ru', 'en'])

/** Несколько языков — кодами, как «Язык ленты» в боковой панели. */
function codes(values: SelectValue[]): string {
  return values.map((value) => String(value).toUpperCase()).join(', ')
}
</script>
