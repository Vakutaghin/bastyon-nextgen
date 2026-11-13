<template>
  <DevUiSection title="Switch, Checkbox, Radio, Segmented">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Switch</SC_DevUiRowLabel>
      <Switch v-model:checked="on" aria-label="Обычный" />
      <Switch v-model:checked="on" size="small" aria-label="Маленький" />
      <Switch :checked="true" disabled aria-label="Выключен, вкл." />
      <Switch :checked="false" disabled aria-label="Выключен, выкл." />
      <Switch :checked="on" loading aria-label="Сохраняется" />
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Checkbox</SC_DevUiRowLabel>
      <Checkbox v-model:checked="agree">Больше не спрашивать</Checkbox>
      <Checkbox :checked="true" disabled>Выключен, отмечен</Checkbox>
      <Checkbox :checked="false" disabled>Выключен</Checkbox>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Radio</SC_DevUiRowLabel>
      <RadioGroup v-model:value="bridge" aria-label="Мосты">
        <Radio value="auto">Автоматически</Radio>
        <Radio value="snowflake">Snowflake</Radio>
        <Radio value="meek" disabled>Недоступно</Radio>
      </RadioGroup>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Segmented</SC_DevUiRowLabel>
      <Segmented v-model:value="range" :options="RANGES" aria-label="Период" />
      <Segmented v-model:value="mode" :options="MODES" size="small" aria-label="Сеть" />
      <Segmented :value="'tor'" :options="MODES" size="small" disabled aria-label="Выключен" />
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Segmented block</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <Segmented v-model:value="kind" :options="KINDS" block aria-label="Вид замка" />
      </SC_DevUiStack>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Checkbox from '@/components/checkbox'
import Radio, { RadioGroup } from '@/components/radio'
import Segmented, { type SegmentedValue } from '@/components/segmented'
import Switch from '@/components/switch'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiRow, SC_DevUiRowLabel, SC_DevUiStack } from '../dev-ui-page.styled'

const RANGES = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
]
const MODES = [
  { value: 'auto', label: 'Авто' },
  { value: 'direct', label: 'Напрямую', disabled: true },
  { value: 'tor', label: 'Tor' },
]
const KINDS = [
  { value: 'pin', label: 'Пин-код' },
  { value: 'pattern', label: 'Графический ключ' },
]

const on = ref(true)
const agree = ref(false)
const bridge = ref<string | number>('snowflake')
const range = ref<SegmentedValue>('7')
const mode = ref<SegmentedValue>('auto')
const kind = ref<SegmentedValue>('pin')
</script>
