// Окно чата на компьютере тянут за левый и верхний край и за левый верхний
// угол: не меньше исходных 360×500, не больше 60 % ширины и 80 % высоты окна
// приложения. Размер запоминается; окно приложения сузили — чат ужимается, а
// запомненный размер возвращается, когда место снова есть.

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'
import MessengerWindow from './messenger-window.vue'
import { clampWidgetSize, WIDGET_KEY_STEP, WIDGET_MIN_SIZE } from './use-widget-size'

const KEY = 'bastyon_messenger_widget_size'
let mounted: VueWrapper | null = null

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

function render(): VueWrapper {
  mounted = mount(MessengerWindow, {
    props: { isOpen: true, title: 'Алиса Морская' },
    global: { plugins: [i18n], provide: { theme: {} } },
    attachTo: document.body,
  })
  return mounted
}

function size(w: VueWrapper): { width: number; height: number } {
  const style = (w.element as HTMLElement).style
  return { width: parseFloat(style.width), height: parseFloat(style.height) }
}

function drag(w: VueWrapper, selector: string, from: [number, number], to: [number, number]) {
  const el = w.find(selector).element
  const at = ([clientX, clientY]: [number, number]) => ({
    clientX,
    clientY,
    pointerId: 1,
    button: 0,
  })
  el.dispatchEvent(new PointerEvent('pointerdown', { ...at(from), bubbles: true }))
  el.dispatchEvent(new PointerEvent('pointermove', { ...at(to), bubbles: true }))
  el.dispatchEvent(new PointerEvent('pointerup', { ...at(to), bubbles: true }))
  return w.vm.$nextTick()
}

const saved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  localStorage.clear()
  setViewport(1600, 1000)
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('размер окна чата', () => {
  it('по умолчанию — исходные 360×500', () => {
    expect(size(render())).toEqual(WIDGET_MIN_SIZE)
  })

  it('угол тянет обе стороны: влево и вверх — больше; размер запоминается', async () => {
    const w = render()
    await drag(w, '.resize-corner', [1000, 300], [800, 150])
    expect(size(w)).toEqual({ width: 560, height: 650 })
    expect(saved()).toEqual({ width: 560, height: 650 })

    w.unmount()
    mounted = null
    expect(size(render())).toEqual({ width: 560, height: 650 })
  })

  it('левый край двигает только ширину, верхний — только высоту', async () => {
    const w = render()
    await drag(w, '.left', [1000, 300], [900, 100])
    expect(size(w)).toEqual({ width: 460, height: 500 })
    await drag(w, '.top', [1000, 300], [900, 250])
    expect(size(w)).toEqual({ width: 460, height: 550 })
  })

  it('не больше 60 % ширины и 80 % высоты, не меньше исходного', async () => {
    const w = render()
    await drag(w, '.resize-corner', [1000, 300], [-5000, -5000])
    expect(size(w)).toEqual({ width: 960, height: 800 })
    await drag(w, '.resize-corner', [1000, 300], [9000, 9000])
    expect(size(w)).toEqual(WIDGET_MIN_SIZE)
  })

  it('окно приложения сузили — чат ужался; расширили — вернулся запомненный размер', async () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 900, height: 780 }))
    const w = render()
    expect(size(w)).toEqual({ width: 900, height: 780 })

    setViewport(1000, 700)
    await w.vm.$nextTick()
    expect(size(w)).toEqual({ width: 600, height: 560 })

    setViewport(1600, 1000)
    await w.vm.$nextTick()
    expect(size(w)).toEqual({ width: 900, height: 780 })
  })

  it('стрелки на ручке угла меняют размер, двойной щелчок возвращает исходный', async () => {
    const w = render()
    const corner = w.find('.resize-corner')
    expect(corner.attributes('tabindex')).toBe('0')
    expect(corner.attributes('aria-label')).toContain('изменить размер')

    await corner.trigger('keydown', { key: 'ArrowLeft' })
    await corner.trigger('keydown', { key: 'ArrowUp' })
    expect(size(w)).toEqual({
      width: WIDGET_MIN_SIZE.width + WIDGET_KEY_STEP,
      height: WIDGET_MIN_SIZE.height + WIDGET_KEY_STEP,
    })

    await corner.trigger('dblclick')
    expect(size(w)).toEqual(WIDGET_MIN_SIZE)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('на тесном экране побеждает исходный размер; битая запись — тоже исходный', () => {
    expect(clampWidgetSize({ width: 1000, height: 1000 }, { width: 500, height: 500 })).toEqual(
      WIDGET_MIN_SIZE
    )
    localStorage.setItem(KEY, '{oops')
    expect(size(render())).toEqual(WIDGET_MIN_SIZE)
  })

  it('длинное имя собеседника — целиком в подсказке заголовка', () => {
    const w = render()
    expect(w.find('[title="Алиса Морская"]').text()).toBe('Алиса Морская')
  })
})
