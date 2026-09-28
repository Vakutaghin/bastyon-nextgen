<template>
  <SC_Picker>
    <DatePicker
      v-if="pickerLocale"
      :id="id"
      :value="current"
      :locale="pickerLocale"
      :format="formatValue"
      :show-time="showTime"
      :show-now="false"
      :input-read-only="true"
      :disabled="disabled"
      :disabled-date="disabledDate"
      :disabled-time="disabledTime"
      :placeholder="placeholder"
      :get-popup-container="popupContainer"
      :popup-class-name="PICKER_POPUP_CLASS"
      size="large"
      @change="onChange"
      @open-change="onOpenChange"
    >
      <template #suffixIcon><CalendarOutlined /></template>
    </DatePicker>
    <!-- Пока грузится язык календаря — поле той же высоты, чтобы строка не прыгала. -->
    <SC_Placeholder v-else aria-hidden="true">{{ placeholder }}</SC_Placeholder>
  </SC_Picker>
</template>

<script setup lang="ts">
// Дата и время в оформлении полей Nuxt UI: календарь antd вместо системного
// datetime-local, который в каждом браузере свой и в приложении для компьютера
// выглядел чужим. Значение — unix-секунды, 0 — не выбрано. Текст в поле — по
// правилам языка интерфейса; вводить руками нельзя, только выбрать.
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DatePicker } from 'ant-design-vue'
import type { PickerLocale } from 'ant-design-vue/es/date-picker/generatePicker'
import dayjs, { type Dayjs } from 'dayjs'

import { CalendarOutlined } from '@/components/icons'
import { popupContainer } from '@/components/popup-container'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, bcp47, type Locale } from '@/i18n'
import { firstAllowedMinute, minuteLimits } from './limits'
import { loadPickerLocale } from './picker-locale'
import { SC_Picker, SC_Placeholder } from './styled'

/** Класс панели календаря: она рисуется вне обёртки, стили — в style.css. */
const PICKER_POPUP_CLASS = 'ui-picker-dropdown'

const props = defineProps<{
  /** Выбранный момент, unix-секунды; 0 — не выбран. */
  value: number
  /** Только будущее: раньше следующей минуты (на момент открытия) выбрать нельзя. */
  future?: boolean
  placeholder?: string
  id?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** Выбранный момент в unix-секундах, 0 — поле очистили. */
  (e: 'change', value: number): void
}>()

const { locale } = useI18n()
const language = computed<Locale>(() =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale.value)
    ? (locale.value as Locale)
    : DEFAULT_LOCALE
)

const pickerLocale = shallowRef<PickerLocale | null>(null)
watch(
  language,
  async (lang) => {
    try {
      const loaded = await loadPickerLocale(lang)
      // Пока грузилось, язык могли сменить ещё раз.
      if (lang === language.value) pickerLocale.value = loaded
    } catch {
      // Чанк языка не загрузился — календарь на английском лучше, чем никакого.
      if (!pickerLocale.value) pickerLocale.value = await loadPickerLocale('en')
    }
  },
  { immediate: true }
)

// Пустое поле — null, а не undefined: на undefined antd считает поле
// неуправляемым и показывал бы прежнюю дату, когда окно поста её сбросило.
// В типах antd null нет, в рантайме это штатное «не выбрано».
const current = computed(() =>
  props.value > 0 ? dayjs.unix(props.value) : (null as unknown as Dayjs)
)

// «29 сент., 11:00»; год — только если не текущий, иначе поле не вмещает текст.
const formatValue = (value: Dayjs): string =>
  new Intl.DateTimeFormat(bcp47(language.value), {
    day: 'numeric',
    month: 'short',
    year: value.year() === dayjs().year() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value.toDate())

// «Сейчас» — на момент открытия календаря: окно с полем могут держать открытым долго.
const openedAt = ref(Date.now())
function onOpenChange(open: boolean): void {
  if (open) openedAt.value = Date.now()
}

/** Первая минута, которую можно выбрать; null — ограничения нет. */
const first = computed<Dayjs | null>(() =>
  props.future ? firstAllowedMinute(Math.floor(openedAt.value / 1000)) : null
)

// Время по умолчанию, когда выбирают день, — ближайший целый час после «можно».
const showTime = computed(() => ({
  format: 'HH:mm',
  defaultValue: (first.value ?? dayjs()).add(1, 'hour').startOf('hour'),
}))

const disabledDate = (day: Dayjs): boolean =>
  first.value !== null && day.isBefore(first.value, 'day')

const disabledTime = (day: Dayjs | null) => {
  const limits = minuteLimits(day, first.value)
  return {
    disabledHours: () => limits.hours,
    disabledMinutes: (hour: number) => limits.minutes(hour),
  }
}

function onChange(value: Dayjs | string | null): void {
  if (!value) {
    emit('change', 0)
    return
  }
  const picked = dayjs(value).second(0).millisecond(0)
  // Время раньше допустимого (день выбрали, а часы остались прошлыми) —
  // ставим первое допустимое, а не молча публикуем в прошлом.
  const safe = first.value && picked.isBefore(first.value) ? first.value : picked
  emit('change', safe.unix())
}
</script>
