// Календарь: границы «только будущее», сетка и подписи по языку, поле и
// панель — выбор дня с временем через «ОК», без времени — сразу, очистка,
// клавиатура по APG, недоступные дни.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import dayjs from 'dayjs'
import { resetLayersForTests } from '@/components/ui-core/layer-stack'
import { UI } from '@/components/testing/ui-selectors'
import { i18n } from '@/i18n'

vi.mock('@floating-ui/dom', () => ({
  autoUpdate: () => () => {},
  computePosition: async () => ({ x: 10, y: 20, placement: 'bottom-start' }),
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}))

import DateTimePicker from './date-time-picker.vue'
import { firstAllowedMinute, minuteLimits } from './limits'
import { WEEK_START, formatField, monthGrid, monthTitle, weekdayNames } from './calendar'

describe('границы календаря', () => {
  it('первая допустимая минута — следующая целая после «сейчас»', () => {
    const now = dayjs('2026-09-28T14:30:25').unix()
    expect(firstAllowedMinute(now).format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-28 14:31:00')
    // В 23:59 — уже следующий день.
    const late = dayjs('2026-09-28T23:59:10').unix()
    expect(firstAllowedMinute(late).format('YYYY-MM-DD HH:mm')).toBe('2026-09-29 00:00')
  })

  it('сегодня выключены прошедшие часы и минуты, в другие дни — ничего', () => {
    const first = dayjs('2026-09-28T14:31:00')
    const today = minuteLimits(dayjs('2026-09-28T09:00'), first)
    expect(today.hours).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(today.minutes(13)).toHaveLength(60)
    expect(today.minutes(14)).toEqual([...Array(31).keys()])
    expect(today.minutes(15)).toEqual([])
    const tomorrow = minuteLimits(dayjs('2026-09-29T09:00'), first)
    expect(tomorrow.hours).toEqual([])
    expect(tomorrow.minutes(14)).toEqual([])
    expect(minuteLimits(null, first).hours).toEqual([])
  })
})

describe('сетка и подписи', () => {
  it('6 недель с начала недели первого числа; неделя — с понедельника или воскресенья', () => {
    const november = dayjs('2026-11-01')
    const ru = monthGrid(november, WEEK_START.ru)
    expect(ru).toHaveLength(42)
    expect(ru[0]!.format('YYYY-MM-DD')).toBe('2026-10-26')
    expect(ru[0]!.day()).toBe(1)
    const en = monthGrid(november, WEEK_START.en)
    expect(en[0]!.format('YYYY-MM-DD')).toBe('2026-11-01')
    expect(WEEK_START.kr).toBe(0)
  })

  it('названия по языку: русский и сербский кириллицей, заголовок без « г.»', () => {
    expect(weekdayNames('ru', 1).map((d) => d.short)).toEqual([
      'пн',
      'вт',
      'ср',
      'чт',
      'пт',
      'сб',
      'вс',
    ])
    expect(weekdayNames('en', 0)[0]!.long).toBe('Sunday')
    expect(monthTitle(dayjs('2026-11-10'), 'ru')).toBe('нояб. 2026')
    expect(monthTitle(dayjs('2026-12-10'), 'sr')).toMatch(/^дец/)
    expect(monthTitle(dayjs('2026-11-10'), 'kr')).toMatch(/2026/)
    // Хвост после месяца — часть названия.
    expect(monthTitle(dayjs('2026-11-10'), 'zh')).toBe('2026年11月')
  })

  it('поле: с временем — без текущего года, без времени — с годом', () => {
    const value = dayjs(`${dayjs().year()}-09-29T11:00`)
    expect(formatField(value, 'ru', true)).toMatch(/^29 сент\., 11:00$/)
    expect(formatField(dayjs('2030-01-05T10:30'), 'ru', true)).toMatch(/5 янв\. 2030.*10:30/)
    expect(formatField(dayjs('2026-11-05'), 'ru', false)).toMatch(/^5 нояб\. 2026/)
  })
})

const mounted: VueWrapper[] = []

function mountPicker(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  const w = mount(DateTimePicker, {
    props: { value: 0, placeholder: 'Сразу', id: 'when', ...props },
    attrs,
    attachTo: document.body,
  })
  mounted.push(w)
  const trigger = w.find<HTMLButtonElement>('.ui-date-picker__trigger').element
  return { w, trigger }
}

const panel = (): HTMLElement | null => document.querySelector('.ui-date-panel')
const day = (n: number): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('.ui-date-panel__day:not([data-outside])')].find(
    (el) => el.textContent?.trim() === String(n)
  )!
const timeCell = (kind: 'hour' | 'minute', n: number): HTMLElement =>
  document.querySelector<HTMLElement>(
    `.ui-date-panel__column[data-kind="${kind}"] [data-value="${n}"]`
  )!

function key(el: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  el.dispatchEvent(event)
  return event
}

describe('DateTimePicker', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'ru'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-16T10:20:00'))
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    resetLayersForTests()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('показывает выбранный момент по правилам языка; пусто — подсказка; id — на поле', async () => {
    const { w, trigger } = mountPicker({ value: dayjs('2030-01-05T10:30').unix() })
    expect(trigger.id).toBe('when')
    expect(w.find('.ui-date-picker__value').text()).toMatch(/5 янв\. 2030.*10:30/)
    await w.setProps({ value: 0 })
    expect(w.find('.ui-date-picker__placeholder').text()).toBe('Сразу')
    expect(w.element.matches(UI.datePicker)).toBe(true)
  })

  it('с временем: день — черновик в поле, «ОК» фиксирует, ближайший целый час', async () => {
    const onChange = vi.fn()
    const { w, trigger } = mountPicker({ future: true }, { onChange })
    trigger.click()
    await nextTick()
    expect(panel()).not.toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    // Прошлые дни недоступны, сегодня отмечен.
    expect(day(15).getAttribute('aria-disabled')).toBe('true')
    expect(day(16).hasAttribute('data-today')).toBe(true)
    day(20).click()
    await nextTick()
    expect(w.find('.ui-date-picker__value').text()).toMatch(/^20 нояб\., 11:00$/)
    expect(onChange).not.toHaveBeenCalled()
    expect(timeCell('hour', 11).getAttribute('aria-selected')).toBe('true')
    timeCell('minute', 45).click()
    await nextTick()
    ;(document.querySelector('.ui-date-panel__ok') as HTMLButtonElement).click()
    await nextTick()
    expect(onChange).toHaveBeenCalledWith(dayjs('2026-11-20T11:45').unix())
    expect(panel()).toBeNull()
  })

  it('сегодня: прошедшие часы выключены; время раньше допустимого «ОК» поднимает', async () => {
    const onChange = vi.fn()
    const { trigger } = mountPicker({ future: true }, { onChange })
    trigger.click()
    await nextTick()
    day(16).click()
    await nextTick()
    expect(timeCell('hour', 9).getAttribute('aria-disabled')).toBe('true')
    expect(timeCell('hour', 10).hasAttribute('aria-disabled')).toBe(false)
    timeCell('hour', 10).click()
    await nextTick()
    expect(timeCell('minute', 20).getAttribute('aria-disabled')).toBe('true')
    ;(document.querySelector('.ui-date-panel__ok') as HTMLButtonElement).click()
    // 10:00 сегодня уже прошло — первое допустимое, 10:21.
    expect(onChange).toHaveBeenCalledWith(dayjs('2026-11-16T10:21').unix())
  })

  it('нажатие мимо (dismiss) отбрасывает черновик', async () => {
    const onChange = vi.fn()
    const { w, trigger } = mountPicker({}, { onChange })
    trigger.click()
    await nextTick()
    day(20).click()
    await nextTick()
    key(document.body, 'Escape')
    await nextTick()
    expect(panel()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(w.find('.ui-date-picker__placeholder').text()).toBe('Сразу')
  })

  it('без времени: день выбирается сразу, началом дня; «Сегодня»; min и max', async () => {
    const onChange = vi.fn()
    const { trigger } = mountPicker(
      {
        showTime: false,
        value: dayjs('2026-11-10').unix(),
        min: dayjs('2026-11-03').unix(),
        max: dayjs('2026-11-16T09:00').unix(),
      },
      { onChange }
    )
    trigger.click()
    await nextTick()
    expect(day(10).hasAttribute('data-selected')).toBe(true)
    expect(day(2).getAttribute('aria-disabled')).toBe('true')
    expect(day(17).getAttribute('aria-disabled')).toBe('true')
    expect(document.querySelector('.ui-date-panel__column')).toBeNull()
    day(17).click()
    expect(onChange).not.toHaveBeenCalled()
    day(5).click()
    await nextTick()
    expect(onChange).toHaveBeenLastCalledWith(dayjs('2026-11-05').unix())
    expect(panel()).toBeNull()
    trigger.click()
    await nextTick()
    ;(document.querySelector('.ui-date-panel__today') as HTMLButtonElement).click()
    expect(onChange).toHaveBeenLastCalledWith(dayjs('2026-11-16').unix())
  })

  it('клавиатура: стрелки, PageDown, Enter; ↓ в поле открывает', async () => {
    const onChange = vi.fn()
    const { trigger } = mountPicker(
      { showTime: false, value: dayjs('2026-11-10').unix() },
      { onChange }
    )
    trigger.focus()
    expect(key(trigger, 'ArrowDown').defaultPrevented).toBe(true)
    await nextTick()
    const grid = document.querySelector('.ui-date-panel__grid')!
    const focused = (): string | undefined =>
      document.querySelector('.ui-date-panel__day[tabindex="0"]')?.getAttribute('aria-label') ??
      undefined
    expect(focused()).toMatch(/10 ноября 2026/)
    key(grid, 'ArrowRight')
    await nextTick()
    expect(focused()).toMatch(/11 ноября/)
    key(grid, 'ArrowDown')
    await nextTick()
    expect(focused()).toMatch(/18 ноября/)
    key(grid, 'PageDown')
    await nextTick()
    expect(focused()).toMatch(/18 декабря 2026/)
    expect(document.querySelector('.ui-date-panel__title')?.textContent?.trim()).toBe('дек. 2026')
    key(grid, 'PageUp', { shiftKey: true })
    await nextTick()
    expect(focused()).toMatch(/18 декабря 2025/)
    ;(document.querySelector('.ui-date-panel__day[tabindex="0"]') as HTMLButtonElement).click()
    expect(onChange).toHaveBeenCalledWith(dayjs('2025-12-18').unix())
  })

  it('крестик и Delete очищают; без allowClear — нет', async () => {
    const onChange = vi.fn()
    const { w, trigger } = mountPicker({ value: dayjs('2026-11-20T11:00').unix() }, { onChange })
    expect(w.element.hasAttribute('data-clearable')).toBe(true)
    await w.find('.ui-date-picker__clear').trigger('click')
    expect(onChange).toHaveBeenLastCalledWith(0)
    key(trigger, 'Delete')
    expect(onChange).toHaveBeenCalledTimes(2)
    await w.setProps({ allowClear: false })
    expect(w.find('.ui-date-picker__clear').exists()).toBe(false)
    key(trigger, 'Delete')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('выключенное: data-disabled, не открывается', async () => {
    const { w, trigger } = mountPicker({ disabled: true, value: dayjs('2026-11-20').unix() })
    expect(w.element.matches(UI.datePickerDisabled)).toBe(true)
    expect(trigger.disabled).toBe(true)
    expect(w.find('.ui-date-picker__clear').exists()).toBe(false)
    key(trigger, 'ArrowDown')
    await nextTick()
    expect(panel()).toBeNull()
  })

  it('у панели имя из <label for>; Tab ходит по кругу', async () => {
    const label = document.createElement('label')
    label.htmlFor = 'when'
    label.textContent = 'Отложить публикацию'
    document.body.append(label)
    const { trigger } = mountPicker({ showTime: false, value: dayjs('2026-11-10').unix() })
    trigger.click()
    await nextTick()
    const el = panel()!
    expect(el.getAttribute('role')).toBe('dialog')
    expect(el.getAttribute('aria-label')).toBe('Отложить публикацию')
    const today = document.querySelector<HTMLButtonElement>('.ui-date-panel__today')!
    today.focus()
    const tab = key(today, 'Tab')
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement?.getAttribute('data-nav')).toBe('super-prev')
  })
})
