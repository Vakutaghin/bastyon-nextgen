<template>
  <DevUiSection title="DateTimePicker">
    <SC_DevUiRow>
      <SC_DevUiRowLabel>
        <label for="dev-date-schedule">С временем, только будущее</label>
      </SC_DevUiRowLabel>
      <SC_DevUiStack>
        <DateTimePicker
          id="dev-date-schedule"
          :value="schedule"
          future
          placeholder="Сразу"
          data-testid="dev-date"
          @change="(v: number) => (schedule = v)"
        />
        <SC_DevUiRowLabel>Значение: {{ schedule }}</SC_DevUiRowLabel>
      </SC_DevUiStack>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Без времени, middle</SC_DevUiRowLabel>
      <SC_DevUiDay>
        <DateTimePicker
          :value="day"
          :show-time="false"
          :allow-clear="false"
          :max="today"
          size="middle"
          aria-label="По"
          data-testid="dev-date-day"
          @change="(v: number) => (day = v)"
        />
      </SC_DevUiDay>
    </SC_DevUiRow>
    <SC_DevUiRow>
      <SC_DevUiRowLabel>Выключено</SC_DevUiRowLabel>
      <SC_DevUiStack>
        <DateTimePicker :value="schedule || today" disabled aria-label="Выключено" />
      </SC_DevUiStack>
    </SC_DevUiRow>
  </DevUiSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DateTimePicker from '@/components/date-time-picker'
import DevUiSection from '../dev-ui-section.vue'
import { SC_DevUiDay, SC_DevUiRow, SC_DevUiRowLabel, SC_DevUiStack } from '../dev-ui-page.styled'

const today = Math.floor(Date.now() / 1000)
const schedule = ref(0)
const day = ref(today - 6 * 86_400)
</script>
