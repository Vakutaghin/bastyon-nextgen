// Блокировка прокрутки под окном — счётчиком: страница снова листается, когда
// закрылось последнее окно. Ширина полосы прокрутки — в переменную, чтобы
// страница не прыгала.

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SCROLL_LOCK_CLASS,
  lockScroll,
  resetScrollLockForTests,
  useScrollLock,
} from './scroll-lock'

const html = document.documentElement
const locked = (): boolean => html.classList.contains(SCROLL_LOCK_CLASS)

afterEach(() => resetScrollLockForTests())

describe('lockScroll', () => {
  it('держит, пока не снята последняя блокировка; повторное снятие не считается', () => {
    const first = lockScroll()
    const second = lockScroll()
    expect(locked()).toBe(true)
    first()
    first()
    expect(locked()).toBe(true)
    second()
    expect(locked()).toBe(false)
    expect(html.style.getPropertyValue('--ui-scroll-lock-gap')).toBe('')
  })

  it('ширина полосы прокрутки — в --ui-scroll-lock-gap', () => {
    const release = lockScroll()
    expect(html.style.getPropertyValue('--ui-scroll-lock-gap')).toMatch(/^\d+px$/)
    release()
  })
})

describe('useScrollLock', () => {
  it('по active и до снятия области', async () => {
    const active = ref(true)
    const scope = effectScope()
    scope.run(() => useScrollLock(active))
    expect(locked()).toBe(true)
    active.value = false
    await nextTick()
    expect(locked()).toBe(false)
    active.value = true
    await nextTick()
    scope.stop()
    expect(locked()).toBe(false)
  })
})
