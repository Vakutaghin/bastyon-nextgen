import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import generateConfig from 'ant-design-vue/es/vc-picker/generate/dayjs'

import { i18n, SUPPORTED_LOCALES } from '@/i18n'
import DateTimePicker from './date-time-picker.vue'
import { firstAllowedMinute, minuteLimits } from './limits'
import { loadPickerLocale } from './picker-locale'

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

describe('язык календаря', () => {
  const december = dayjs('2026-12-15T12:00')
  const monthIn = async (lang: (typeof SUPPORTED_LOCALES)[number]): Promise<string> => {
    const locale = await loadPickerLocale(lang)
    return generateConfig.locale.format(locale.lang.locale, december, 'MMMM')
  }

  it.each(SUPPORTED_LOCALES.filter((l) => l !== 'en'))(
    '%s: названия месяцев не английские — локаль dayjs загружена',
    async (lang) => {
      expect(await monthIn(lang)).not.toBe('December')
    }
  )

  it('русский и сербский кириллицей', async () => {
    expect(await monthIn('ru')).toBe('декабрь')
    expect(await monthIn('sr')).toMatch(/^[Дд]ецембар$/)
    const sr = await loadPickerLocale('sr')
    expect(sr.lang.now).toBe('Сада')
    expect(sr.lang.ok).toBe('У реду')
  })
})

describe('DateTimePicker', () => {
  it('показывает выбранный момент по правилам языка интерфейса', async () => {
    i18n.global.locale.value = 'ru'
    const value = dayjs('2030-01-05T10:30').unix()
    const w = mount(DateTimePicker, {
      props: { value, placeholder: 'Сразу', id: 'when' },
      global: { plugins: [i18n], provide: { theme: {} } },
    })
    await flushPromises()
    await flushPromises()
    const input = w.find('input#when')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toMatch(/5 янв\. 2030.*10:30/)
    await w.setProps({ value: 0 })
    expect((w.find('input#when').element as HTMLInputElement).value).toBe('')
    expect(w.find('input#when').attributes('placeholder')).toBe('Сразу')
    w.unmount()
  })
})
