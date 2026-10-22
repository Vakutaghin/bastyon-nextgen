// Назад и вперёд с клавиатуры и кнопками мыши в приложении для компьютера:
// Cmd+[ и Cmd+] на Mac, Alt+← и Alt+→ на остальных. В браузере не слушаем —
// он ходит сам. На Windows WebView2 тоже может шагнуть сам — тогда не шагаем.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createRouter, createWebHistory, type Router } from 'vue-router'

const mocks = vi.hoisted(() => ({ desktop: true }))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))

import {
  NATIVE_STEP_WAIT_MS,
  historyShortcut,
  historyShortcutHint,
  mouseHistoryStep,
  useHistoryHotkeys,
} from './use-history-hotkeys'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('historyShortcut', () => {
  it('Mac: Cmd+[ и Cmd+] по месту клавиши — и в русской раскладке', () => {
    expect(historyShortcut(key({ metaKey: true, code: 'BracketLeft', key: '[' }), true)).toBe(
      'back'
    )
    expect(historyShortcut(key({ metaKey: true, code: 'BracketLeft', key: 'х' }), true)).toBe(
      'back'
    )
    expect(historyShortcut(key({ metaKey: true, code: 'BracketRight', key: 'ъ' }), true)).toBe(
      'forward'
    )
  })

  it('Windows и Linux: Alt+← и Alt+→', () => {
    expect(historyShortcut(key({ altKey: true, key: 'ArrowLeft' }), false)).toBe('back')
    expect(historyShortcut(key({ altKey: true, key: 'ArrowRight' }), false)).toBe('forward')
  })

  it('чужие сочетания, лишние модификаторы и автоповтор — мимо', () => {
    expect(historyShortcut(key({ altKey: true, key: 'ArrowLeft' }), true)).toBeNull()
    expect(historyShortcut(key({ metaKey: true, code: 'BracketLeft' }), false)).toBeNull()
    expect(historyShortcut(key({ key: 'ArrowLeft' }), false)).toBeNull()
    expect(historyShortcut(key({ altKey: true, shiftKey: true, key: 'ArrowLeft' }), false)).toBe(
      null
    )
    expect(historyShortcut(key({ altKey: true, ctrlKey: true, key: 'ArrowLeft' }), false)).toBe(
      null
    )
    expect(historyShortcut(key({ metaKey: true, altKey: true, code: 'BracketLeft' }), true)).toBe(
      null
    )
    expect(historyShortcut(key({ altKey: true, key: 'ArrowLeft', repeat: true }), false)).toBe(null)
  })
})

describe('mouseHistoryStep и подсказки', () => {
  it('боковые кнопки мыши — 3 назад, 4 вперёд; остальные мимо', () => {
    expect(mouseHistoryStep(3)).toBe('back')
    expect(mouseHistoryStep(4)).toBe('forward')
    expect([0, 1, 2].map(mouseHistoryStep)).toEqual([null, null, null])
  })

  it('подсказка — сочетание своей системы', () => {
    expect(historyShortcutHint('back', true)).toBe('⌘[')
    expect(historyShortcutHint('forward', true)).toBe('⌘]')
    expect(historyShortcutHint('back', false)).toBe('Alt+←')
    expect(historyShortcutHint('forward', false)).toBe('Alt+→')
  })
})

describe('useHistoryHotkeys', () => {
  const Page = { template: '<div />' }
  const Harness = defineComponent({
    setup() {
      useHistoryHotkeys(() => true)
      return () => null
    },
  })

  let router: Router
  let mounted: VueWrapper | null = null
  const ua = navigator.userAgent
  const platform = navigator.platform

  function setPlatform(userAgent: string, name: string): void {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
    Object.defineProperty(navigator, 'platform', { value: name, configurable: true })
  }

  async function render(): Promise<void> {
    mounted = mount(Harness, { global: { plugins: [router] } })
    await router.isReady()
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  async function settle(ms = 20): Promise<void> {
    await wait(ms)
    await flushPromises()
  }

  const altLeft = () =>
    window.dispatchEvent(key({ altKey: true, key: 'ArrowLeft', bubbles: true, cancelable: true }))

  beforeEach(async () => {
    mocks.desktop = true
    setPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15', 'Linux x86_64')
    window.history.replaceState(null, '', '/')
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/a', component: Page },
        { path: '/b', component: Page },
      ],
    })
    await router.push('/')
    await router.push('/a')
    await router.push('/b')
  })

  afterEach(() => {
    mounted?.unmount()
    mounted = null
    setPlatform(ua, platform)
  })

  it('Linux: Alt+← — назад, Alt+→ — вперёд, боковые кнопки мыши тоже', async () => {
    await render()
    expect(altLeft()).toBe(false) // preventDefault: браузерного шага нет
    await settle()
    expect(router.currentRoute.value.path).toBe('/a')

    window.dispatchEvent(key({ altKey: true, key: 'ArrowRight' }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/b')

    window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/a')
    window.dispatchEvent(new MouseEvent('mouseup', { button: 4 }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/b')
  })

  it('Mac: Cmd+[ — назад', async () => {
    setPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel')
    await render()
    window.dispatchEvent(key({ metaKey: true, code: 'BracketLeft', key: '[' }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/a')
  })

  it('в поле ввода клавиши остаются полю', async () => {
    await render()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(key({ altKey: true, key: 'ArrowLeft', bubbles: true }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/b')
    input.remove()
  })

  it('в браузере не слушаем: он ходит по истории сам', async () => {
    mocks.desktop = false
    await render()
    altLeft()
    window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }))
    await settle()
    expect(router.currentRoute.value.path).toBe('/b')
  })

  it('Windows: шагаем, только если WebView2 не шагнул сам', async () => {
    setPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/141', 'Win32')
    await render()

    // WebView2 промолчал — шаг делаем мы, выждав.
    altLeft()
    await settle()
    expect(router.currentRoute.value.path).toBe('/b')
    await settle(NATIVE_STEP_WAIT_MS)
    expect(router.currentRoute.value.path).toBe('/a')

    // WebView2 шагнул сам — второго шага нет.
    window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }))
    window.history.back()
    await settle(NATIVE_STEP_WAIT_MS + 30)
    expect(router.currentRoute.value.path).toBe('/')
  })
})
