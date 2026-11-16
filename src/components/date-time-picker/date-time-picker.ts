/**
 * Календарь у поля: сетка месяца и, с временем, колонки часов и минут.
 *
 * - С временем выбор — черновик: день и время видны в поле, а фиксирует их
 *   «ОК»; нажатие мимо, Esc и «Назад» черновик отбрасывают (как у antd).
 *   Без времени день выбирается сразу.
 * - Клавиатура по WAI-ARIA APG «Date Picker Dialog»: стрелки по дням и
 *   неделям, Home / End — к началу и концу недели, PageUp / PageDown — месяц,
 *   с Shift — год; в колонках времени — стрелки, Home / End. Tab ходит по
 *   панели по кругу.
 * - Открытие, слой, нажатие мимо, Esc и возврат фокуса — общие с Popover
 *   (`usePopup`).
 */

import { computed, nextTick, ref, watch, type Ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, i18n, type Locale } from '@/i18n'
import { usePopup } from '@/components/popover/popup'
import type { PopupEmits } from '@/components/popover/types'
import { tabbables } from '@/components/ui-core/focus-trap'
import { firstAllowedMinute, minuteLimits } from './limits'
import {
  WEEK_START,
  dayLabeler,
  formatField,
  monthGrid,
  monthTitle,
  weekdayNames,
} from './calendar'
import type { DateTimePickerEmits, DateTimePickerProps } from './types'

export const HOURS = Array.from({ length: 24 }, (_, i) => i)
export const MINUTES = Array.from({ length: 60 }, (_, i) => i)

/** Зазор между полем и панелью, px (как у antd). */
const PANEL_OFFSET = 2
/** Сколько кадров ждать, пока floating-ui поставит панель (до этого она скрыта). */
const FOCUS_FRAMES = 10

const DAY_SELECTOR = '.ui-date-panel__day[tabindex="0"]'

export interface CalendarDay {
  key: string
  date: Dayjs
  number: number
  label: string
  selected: boolean
  today: boolean
  outside: boolean
  disabled: boolean
  /** До этого дня доходит Tab (один на сетку). */
  focus: boolean
}

/** Пустой emit для usePopup: открытие панели наружу не сообщаем. */
const noEmit = (() => {}) as PopupEmits

export function useDateTimePicker(
  p: DateTimePickerProps,
  emit: DateTimePickerEmits,
  triggerRef: Ref<HTMLElement | null>,
  panelRef: Ref<HTMLElement | null>
) {
  const language = computed<Locale>(() => {
    const locale = i18n.global.locale.value as string
    return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
      ? (locale as Locale)
      : DEFAULT_LOCALE
  })
  const weekStart = computed(() => WEEK_START[language.value])
  const withTime = computed(() => p.showTime !== false)
  const current = computed<Dayjs | null>(() => (p.value > 0 ? dayjs.unix(p.value) : null))

  const { id, isOpen, setOpen, triggerHandlers } = usePopup(
    { placement: 'bottomLeft' },
    noEmit,
    triggerRef,
    panelRef,
    {
      kind: 'popover',
      defaultPlacement: 'bottomLeft',
      offset: PANEL_OFFSET,
      focusTarget: (panel) => panel.querySelector<HTMLElement>(DAY_SELECTOR),
    }
  )

  // «Сейчас» — на момент открытия: окно с полем могут держать открытым долго.
  const openedAt = ref(Date.now())
  /** Первая минута, которую можно выбрать; null — ограничения нет. */
  const first = computed<Dayjs | null>(() =>
    p.future ? firstAllowedMinute(Math.floor(openedAt.value / 1000)) : null
  )
  const minDay = computed<Dayjs | null>(() => first.value ?? (p.min ? dayjs.unix(p.min) : null))
  const maxDay = computed<Dayjs | null>(() => (p.max ? dayjs.unix(p.max) : null))
  const todayDay = computed(() => dayjs(openedAt.value).startOf('day'))

  function isDayDisabled(day: Dayjs): boolean {
    return (
      (minDay.value !== null && day.isBefore(minDay.value, 'day')) ||
      (maxDay.value !== null && day.isAfter(maxDay.value, 'day'))
    )
  }

  function clampDay(day: Dayjs): Dayjs {
    if (minDay.value && day.isBefore(minDay.value, 'day')) return minDay.value.startOf('day')
    if (maxDay.value && day.isAfter(maxDay.value, 'day')) return maxDay.value.startOf('day')
    return day
  }

  /** Черновик с временем: виден в поле, фиксирует его «ОК». */
  const draft = ref<Dayjs | null>(null)
  const viewMonth = ref(dayjs().startOf('month'))
  const focusDay = ref(dayjs().startOf('day'))
  /** Подпись панели для диктора — берётся при открытии. */
  const dialogLabel = ref<string | undefined>()

  /** Время, когда выбирают день без времени, — ближайший целый час после «можно». */
  const defaultMoment = (): Dayjs => (first.value ?? dayjs()).add(1, 'hour').startOf('hour')

  let instantScroll = false
  watch(
    isOpen,
    (open) => {
      if (!open) {
        draft.value = null
        return
      }
      openedAt.value = Date.now()
      draft.value = withTime.value ? current.value : null
      const start = clampDay((current.value ?? dayjs()).startOf('day'))
      focusDay.value = start
      viewMonth.value = start.startOf('month')
      dialogLabel.value = computeLabel()
      instantScroll = true
      void nextTick(scrollTimeColumns)
    },
    { flush: 'sync' }
  )

  function computeLabel(): string | undefined {
    const el = triggerRef.value
    const own = el?.getAttribute('aria-label')
    if (own) return own
    const label = el?.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
    return label?.textContent?.trim() || p.placeholder || undefined
  }

  // --- Сетка месяца ---
  const selectedDay = computed<Dayjs | null>(() => (withTime.value ? draft.value : current.value))
  const title = computed(() => monthTitle(viewMonth.value, language.value))
  const weekdays = computed(() => weekdayNames(language.value, weekStart.value))
  const weeks = computed<CalendarDay[][]>(() => {
    const label = dayLabeler(language.value)
    const days = monthGrid(viewMonth.value, weekStart.value).map<CalendarDay>((date) => ({
      key: date.format('YYYY-MM-DD'),
      date,
      number: date.date(),
      label: label(date),
      selected: !!selectedDay.value && date.isSame(selectedDay.value, 'day'),
      today: date.isSame(todayDay.value, 'day'),
      outside: !date.isSame(viewMonth.value, 'month'),
      disabled: isDayDisabled(date),
      focus: date.isSame(focusDay.value, 'day'),
    }))
    return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  })

  function commit(value: Dayjs): void {
    emit('change', value.unix())
    // Выбрали в панели — фокус на поле. В Safari нажатие не фокусирует кнопку,
    // и фокус из панели уходит в body: вернуть его и тогда.
    const active = document.activeElement
    const lost = !active || active === document.body || !!panelRef.value?.contains(active)
    setOpen(false)
    if (lost) triggerRef.value?.focus({ preventScroll: true })
  }

  function pickDay(day: Dayjs): void {
    focusDay.value = day
    if (!day.isSame(viewMonth.value, 'month')) viewMonth.value = day.startOf('month')
    if (isDayDisabled(day)) return
    if (!withTime.value) {
      commit(day.startOf('day'))
      return
    }
    const time = draft.value ?? defaultMoment()
    draft.value = day.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
  }

  const todayDisabled = computed(() => isDayDisabled(todayDay.value))
  function pickToday(): void {
    if (!todayDisabled.value) commit(todayDay.value)
  }

  /** Листание: месяц или год, подсвеченный день — туда же. */
  function shiftView(amount: number, unit: 'month' | 'year'): void {
    viewMonth.value = viewMonth.value.add(amount, unit)
    focusDay.value = focusDay.value.add(amount, unit)
  }

  function focusFocusedDay(): void {
    void nextTick(() => panelRef.value?.querySelector<HTMLElement>(DAY_SELECTOR)?.focus())
  }

  function onGridKeydown(e: KeyboardEvent): void {
    const day = focusDay.value
    const inWeek = (day.day() - weekStart.value + 7) % 7
    const unit = e.shiftKey ? 'year' : 'month'
    let next: Dayjs
    switch (e.key) {
      case 'ArrowLeft':
        next = day.subtract(1, 'day')
        break
      case 'ArrowRight':
        next = day.add(1, 'day')
        break
      case 'ArrowUp':
        next = day.subtract(7, 'day')
        break
      case 'ArrowDown':
        next = day.add(7, 'day')
        break
      case 'Home':
        next = day.subtract(inWeek, 'day')
        break
      case 'End':
        next = day.add(6 - inWeek, 'day')
        break
      case 'PageUp':
        next = day.subtract(1, unit)
        break
      case 'PageDown':
        next = day.add(1, unit)
        break
      default:
        return
    }
    e.preventDefault()
    focusDay.value = next
    if (!next.isSame(viewMonth.value, 'month')) viewMonth.value = next.startOf('month')
    focusFocusedDay()
  }

  // --- Время ---
  const timeLimits = computed(() => minuteLimits(draft.value, first.value))
  const hourDisabled = (hour: number): boolean => timeLimits.value.hours.includes(hour)
  const minuteDisabled = (minute: number): boolean =>
    !!draft.value && timeLimits.value.minutes(draft.value.hour()).includes(minute)

  function pickHour(hour: number): void {
    if (hourDisabled(hour)) return
    draft.value = (draft.value ?? defaultMoment()).hour(hour)
  }

  function pickMinute(minute: number): void {
    if (minuteDisabled(minute)) return
    draft.value = (draft.value ?? defaultMoment()).minute(minute)
  }

  function onColumnKeydown(e: KeyboardEvent, kind: 'hour' | 'minute'): void {
    const values = kind === 'hour' ? HOURS : MINUTES
    const disabled = kind === 'hour' ? hourDisabled : minuteDisabled
    const pick = kind === 'hour' ? pickHour : pickMinute
    const now = draft.value ? (kind === 'hour' ? draft.value.hour() : draft.value.minute()) : -1
    let order: number[]
    if (e.key === 'ArrowDown') order = values.filter((v) => v > now)
    else if (e.key === 'ArrowUp') order = values.filter((v) => v < now).reverse()
    else if (e.key === 'Home') order = values
    else if (e.key === 'End') order = [...values].reverse()
    else return
    e.preventDefault()
    const target = order.find((v) => !disabled(v))
    if (target !== undefined) pick(target)
  }

  /** Выбранные час и минута — вверху своих колонок, как у antd. */
  function scrollTimeColumns(): void {
    const panel = panelRef.value
    const value = draft.value
    const smooth = !instantScroll
    instantScroll = false
    if (!panel || !value) return
    for (const [kind, n] of [
      ['hour', value.hour()],
      ['minute', value.minute()],
    ] as const) {
      const column = panel.querySelector<HTMLElement>(`.ui-date-panel__column[data-kind="${kind}"]`)
      const cell = column?.querySelector<HTMLElement>(`[data-value="${n}"]`)
      if (!column || !cell) continue
      if (typeof column.scrollTo === 'function') {
        column.scrollTo({ top: cell.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
      } else {
        column.scrollTop = cell.offsetTop
      }
    }
  }

  watch(
    () => draft.value?.valueOf(),
    () => {
      if (isOpen.value) void nextTick(scrollTimeColumns)
    }
  )

  function confirm(): void {
    if (!draft.value) return
    const picked = draft.value.second(0).millisecond(0)
    // Время раньше допустимого (день выбрали, а часы остались прошлыми) —
    // ставим первое допустимое, а не молча публикуем в прошлом.
    commit(first.value && picked.isBefore(first.value) ? first.value : picked)
  }

  // --- Поле ---
  const canClear = computed(() => p.allowClear !== false && p.value > 0 && !p.disabled)

  function clear(): void {
    if (canClear.value) emit('change', 0)
  }

  /** С временем при открытой панели в поле — черновик, как у antd. */
  const display = computed<string>(() => {
    const shown = isOpen.value && withTime.value && draft.value ? draft.value : current.value
    return shown ? formatField(shown, language.value, withTime.value) : ''
  })

  /** Фокус в сетку, когда floating-ui показал панель (до расчёта она скрыта). */
  function focusGrid(frames = FOCUS_FRAMES): void {
    void nextTick(() => {
      const el = panelRef.value
      if (el && el.style.visibility !== 'hidden') {
        el.querySelector<HTMLElement>(DAY_SELECTOR)?.focus({ preventScroll: true })
      } else if (frames > 0) {
        requestAnimationFrame(() => focusGrid(frames - 1))
      }
    })
  }

  function onTriggerKeydown(e: KeyboardEvent): void {
    if (p.disabled) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && canClear.value) {
      e.preventDefault()
      clear()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen.value) setOpen(true)
      focusGrid()
    }
  }

  /** Tab ходит по панели по кругу: она в слое в конце страницы. */
  function onPanelKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !panelRef.value) return
    const items = tabbables(panelRef.value)
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    if (!firstItem || !lastItem) return
    if (e.shiftKey && document.activeElement === firstItem) {
      e.preventDefault()
      lastItem.focus()
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault()
      firstItem.focus()
    }
  }

  watch(
    () => p.disabled,
    (disabled) => {
      if (disabled) setOpen(false)
    }
  )

  return {
    id,
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
  }
}
