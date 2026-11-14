// Тосты: таймер, пауза под курсором и фокусом, обновление по ключу, хост в
// слое тостов над окнами (N32), крестик с подписью для диктора.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Z_INDEX } from '@/styles/design-tokens'
import { openLayers, resetLayersForTests } from '@/components/ui-core/layer-stack'
import { UI } from '@/components/testing/ui-selectors'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import {
  closeToast,
  holdToast,
  releaseToast,
  resetToastsForTests,
  showToast,
  toasts,
} from './toast-store'
import ToastHost from './toast-host.vue'
import type { ToastInput } from './types'

const base: ToastInput = {
  type: 'info',
  message: 'Привет',
  duration: 4.5,
  placement: 'bottomLeft',
  closable: true,
}

const mounted: VueWrapper[] = []

function mountHost(): VueWrapper {
  const w = mount(ToastHost, { attachTo: document.body })
  mounted.push(w)
  return w
}

function q(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)]
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  resetToastsForTests()
  resetLayersForTests()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('хранилище тостов', () => {
  it('без ключа даёт свой; тост закрывается по таймеру', () => {
    const key = showToast(base)
    expect(key).toMatch(/^ui-toast-/)
    vi.advanceTimersByTime(4499)
    expect(toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts).toHaveLength(0)
  })

  it('duration 0 — пока не закроют', () => {
    const key = showToast({ ...base, duration: 0 })
    vi.advanceTimersByTime(600_000)
    expect(toasts).toHaveLength(1)
    closeToast(key)
    expect(toasts).toHaveLength(0)
  })

  it('обновление по ключу начинает отсчёт заново', () => {
    showToast({ ...base, key: 'k' })
    vi.advanceTimersByTime(4000)
    showToast({ ...base, key: 'k', message: 'Ещё раз' })
    vi.advanceTimersByTime(4000)
    expect(toasts.map((t) => t.message)).toEqual(['Ещё раз'])
    vi.advanceTimersByTime(500)
    expect(toasts).toHaveLength(0)
  })

  it('пока держат (курсор и фокус), не закрывается; отпустили все — полный отсчёт', () => {
    const key = showToast(base)
    vi.advanceTimersByTime(4000)
    holdToast(key, 'hover')
    holdToast(key, 'focus')
    vi.advanceTimersByTime(60_000)
    releaseToast(key, 'hover')
    vi.advanceTimersByTime(60_000)
    expect(toasts).toHaveLength(1)
    releaseToast(key, 'focus')
    vi.advanceTimersByTime(4499)
    expect(toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts).toHaveLength(0)
  })

  it('отпустить того, кто не держал, — ничего не меняет', () => {
    const key = showToast(base)
    vi.advanceTimersByTime(4000)
    releaseToast(key, 'hover')
    vi.advanceTimersByTime(500)
    expect(toasts).toHaveLength(0)
  })
})

describe('ToastHost', () => {
  it('рисует тосты в слое тостов над окнами, по своим местам', async () => {
    mountHost()
    expect(openLayers()).toHaveLength(0)
    showToast({ ...base, message: 'Снизу' })
    showToast({ ...base, message: 'Сверху', placement: 'top' })
    await nextTick()
    expect(openLayers().map((l) => [l.kind, l.zIndex])).toEqual([['toast', Z_INDEX.TOAST]])
    const host = q(UI.toastHost)[0]!
    expect(host.parentElement?.id).toBe('ui-layers')
    const lists = q('.ui-toast-list')
    expect(lists.map((l) => [l.dataset.placement, l.textContent?.trim()])).toEqual([
      ['top', 'Сверху'],
      ['bottomLeft', 'Снизу'],
    ])
    resetToastsForTests()
    await nextTick()
    expect(openLayers()).toHaveLength(0)
  })

  it('вид, заголовок, описание; крестик с подписью закрывает тост', async () => {
    mountHost()
    showToast({ ...base, type: 'error', message: 'Не вышло', description: 'Нет сети' })
    await nextTick()
    const toast = q(UI.toast)[0]!
    expect(toast.dataset.type).toBe('error')
    expect(toast.querySelector('.ui-toast__icon')).not.toBeNull()
    expect(toast.querySelector('.ui-toast__message')?.textContent).toBe('Не вышло')
    expect(toast.querySelector('.ui-toast__description')?.textContent).toBe('Нет сети')
    const close = toast.querySelector<HTMLButtonElement>(UI.toastClose)!
    expect(close.type).toBe('button')
    expect(close.getAttribute('aria-label')).toBe('common.close')
    close.click()
    expect(toasts).toHaveLength(0)
  })

  it('без описания — без его блока; тост загрузки — без крестика', async () => {
    mountHost()
    showToast({ ...base, type: 'loading', duration: 0, closable: false })
    await nextTick()
    const toast = q(UI.toast)[0]!
    expect(toast.querySelector('.ui-toast__description')).toBeNull()
    expect(toast.querySelector(UI.toastClose)).toBeNull()
  })

  it('нажатие на тост зовёт onClick и тост не закрывает; крестик onClick не зовёт', async () => {
    mountHost()
    const onClick = vi.fn()
    showToast({ ...base, onClick })
    await nextTick()
    const toast = q(UI.toast)[0]!
    expect(toast.hasAttribute('data-clickable')).toBe(true)
    toast.querySelector<HTMLElement>('.ui-toast__message')!.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveLength(1)
    toast.querySelector<HTMLElement>(UI.toastClose)!.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveLength(0)
  })

  it('курсор на тосте и фокус на крестике держат его открытым', async () => {
    mountHost()
    showToast(base)
    await nextTick()
    const toast = q(UI.toast)[0]!
    toast.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(10_000)
    expect(toasts).toHaveLength(1)
    toast.querySelector<HTMLElement>(UI.toastClose)!.focus()
    toast.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(10_000)
    expect(toasts).toHaveLength(1)
    toast.querySelector<HTMLElement>(UI.toastClose)!.blur()
    vi.advanceTimersByTime(4500)
    expect(toasts).toHaveLength(0)
  })
})
