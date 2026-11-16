<template>
  <SC_DatePicker
    class="ui-date-picker"
    :class="attrs.class"
    :data-size="size"
    :data-state="isOpen ? 'open' : 'closed'"
    :data-disabled="disabled || undefined"
    :data-clearable="canClear || undefined"
  >
    <button
      v-bind="triggerAttrs"
      :id="id"
      :ref="setTrigger"
      type="button"
      class="ui-date-picker__trigger"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? panelId : undefined"
      :disabled="disabled"
      @click="triggerHandlers.onClick"
      @keydown="onTriggerKeydown"
    >
      <span v-if="display" class="ui-date-picker__value">{{ display }}</span>
      <span v-else class="ui-date-picker__placeholder">{{ placeholder }}</span>
      <CalendarOutlined class="ui-date-picker__icon" />
    </button>
    <button
      v-if="canClear"
      type="button"
      class="ui-date-picker__clear"
      tabindex="-1"
      :aria-label="t('a11y.clear')"
      @click="clear"
    >
      <CloseCircleFilled />
    </button>
    <UiPortal>
      <Transition name="ui-pop" @before-leave="markClosed">
        <SC_DatePanel
          v-if="isOpen"
          :id="panelId"
          :ref="setPanel"
          class="ui-date-panel"
          role="dialog"
          :aria-label="dialogLabel"
          data-state="open"
          :data-time="withTime || undefined"
          @keydown="onPanelKeydown"
        >
          <div class="ui-date-panel__main">
            <div class="ui-date-panel__calendar">
              <div class="ui-date-panel__header">
                <button
                  type="button"
                  class="ui-date-panel__nav"
                  data-nav="super-prev"
                  :aria-label="t('datePicker.prevYear')"
                  @click="shiftView(-1, 'year')"
                >
                  <DoubleLeftOutlined />
                </button>
                <button
                  type="button"
                  class="ui-date-panel__nav"
                  data-nav="prev"
                  :aria-label="t('datePicker.prevMonth')"
                  @click="shiftView(-1, 'month')"
                >
                  <LeftOutlined />
                </button>
                <div :id="titleId" class="ui-date-panel__title" aria-live="polite">
                  {{ title }}
                </div>
                <button
                  type="button"
                  class="ui-date-panel__nav"
                  data-nav="next"
                  :aria-label="t('datePicker.nextMonth')"
                  @click="shiftView(1, 'month')"
                >
                  <RightOutlined />
                </button>
                <button
                  type="button"
                  class="ui-date-panel__nav"
                  data-nav="super-next"
                  :aria-label="t('datePicker.nextYear')"
                  @click="shiftView(1, 'year')"
                >
                  <DoubleRightOutlined />
                </button>
              </div>
              <div class="ui-date-panel__body">
                <table
                  class="ui-date-panel__grid"
                  role="grid"
                  :aria-labelledby="titleId"
                  @keydown="onGridKeydown"
                >
                  <thead>
                    <tr>
                      <th
                        v-for="weekday in weekdays"
                        :key="weekday.long"
                        class="ui-date-panel__weekday"
                        scope="col"
                        :abbr="weekday.long"
                      >
                        {{ weekday.short }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="week in weeks" :key="week[0]!.key">
                      <td
                        v-for="day in week"
                        :key="day.key"
                        class="ui-date-panel__cell"
                        :aria-selected="day.selected"
                      >
                        <button
                          type="button"
                          class="ui-date-panel__day"
                          :tabindex="day.focus ? 0 : -1"
                          :aria-label="day.label"
                          :aria-disabled="day.disabled || undefined"
                          :data-selected="day.selected || undefined"
                          :data-today="day.today || undefined"
                          :data-outside="day.outside || undefined"
                          @click="pickDay(day.date)"
                        >
                          {{ day.number }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-if="withTime" class="ui-date-panel__time">
              <div class="ui-date-panel__time-header" />
              <div class="ui-date-panel__columns">
                <ul
                  class="ui-date-panel__column"
                  data-kind="hour"
                  role="listbox"
                  tabindex="0"
                  :aria-label="t('datePicker.hours')"
                  :aria-activedescendant="draft ? `${panelId}-h-${draft.hour()}` : undefined"
                  @keydown="onColumnKeydown($event, 'hour')"
                >
                  <li
                    v-for="hour in HOURS"
                    :id="`${panelId}-h-${hour}`"
                    :key="hour"
                    class="ui-date-panel__time-cell"
                    role="option"
                    :data-value="hour"
                    :aria-selected="draft?.hour() === hour"
                    :aria-disabled="hourDisabled(hour) || undefined"
                    @click="pickHour(hour)"
                  >
                    {{ pad2(hour) }}
                  </li>
                </ul>
                <ul
                  class="ui-date-panel__column"
                  data-kind="minute"
                  role="listbox"
                  tabindex="0"
                  :aria-label="t('datePicker.minutes')"
                  :aria-activedescendant="draft ? `${panelId}-m-${draft.minute()}` : undefined"
                  @keydown="onColumnKeydown($event, 'minute')"
                >
                  <li
                    v-for="minute in MINUTES"
                    :id="`${panelId}-m-${minute}`"
                    :key="minute"
                    class="ui-date-panel__time-cell"
                    role="option"
                    :data-value="minute"
                    :aria-selected="draft?.minute() === minute"
                    :aria-disabled="minuteDisabled(minute) || undefined"
                    @click="pickMinute(minute)"
                  >
                    {{ pad2(minute) }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div v-if="withTime || showToday" class="ui-date-panel__footer">
            <Button
              v-if="withTime"
              type="primary"
              size="small"
              class="ui-date-panel__ok"
              :disabled="!draft"
              @click="confirm"
            >
              {{ t('datePicker.ok') }}
            </Button>
            <button
              v-else
              type="button"
              class="ui-date-panel__today"
              :disabled="todayDisabled"
              @click="pickToday"
            >
              {{ t('datePicker.today') }}
            </button>
          </div>
        </SC_DatePanel>
      </Transition>
    </UiPortal>
  </SC_DatePicker>
</template>

<script setup lang="ts">
// Поле даты и времени вместо antd DatePicker: календарь в оформлении полей
// Nuxt UI, а не системный datetime-local, который в каждом браузере свой.
// Значение — unix-секунды, 0 — не выбрано; руками не вводится, только выбор.
//
// Части: .ui-date-picker (data-size, data-state, data-disabled,
// data-clearable) > __trigger > __value | __placeholder, __icon; __clear.
// Панель в слое: .ui-date-panel (role=dialog, data-time) > __main >
// __calendar (__header > __nav[data-nav], __title; __body > __grid >
// __weekday, __cell > __day[data-selected|data-today|data-outside|
// aria-disabled]) + __time (__column[data-kind] > __time-cell); __footer >
// __ok | __today. Атрибуты (aria-label) — на поле, class — на корень.
import { computed, useAttrs } from 'vue'
import Button from '@/components/button'
import {
  CalendarOutlined,
  CloseCircleFilled,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  LeftOutlined,
  RightOutlined,
} from '@/components/icons'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef } from '@/components/ui-core/trigger'
import { t } from '@/i18n'
import { pad2 } from './calendar'
import { HOURS, MINUTES, useDateTimePicker } from './date-time-picker'
import type { DateTimePickerEmits, DateTimePickerProps } from './types'
import { SC_DatePanel, SC_DatePicker } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<DateTimePickerProps>(), {
  future: false,
  min: undefined,
  max: undefined,
  showTime: true,
  allowClear: true,
  showToday: true,
  size: 'large',
  placeholder: undefined,
  id: undefined,
  disabled: false,
})
const emit = defineEmits<DateTimePickerEmits>()
const attrs = useAttrs()

const triggerAttrs = computed(() => {
  const rest: Record<string, unknown> = { ...attrs }
  delete rest.class
  return rest
})

const { el: triggerEl, setRef: setTrigger } = useElementRef()
const { el: panelEl, setRef: setPanel } = useElementRef()

const {
  id: popupId,
  isOpen,
  triggerHandlers,
  withTime,
  display,
  canClear,
  clear,
  dialogLabel,
  title,
  weekdays,
  weeks,
  pickDay,
  pickToday,
  todayDisabled,
  shiftView,
  onGridKeydown,
  draft,
  hourDisabled,
  minuteDisabled,
  pickHour,
  pickMinute,
  onColumnKeydown,
  confirm,
  onTriggerKeydown,
  onPanelKeydown,
} = useDateTimePicker(p, emit, triggerEl, panelEl)

const panelId = `${popupId}-panel`
const titleId = `${popupId}-title`

/** Уходящая панель (анимация закрытия) — уже закрытая для стилей и тестов. */
function markClosed(el: Element): void {
  ;(el as HTMLElement).dataset.state = 'closed'
}
</script>
