import { afterEach, describe, expect, it, vi } from 'vitest'

import { SEEK_REPEAT_INTERVAL } from './consts'
import { HeldHotkeys, hotkeyAction, isHotkeyBlockedBy, isOnScreen } from './video-hotkeys'

const key = (code: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { code, ...init })

describe('hotkeyAction', () => {
  it('клавиши — по физическому коду, в любой раскладке', () => {
    expect(hotkeyAction(key('Space'))).toBe('playPause')
    expect(hotkeyAction(key('KeyK'))).toBe('playPause')
    expect(hotkeyAction(key('ArrowRight'))).toBe('seekForward')
    expect(hotkeyAction(key('KeyJ'))).toBe('seekBackwardLong')
    expect(hotkeyAction(key('KeyL'))).toBe('seekForwardLong')
    expect(hotkeyAction(key('ArrowDown'))).toBe('volumeDown')
    expect(hotkeyAction(key('KeyM'))).toBe('mute')
    expect(hotkeyAction(key('KeyF'))).toBe('fullscreen')
    expect(hotkeyAction(key('KeyI'))).toBe('pip')
    expect(hotkeyAction(key('KeyQ'))).toBeNull()
  })

  it('раскладка YouTube: цифры, Home и End, запятая и точка', () => {
    expect(hotkeyAction(key('Digit5'))).toBe('seekTo5')
    expect(hotkeyAction(key('Numpad0'))).toBe('seekTo0')
    expect(hotkeyAction(key('Home'))).toBe('seekStart')
    expect(hotkeyAction(key('End'))).toBe('seekEnd')
    expect(hotkeyAction(key('Period'))).toBe('frameForward')
    expect(hotkeyAction(key('Comma'))).toBe('frameBackward')
  })

  it('скорость и справка — только с Shift, как в подсказке плеера', () => {
    expect(hotkeyAction(key('Period', { shiftKey: true }))).toBe('speedUp')
    expect(hotkeyAction(key('Comma', { shiftKey: true }))).toBe('speedDown')
    expect(hotkeyAction(key('Slash', { shiftKey: true }))).toBe('help')
    // Shift+пробел листает страницу вверх.
    expect(hotkeyAction(key('Space', { shiftKey: true }))).toBeNull()
  })

  it('сочетания с Ctrl, Cmd и Alt — браузеру: Cmd+F ищет, а не разворачивает видео', () => {
    expect(hotkeyAction(key('KeyF', { metaKey: true }))).toBeNull()
    expect(hotkeyAction(key('KeyF', { ctrlKey: true }))).toBeNull()
    expect(hotkeyAction(key('KeyM', { altKey: true }))).toBeNull()
  })

  it('пробел без code (экранная клавиатура) узнаём по key', () => {
    expect(hotkeyAction(new KeyboardEvent('keydown', { key: ' ' }))).toBe('playPause')
  })
})

describe('HeldHotkeys', () => {
  it('зажатый пробел срабатывает один раз', () => {
    const held = new HeldHotkeys()
    held.press('Space', 0)
    for (let t = 500; t < 3000; t += 33) {
      expect(held.repeat('Space', 'playPause', t)).toBe('swallow')
    }
  })

  it('зажатая стрелка перематывает не чаще интервала, а не на каждый автоповтор', () => {
    const held = new HeldHotkeys()
    held.press('ArrowRight', 0)
    const runs: number[] = []
    // Секунда автоповтора по 33 мс — около 30 событий.
    for (let t = 500; t <= 1500; t += 33) {
      if (held.repeat('ArrowRight', 'seekForward', t) === 'run') runs.push(t)
    }
    expect(runs).toHaveLength(5)
    runs
      .slice(1)
      .forEach((t, i) => expect(t - runs[i]!).toBeGreaterThanOrEqual(SEEK_REPEAT_INTERVAL))
  })

  it('автоповтор клавиши, которую плеер не взял, не трогаем', () => {
    expect(new HeldHotkeys().repeat('ArrowDown', 'volumeDown', 1000)).toBe('pass')
  })

  it('отпускание и потеря фокуса окна забывают клавишу', () => {
    const held = new HeldHotkeys()
    held.press('Space', 0)
    expect(held.release('Space')).toBe(true)
    expect(held.release('Space')).toBe(false)
    held.press('KeyM', 0)
    held.clear()
    expect(held.repeat('KeyM', 'mute', 500)).toBe('pass')
  })
})

describe('isHotkeyBlockedBy', () => {
  const holders: HTMLElement[] = []
  afterEach(() => holders.splice(0).forEach((h) => h.remove()))

  function dom(html: string): HTMLElement {
    const holder = document.createElement('div')
    holder.innerHTML = html
    document.body.appendChild(holder)
    holders.push(holder)
    return holder
  }
  const el = (html: string): Element => dom(html).firstElementChild!

  it('поля ввода и кнопки обрабатывают клавиши сами', () => {
    expect(isHotkeyBlockedBy(el('<input>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<textarea></textarea>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<select><option>a</option></select>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<button>ok</button>'))).toBe(true)
  })

  it('ссылка с href — тоже', () => {
    expect(isHotkeyBlockedBy(el('<a href="/x">x</a>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<a>без href</a>'))).toBe(false)
  })

  it('contenteditable', () => {
    expect(isHotkeyBlockedBy(el('<div contenteditable="true">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div contenteditable="">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div contenteditable="false">x</div>'))).toBe(false)
  })

  it('элементы с интерактивной ролью', () => {
    expect(isHotkeyBlockedBy(el('<div role="button">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div role="slider">x</div>'))).toBe(true)
    expect(isHotkeyBlockedBy(el('<div role="presentation">x</div>'))).toBe(false)
  })

  it('внутри модалки клавиши принадлежат модалке', () => {
    const root = dom('<div role="dialog"><div><span id="deep">x</span></div></div>')
    expect(isHotkeyBlockedBy(root.querySelector('#deep'))).toBe(true)
  })

  it('обычный текст на странице не блокирует хоткеи', () => {
    expect(isHotkeyBlockedBy(el('<p>просто текст</p>'))).toBe(false)
    expect(isHotkeyBlockedBy(null)).toBe(false)
  })

  it('кнопка плеера после клика — не помеха: пробел ставит паузу, а не жмёт её ещё раз', () => {
    const root = dom('<div id="player" tabindex="0"><button id="mute">m</button></div>')
    const player = root.querySelector('#player')
    const mute = root.querySelector('#mute')
    expect(isHotkeyBlockedBy(mute, player, true)).toBe(false)
    // С Tab кнопка плеера нажимается пробелом, как любая кнопка.
    expect(isHotkeyBlockedBy(mute, player, false)).toBe(true)
  })

  it('поле ввода блокирует и внутри плеера', () => {
    const root = dom('<div id="player" tabindex="0"><input id="field"></div>')
    expect(
      isHotkeyBlockedBy(root.querySelector('#field'), root.querySelector('#player'), true)
    ).toBe(true)
  })

  it('кнопка-предок плеера (карточка целиком) не мешает фокусу в самом плеере', () => {
    const root = dom('<div role="button" id="card"><div id="player" tabindex="0"></div></div>')
    const player = root.querySelector('#player')
    expect(isHotkeyBlockedBy(player, player)).toBe(false)
    expect(isHotkeyBlockedBy(root.querySelector('#card'), player)).toBe(true)
  })

  it('модалка, в которой лежит сам плеер, клавиши у него не забирает', () => {
    const root = dom(
      '<div role="dialog"><span id="title">x</span><div id="player" tabindex="0"></div></div><div id="feed-player"></div>'
    )
    const title = root.querySelector('#title')
    expect(isHotkeyBlockedBy(title, root.querySelector('#player'))).toBe(false)
    // А ролик в ленте за модалкой — не получает.
    expect(isHotkeyBlockedBy(title, root.querySelector('#feed-player'))).toBe(true)
  })
})

describe('isOnScreen', () => {
  afterEach(() => vi.restoreAllMocks())

  function box(top: number, height: number): Element {
    const element = document.createElement('div')
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom: top + height,
      height,
    } as DOMRect)
    return element
  }

  it('виден хотя бы наполовину — на экране', () => {
    const h = window.innerHeight
    expect(isOnScreen(box(0, 300))).toBe(true)
    expect(isOnScreen(box(h - 180, 300))).toBe(true)
    expect(isOnScreen(box(h - 120, 300))).toBe(false)
    expect(isOnScreen(box(-200, 300))).toBe(false)
    expect(isOnScreen(box(h + 10, 300))).toBe(false)
  })

  it('без размеров и без элемента — нет', () => {
    expect(isOnScreen(box(0, 0))).toBe(false)
    expect(isOnScreen(null)).toBe(false)
  })
})
