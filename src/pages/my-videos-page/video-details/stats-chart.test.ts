// Подсказка графика: над точкой, у верхнего края — под ней; за боковые края не
// вылезает, какой бы ширины ни была.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import ru from '@/locales/ru'
import StatsChart from './stats-chart.vue'

let w: VueWrapper | null = null
const TIP = { width: 160, height: 48 }

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(TIP.width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(TIP.height)
})

afterEach(() => {
  w?.unmount()
  w = null
  vi.restoreAllMocks()
})

const points = (values: number[]) =>
  values.map((value, i) => ({ x: i, label: `${i + 1} ноября`, value }))

/** Положение подсказки у точки `index` (Home и стрелки — как с клавиатуры). */
async function tipAt(values: number[], index: number): Promise<{ x: number; y: number }> {
  w = mount(StatsChart, {
    props: {
      kind: 'columns',
      points: points(values),
      title: 'Просмотры',
      columnLabel: 'День',
      valueLabel: 'Просмотры',
      formatValue: String,
      formatTick: String,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } })] },
    attachTo: document.body,
  })
  const plot = w.find('[role="img"]')
  await plot.trigger('keydown', { key: 'Home' })
  for (let i = 0; i < index; i++) await plot.trigger('keydown', { key: 'ArrowRight' })
  await nextTick()
  await nextTick()
  return (w.vm as unknown as { tooltipAt: { x: number; y: number } }).tooltipAt
}

describe('подсказка графика', () => {
  it('у верхнего края — под точкой, у низкого столбика — над ним', async () => {
    const high = await tipAt([100, 1], 0)
    expect(high.y).toBeGreaterThan(0)
    w!.unmount()
    const low = await tipAt([100, 1], 1)
    expect(low.y).toBeGreaterThan(high.y)
    expect(low.y).toBeLessThan(220 - TIP.height)
  })

  it('у боковых краёв прижимается на половину своей ширины', async () => {
    const values = Array.from({ length: 30 }, (_, i) => i)
    expect((await tipAt(values, 0)).x).toBe(TIP.width / 2)
    w!.unmount()
    expect((await tipAt(values, 29)).x).toBe(600 - TIP.width / 2)
  })
})
