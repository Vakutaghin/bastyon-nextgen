// Подсказка над полосой перемотки: у краёв прижимается по своей ширине — с
// названием главы она втрое шире одного времени и обрезалась краем ролика.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import ru from '@/locales/ru'
import PlayerProgress from './player-progress.vue'

let w: VueWrapper | null = null

function mountBar(chapters: { start: number; raw: string; label: string }[] = []) {
  w = mount(PlayerProgress, {
    props: {
      visible: true,
      mini: false,
      touch: false,
      progress: 0,
      buffered: '0%',
      duration: 100,
      currentTime: 0,
      chapterMarkers: [],
      chapters,
      formatTime: (s: number) => `0:${Math.round(s)}`,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'ru', messages: { ru } })] },
    attachTo: document.body,
  })
  w.element.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect
  return w
}

async function hover(bar: VueWrapper, x: number): Promise<string> {
  const event = new Event('pointermove') as Event & { pointerType: string; clientX: number }
  event.pointerType = 'mouse'
  event.clientX = x
  bar.element.dispatchEvent(event)
  await nextTick()
  await nextTick()
  return (bar.element as HTMLElement).style.getPropertyValue('--progress-tip')
}

afterEach(() => {
  w?.unmount()
  w = null
  vi.restoreAllMocks()
})

describe('подсказка перемотки', () => {
  it('прижимается к краям на половину своей ширины', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(255)
    const bar = mountBar([{ start: 0, raw: '0:00', label: 'Длинное название главы' }])
    expect(await hover(bar, 6)).toBe('clamp(128px, 1%, calc(100% - 128px))')
    expect(await hover(bar, 300)).toBe('clamp(128px, 50%, calc(100% - 128px))')
  })

  it('глава сменилась — ширина меряется заново; без раскладки — запас под время', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(0)
    const bar = mountBar([
      { start: 0, raw: '0:00', label: 'Первая' },
      { start: 50, raw: '0:50', label: 'Вторая, с названием длиннее' },
    ])
    expect(await hover(bar, 6)).toContain('clamp(40px')
    width.mockReturnValue(200)
    expect(await hover(bar, 400)).toContain('clamp(100px')
  })
})
