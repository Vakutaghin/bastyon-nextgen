<template>
  <!-- Календарь системы: поле даты лежит прозрачным поверх значка — на
       телефоне его открывает касание, на компьютере — showPicker. -->
  <SC_DateJump :title="t('messenger.jump.date')">
    <CalendarOutlined />
    <input
      ref="inputRef"
      type="date"
      data-testid="chat-date-jump"
      :aria-label="t('messenger.jump.date')"
      :min="min"
      :max="max"
      @pointerdown="onPointerDown"
      @click="openPicker"
      @input="onChange"
      @change="onChange"
    />
  </SC_DateJump>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarOutlined } from '@/components/icons'
import { SC_DateJump } from './styled'

defineProps<{
  /** Раньше этой даты переписки нет (YYYY-MM-DD). */
  min?: string
  /** Позже — тоже: обычно сегодня. */
  max?: string
}>()

/** Выбранный день — полночь по местному времени, мс. */
const emit = defineEmits<{ pick: [at: number] }>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
let pointer = ''
/** К какому дню уже перешли: input и change об одном выборе — один переход. */
let handled = ''

/**
 * Календарь открывают заново пустым: тот же день ещё раз — тоже переход. Не
 * при выборе: iOS шлёт change, пока крутят барабан.
 */
function onPointerDown(e: PointerEvent): void {
  pointer = e.pointerType
  handled = ''
  if (inputRef.value) inputRef.value.value = ''
}

/** Мышью календарь сам не открывается (Chromium): открываем его. Касание открывает и так. */
function openPicker(): void {
  if (pointer === 'touch' || pointer === 'pen') return
  try {
    inputRef.value?.showPicker?.()
  } catch {
    /* старый движок: остаётся поле даты с клавиатуры */
  }
}

/** Касанием: барабан iOS шлёт change на каждом повороте — переходим, когда остановились. */
const TOUCH_SETTLE_MS = 700
let settle: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => {
  if (settle) clearTimeout(settle)
})

function pick(): void {
  settle = null
  const value = inputRef.value?.value ?? ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match || value === handled) return
  handled = value
  emit('pick', new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime())
}

/** Выбрали день: Chromium шлёт input и change, Safari — бывает, только input. */
function onChange(): void {
  if (settle) clearTimeout(settle)
  if (pointer === 'touch' || pointer === 'pen') settle = setTimeout(pick, TOUCH_SETTLE_MS)
  else pick()
}
</script>
