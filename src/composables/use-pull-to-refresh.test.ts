// Обновление протягиванием: кружок идёт за пальцем вполовину и тормозит у
// края; тянуть можно только вниз, с самого верха и внутри ленты; отпустили
// дальше порога — обновление, кружок крутится, пока оно идёт (не меньше
// PULL_MIN_SPIN_MS); короче порога, вбок или в прокрученной ленте — ничего.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  PULL_MAX,
  PULL_MIN_SPIN_MS,
  PULL_SLOP,
  PULL_THRESHOLD,
  pullIntent,
  pullOffset,
  usePullToRefresh,
  type PullToRefresh,
} from './use-pull-to-refresh'

describe('pullOffset', () => {
  it('до порога — половина пути пальца', () => {
    expect(pullOffset(-10)).toBe(0)
    expect(pullOffset(0)).toBe(0)
    expect(pullOffset(40)).toBe(20)
    expect(pullOffset(PULL_THRESHOLD * 2)).toBe(PULL_THRESHOLD)
  })

  it('за порогом тормозит и не уходит дальше PULL_MAX', () => {
    const a = pullOffset(PULL_THRESHOLD * 2 + 40)
    const b = pullOffset(PULL_THRESHOLD * 2 + 80)
    expect(a).toBeGreaterThan(PULL_THRESHOLD)
    expect(b).toBeGreaterThan(a)
    expect(b - a).toBeLessThan(20)
    expect(pullOffset(5_000)).toBeLessThanOrEqual(PULL_MAX)
  })
})

describe('pullIntent', () => {
  it('пока палец в пределах PULL_SLOP — не ясно', () => {
    expect(pullIntent(3, PULL_SLOP - 1, 0)).toBe('undecided')
  })

  it('вниз с самого верха — тянут; вбок, вверх или лента прокручена — нет', () => {
    expect(pullIntent(4, 30, 0)).toBe('pull')
    expect(pullIntent(40, 30, 0)).toBe('other')
    expect(pullIntent(0, -30, 0)).toBe('other')
    expect(pullIntent(0, 30, 120)).toBe('other')
  })
})

/** Касание одним пальцем: в happy-dom нет конструктора Touch. */
function touch(type: string, target: EventTarget, y: number, x = 100, fingers = 1): void {
  const event = new Event(type, { bubbles: true })
  const points = Array.from({ length: fingers }, () => ({ clientX: x, clientY: y, target }))
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : points })
  target.dispatchEvent(event)
}

function mountFeed(options: { refresh?: () => Promise<unknown>; disabled?: () => boolean } = {}) {
  const refresh = vi.fn(options.refresh ?? (() => Promise.resolve()))
  let pull!: PullToRefresh
  const root = ref<HTMLElement | null>(null)
  const wrapper = mount(
    defineComponent({
      setup() {
        pull = usePullToRefresh({ root, refresh, disabled: options.disabled })
        return () => h('div', [h('section', { ref: root }, [h('p', 'пост')]), h('aside', 'окно')])
      },
    }),
    { attachTo: document.body }
  )
  const post = wrapper.find('p').element
  const outside = wrapper.find('aside').element
  return { wrapper, pull, refresh, post, outside }
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.scrollY = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    window.scrollY = 0
  })

  it('протянули дальше порога — обновление; кружок крутится до конца и не меньше PULL_MIN_SPIN_MS', async () => {
    let finish!: () => void
    const { pull, refresh, post, wrapper } = mountFeed({
      refresh: () => new Promise<void>((resolve) => (finish = resolve)),
    })
    touch('touchstart', post, 100)
    touch('touchmove', post, 120)
    touch('touchmove', post, 100 + PULL_SLOP + PULL_THRESHOLD * 2 + 20)
    expect(pull.armed.value).toBe(true)

    touch('touchend', post, 0)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(pull.refreshing.value).toBe(true)
    expect(pull.offset.value).toBe(PULL_THRESHOLD)

    // Ответ пришёл сразу — кружок всё равно крутится PULL_MIN_SPIN_MS.
    finish()
    await vi.advanceTimersByTimeAsync(PULL_MIN_SPIN_MS - 50)
    expect(pull.refreshing.value).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(pull.refreshing.value).toBe(false)
    expect(pull.offset.value).toBe(0)
    wrapper.unmount()
  })

  it('отпустили до порога — без обновления, кружок уходит', () => {
    const { pull, refresh, post, wrapper } = mountFeed()
    touch('touchstart', post, 100)
    touch('touchmove', post, 100 + PULL_SLOP + 40)
    expect(pull.offset.value).toBe(20)
    expect(pull.armed.value).toBe(false)
    touch('touchend', post, 0)
    expect(refresh).not.toHaveBeenCalled()
    expect(pull.offset.value).toBe(0)
    wrapper.unmount()
  })

  it('лента прокручена, жест вбок, два пальца, касание вне ленты, оверлей — не тянется', () => {
    const disabled = ref(false)
    const { pull, refresh, post, outside, wrapper } = mountFeed({ disabled: () => disabled.value })
    const far = 100 + PULL_SLOP + PULL_THRESHOLD * 3

    window.scrollY = 300
    touch('touchstart', post, 100)
    touch('touchmove', post, far)
    window.scrollY = 0

    touch('touchstart', post, 100, 100)
    touch('touchmove', post, 130, 200)
    touch('touchmove', post, far, 200)

    touch('touchstart', post, 100, 100, 2)
    touch('touchmove', post, far, 100, 2)

    touch('touchstart', outside, 100)
    touch('touchmove', outside, far)

    disabled.value = true
    touch('touchstart', post, 100)
    touch('touchmove', post, far)

    expect(pull.offset.value).toBe(0)
    touch('touchend', post, 0)
    expect(refresh).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('после размонтирования касания не слушает', () => {
    const { pull, post, wrapper } = mountFeed()
    wrapper.unmount()
    touch('touchstart', post, 100)
    touch('touchmove', post, 400)
    expect(pull.offset.value).toBe(0)
  })
})
