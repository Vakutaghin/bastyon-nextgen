// Системная «Назад» на Android: обработчики стопкой — верхний первым, взял —
// дальше не идёт; окно antd закрывается Esc, если открыто позже верхнего
// обработчика; никто не взял — назад по истории роутера, на первой странице
// приложение сворачивается (не закрывается).

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ name: 'android' }))
const listeners = vi.hoisted(() => [] as Array<(event: { canGoBack: boolean }) => void>)
const minimizeApp = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.name } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, cb: (event: { canGoBack: boolean }) => void) => {
      listeners.push(cb)
      return { remove: vi.fn() }
    }),
    minimizeApp,
  },
}))

import {
  BACK_IGNORED_CLASS,
  handleBack,
  pushBackHandler,
  resetBackHandlersForTests,
  setupBackButton,
  useCloseOnBack,
} from './use-back-button'

/** Открытое окно antd с полем в фокусе; escapes — сколько Esc оно получило. */
function openDialog(className = ''): {
  wrap: HTMLElement
  input: HTMLInputElement
  escapes: number[]
} {
  const wrap = document.createElement('div')
  wrap.className = `ant-modal-wrap ${className}`.trim()
  wrap.getClientRects = () => ({ length: 1 }) as unknown as DOMRectList
  const modal = document.createElement('div')
  modal.className = 'ant-modal'
  const input = document.createElement('input')
  modal.append(input)
  wrap.append(modal)
  document.body.append(wrap)
  const escapes: number[] = []
  wrap.addEventListener('keydown', (e) => {
    if (e.keyCode === 27) escapes.push(e.keyCode)
  })
  input.focus()
  return { wrap, input, escapes }
}

const later = () => new Promise((resolve) => setTimeout(resolve, 5))
/** Нажать «Назад» — последний добавленный слушатель Capacitor. */
const pressBack = (canGoBack: boolean) => listeners[listeners.length - 1]!({ canGoBack })

describe('use-back-button', () => {
  beforeEach(() => {
    resetBackHandlersForTests()
    listeners.length = 0
    platform.name = 'android'
    document.body.innerHTML = ''
    window.history.replaceState(null, '')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('верхний обработчик первым; взял — нижние не спрашиваются', () => {
    const calls: string[] = []
    pushBackHandler(() => {
      calls.push('chat')
      return true
    })
    pushBackHandler(() => {
      calls.push('picture')
      return true
    })
    expect(handleBack()).toBe(true)
    expect(calls).toEqual(['picture'])
  })

  it('не взял — спрашивается следующий; убранный не спрашивается', () => {
    const chat = vi.fn(() => true)
    pushBackHandler(chat)
    const release = pushBackHandler(() => false)
    expect(handleBack()).toBe(true)
    expect(chat).toHaveBeenCalledTimes(1)

    release()
    chat.mockReturnValue(false)
    expect(handleBack()).toBe(false)
  })

  it('useCloseOnBack держит обработчик, только пока открыто', async () => {
    const open = ref(false)
    const close = vi.fn(() => {
      open.value = false
    })
    const scope = effectScope()
    scope.run(() => useCloseOnBack(open, close))

    expect(handleBack()).toBe(false)
    open.value = true
    await nextTick()
    expect(handleBack()).toBe(true)
    expect(close).toHaveBeenCalledTimes(1)
    await nextTick()
    // Закрыли — дальше «Назад» снова идёт мимо.
    expect(handleBack()).toBe(false)

    open.value = true
    await nextTick()
    scope.stop()
    expect(handleBack()).toBe(false)
  })

  it('на Android: никто не взял — назад по истории, на первой странице свернуть', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    minimizeApp.mockClear()
    await setupBackButton()
    expect(listeners).toHaveLength(1)

    listeners[0]!({ canGoBack: true })
    expect(back).toHaveBeenCalledTimes(1)
    expect(minimizeApp).not.toHaveBeenCalled()
    listeners[0]!({ canGoBack: false })
    expect(back).toHaveBeenCalledTimes(1)
    expect(minimizeApp).toHaveBeenCalledTimes(1)

    // Открыт чат — его обработчик берёт «Назад»: ни истории, ни сворачивания.
    pushBackHandler(() => true)
    listeners[0]!({ canGoBack: true })
    listeners[0]!({ canGoBack: false })
    expect(back).toHaveBeenCalledTimes(1)
    expect(minimizeApp).toHaveBeenCalledTimes(1)
  })

  it('переход без касания: WebView говорит «некуда», а роутер помнит страницу — назад', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    minimizeApp.mockClear()
    await setupBackButton()
    window.history.replaceState({ back: '/', current: '/search' }, '')
    pressBack(false)
    expect(back).toHaveBeenCalledTimes(1)
    expect(minimizeApp).not.toHaveBeenCalled()
  })

  it('окно, открытое поверх чата, закрывается первым; Esc дальше окна не уходит', async () => {
    minimizeApp.mockClear()
    await setupBackButton()
    const chat = vi.fn(() => true)
    pushBackHandler(chat)
    await later()
    const onWindow = vi.fn()
    window.addEventListener('keydown', onWindow)
    const dialog = openDialog()

    pressBack(false)
    expect(dialog.escapes).toEqual([27])
    expect(chat).not.toHaveBeenCalled()
    expect(onWindow).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onWindow)

    // Окно закрыли — дальше чат.
    dialog.wrap.remove()
    pressBack(false)
    expect(chat).toHaveBeenCalledTimes(1)
    expect(minimizeApp).not.toHaveBeenCalled()
  })

  it('картинка, открытая из окна позже него, закрывается раньше окна', async () => {
    await setupBackButton()
    const dialog = openDialog()
    await later()
    const picture = vi.fn(() => true)
    pushBackHandler(picture)
    pressBack(false)
    expect(picture).toHaveBeenCalledTimes(1)
    expect(dialog.escapes).toEqual([])

    // Обработчика больше нет — следующее «Назад» закрывает окно, даже без фокуса.
    resetBackHandlersForTests()
    dialog.input.blur()
    pressBack(false)
    expect(dialog.escapes).toEqual([27])
  })

  it('окно, которое Esc не закрывает (сейф), «Назад» пропускает — приложение сворачивается', async () => {
    minimizeApp.mockClear()
    await setupBackButton()
    const dialog = openDialog(BACK_IGNORED_CLASS)
    pressBack(false)
    expect(dialog.escapes).toEqual([])
    expect(minimizeApp).toHaveBeenCalledTimes(1)
  })

  it('на компьютере и в браузере кнопку не перехватываем', async () => {
    platform.name = 'web'
    await setupBackButton()
    expect(listeners).toHaveLength(0)
  })
})
