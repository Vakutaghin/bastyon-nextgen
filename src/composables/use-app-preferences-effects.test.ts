// Масштаб в десктопе: Cmd/Ctrl и +, − или 0 шагают по масштабам из настроек и
// сохраняют выбор, а щипок на тачпаде (колесо с Ctrl, жест WebKit) масштаб не
// меняет. В браузере приложение масштабом не распоряжается.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  tauri: false,
  setZoom: vi.fn(async (_value: number) => {}),
  saved: vi.fn(async (_key: string, _value: unknown) => {}),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.tauri,
}))
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ setZoom: mocks.setZoom }),
}))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: { get: async () => null, set: mocks.saved },
}))

import {
  resetAppPreferencesEffectsForTests,
  setupAppPreferences,
  stepUiScale,
  zoomShortcutStep,
} from './use-app-preferences-effects'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { cancelable: true, ...init })

/** Колесо; щипок на тачпаде вебвью присылает так же, но с Ctrl. */
function wheel(ctrlKey: boolean): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY: ctrlKey ? -3 : 40, cancelable: true })
  // happy-dom не берёт ctrlKey из параметров WheelEvent.
  Object.defineProperty(event, 'ctrlKey', { value: ctrlKey })
  return event
}

describe('stepUiScale', () => {
  it('шагает по масштабам из настроек и не выходит за 80…150 %', () => {
    expect(stepUiScale(100, 1)).toBe(110)
    expect(stepUiScale(110, 1)).toBe(125)
    expect(stepUiScale(150, 1)).toBe(150)
    expect(stepUiScale(100, -1)).toBe(90)
    expect(stepUiScale(80, -1)).toBe(80)
    expect(stepUiScale(125, 0)).toBe(100)
  })

  it('от масштаба не из списка — к ближайшему в нужную сторону', () => {
    expect(stepUiScale(105, 1)).toBe(110)
    expect(stepUiScale(105, -1)).toBe(100)
  })
})

describe('zoomShortcutStep', () => {
  it('на Mac — Cmd, на остальных — Ctrl', () => {
    expect(zoomShortcutStep(key({ metaKey: true, code: 'Equal', key: '=' }), true)).toBe(1)
    expect(zoomShortcutStep(key({ ctrlKey: true, code: 'Equal', key: '=' }), true)).toBeNull()
    expect(zoomShortcutStep(key({ ctrlKey: true, code: 'Minus', key: '-' }), false)).toBe(-1)
    expect(zoomShortcutStep(key({ metaKey: true, code: 'Minus', key: '-' }), false)).toBeNull()
  })

  it('+ с Shift, цифровой блок и 0 — тоже масштаб; с Alt и без модификатора — нет', () => {
    expect(
      zoomShortcutStep(key({ metaKey: true, shiftKey: true, code: 'Equal', key: '+' }), true)
    ).toBe(1)
    expect(zoomShortcutStep(key({ ctrlKey: true, code: 'NumpadAdd', key: '+' }), false)).toBe(1)
    expect(zoomShortcutStep(key({ ctrlKey: true, code: 'NumpadSubtract', key: '-' }), false)).toBe(
      -1
    )
    expect(zoomShortcutStep(key({ metaKey: true, code: 'Digit0', key: '0' }), true)).toBe(0)
    expect(
      zoomShortcutStep(key({ metaKey: true, altKey: true, code: 'Equal', key: '=' }), true)
    ).toBeNull()
    expect(zoomShortcutStep(key({ code: 'Equal', key: '=' }), true)).toBeNull()
    expect(zoomShortcutStep(key({ metaKey: true, code: 'KeyZ', key: 'z' }), true)).toBeNull()
  })

  it('клавиша с другим местом, но символом + — всё равно крупнее', () => {
    expect(zoomShortcutStep(key({ metaKey: true, code: 'BracketRight', key: '+' }), true)).toBe(1)
  })
})

describe('setupAppPreferences: масштаб в десктопе', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAppPreferencesEffectsForTests()
    mocks.setZoom.mockClear()
    mocks.saved.mockClear()
    vi.stubGlobal('navigator', { ...navigator, platform: 'MacIntel' })
  })

  it('в браузере клавиши и щипок не трогаем — это масштаб браузера', async () => {
    mocks.tauri = false
    await setupAppPreferences()
    const press = key({ metaKey: true, code: 'Equal', key: '=' })
    window.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(false)
    const pinch = wheel(true)
    window.dispatchEvent(pinch)
    expect(pinch.defaultPrevented).toBe(false)
    expect(mocks.setZoom).not.toHaveBeenCalled()
  })

  it('Cmd + и Cmd − меняют масштаб и сохраняют его, щипок — нет', async () => {
    mocks.tauri = true
    await setupAppPreferences()
    const prefs = useAppPreferencesStore()
    await vi.waitFor(() => expect(mocks.setZoom).toHaveBeenLastCalledWith(1))

    const press = key({ metaKey: true, code: 'Equal', key: '=' })
    window.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(mocks.setZoom).toHaveBeenLastCalledWith(1.1))
    expect(prefs.uiScale).toBe(110)
    expect(mocks.saved).toHaveBeenLastCalledWith(
      'appPreferences',
      expect.objectContaining({ uiScale: 110 })
    )

    window.dispatchEvent(key({ metaKey: true, code: 'Minus', key: '-' }))
    window.dispatchEvent(key({ metaKey: true, code: 'Minus', key: '-' }))
    await vi.waitFor(() => expect(mocks.setZoom).toHaveBeenLastCalledWith(0.9))

    window.dispatchEvent(key({ metaKey: true, code: 'Digit0', key: '0' }))
    await vi.waitFor(() => expect(prefs.uiScale).toBe(100))

    // Щипок: колесо с Ctrl и жест WebKit гасятся, обычная прокрутка — нет.
    const zoomCalls = mocks.setZoom.mock.calls.length
    const pinch = wheel(true)
    window.dispatchEvent(pinch)
    expect(pinch.defaultPrevented).toBe(true)
    const scroll = wheel(false)
    window.dispatchEvent(scroll)
    expect(scroll.defaultPrevented).toBe(false)
    const gesture = new Event('gesturechange', { cancelable: true })
    document.dispatchEvent(gesture)
    expect(gesture.defaultPrevented).toBe(true)
    expect(mocks.setZoom.mock.calls.length).toBe(zoomCalls)
  })
})
