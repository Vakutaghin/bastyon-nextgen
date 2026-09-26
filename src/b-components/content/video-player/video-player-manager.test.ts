import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VideoPlayerInstance } from './types'
import type { HotkeyAction } from './video-hotkeys'
import { VideoPlayerManager } from './video-player-manager'

interface PlayerState {
  playing: boolean
  started: boolean
  hovered: boolean
  fullscreen: boolean
  pointer: boolean
  /** Что отвечает handleHotkey: взял клавишу или нет. */
  takes: boolean
}

interface FakePlayer extends VideoPlayerInstance {
  root: HTMLElement
  button: HTMLButtonElement
  actions: HotkeyAction[]
  state: PlayerState
}

function fakePlayer(id: string, state: Partial<PlayerState> = {}): FakePlayer {
  const root = document.createElement('div')
  root.tabIndex = 0
  const button = document.createElement('button')
  root.appendChild(button)
  document.body.appendChild(root)
  const s: PlayerState = {
    playing: false,
    started: true,
    hovered: false,
    fullscreen: false,
    pointer: true,
    takes: true,
    ...state,
  }
  const actions: HotkeyAction[] = []
  return {
    id,
    root,
    button,
    actions,
    state: s,
    pause: () => {
      s.playing = false
    },
    isPlaying: () => s.playing,
    element: () => root,
    isStarted: () => s.started,
    isHovered: () => s.hovered,
    isFullscreen: () => s.fullscreen,
    isPointerMode: () => s.pointer,
    handleHotkey: (action) => {
      actions.push(action)
      return s.takes
    },
  }
}

function keydown(target: EventTarget, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function keyup(target: EventTarget, code: string): KeyboardEvent {
  const event = new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('VideoPlayerManager: горячие клавиши', () => {
  let manager: VideoPlayerManager
  let unregister: Array<() => void>
  let now: number

  beforeEach(() => {
    manager = new VideoPlayerManager()
    unregister = []
    now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    unregister.forEach((off) => off())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function add(id: string, state: Partial<PlayerState> = {}): FakePlayer {
    const player = fakePlayer(id, state)
    unregister.push(manager.register(id, player))
    return player
  }

  /** Пользователь запустил ролик — как событие play у плеера. */
  function play(player: FakePlayer): void {
    player.state.playing = true
    manager.pauseAllExcept(player.id)
  }

  it('пробел достаётся ровно одному плееру и ровно один раз', () => {
    const a = add('a')
    const b = add('b')
    const c = add('c')
    play(a)

    const event = keydown(document.body, 'Space')

    expect(a.actions).toEqual(['playPause'])
    expect(b.actions).toEqual([])
    expect(c.actions).toEqual([])
    // Страница под роликом не прокручивается.
    expect(event.defaultPrevented).toBe(true)
  })

  it('до первого запуска видео пробел листает страницу', () => {
    const a = add('a', { hovered: true })

    const event = keydown(document.body, 'Space')

    expect(a.actions).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('фокус внутри плеера (Tab на ролик) — клавиши его и до первого запуска', () => {
    const a = add('a', { started: false })

    keydown(a.root, 'Space')

    expect(a.actions).toEqual(['playPause'])
  })

  it('плеер с фокусом важнее играющего, развёрнутый — важнее всех', () => {
    const a = add('a')
    const b = add('b')
    const c = add('c')
    play(a)

    keydown(b.root, 'KeyM')
    expect(b.actions).toEqual(['mute'])

    c.state.fullscreen = true
    keydown(b.root, 'KeyM')
    expect(c.actions).toEqual(['mute'])
    expect(a.actions).toEqual([])
  })

  it('остановленный ролик — пока он на экране; прокрутили дальше — пробел снова листает', () => {
    const a = add('a')
    play(a)
    a.pause()
    const rect = vi.spyOn(a.root, 'getBoundingClientRect')

    rect.mockReturnValue({ top: 0, bottom: 300, height: 300 } as DOMRect)
    expect(keydown(document.body, 'Space').defaultPrevented).toBe(true)
    expect(a.actions).toEqual(['playPause'])

    rect.mockReturnValue({ top: -2000, bottom: -1700, height: 300 } as DOMRect)
    expect(keydown(document.body, 'Space').defaultPrevented).toBe(false)
    expect(a.actions).toEqual(['playPause'])
  })

  it('никогда не запускавшийся плеер получает клавиши, только если он под мышью', () => {
    const a = add('a')
    const b = add('b', { started: false })
    play(a)
    a.pause()

    keydown(document.body, 'Space')
    expect(b.actions).toEqual([])

    b.state.hovered = true
    keydown(document.body, 'Space')
    expect(b.actions).toEqual(['playPause'])
  })

  it('зажатый пробел: одно переключение, автоповторы проглочены, отпускание — тоже', () => {
    const a = add('a')
    play(a)

    keydown(document.body, 'Space')
    for (let i = 1; i <= 30; i++) {
      now = 500 + i * 33
      expect(keydown(document.body, 'Space', { repeat: true }).defaultPrevented).toBe(true)
    }

    expect(a.actions).toEqual(['playPause'])
    // Firefox нажимает кнопку в фокусе на keyup пробела.
    expect(keyup(document.body, 'Space').defaultPrevented).toBe(true)
  })

  it('зажатая стрелка перематывает с ограниченной частотой', () => {
    const a = add('a')
    play(a)

    keydown(document.body, 'ArrowRight')
    for (let i = 1; i <= 30; i++) {
      now = 500 + i * 33
      keydown(document.body, 'ArrowRight', { repeat: true })
    }

    // Первое нажатие + 5 повторов за секунду автоповтора, а не 31.
    expect(a.actions).toHaveLength(6)
    expect(new Set(a.actions)).toEqual(new Set(['seekForward']))
  })

  it('клавишу, которую плеер не взял, не глотаем и при автоповторе', () => {
    const a = add('a', { takes: false })
    play(a)

    expect(keydown(document.body, 'ArrowDown').defaultPrevented).toBe(false)
    now = 600
    expect(keydown(document.body, 'ArrowDown', { repeat: true }).defaultPrevented).toBe(false)
    expect(keyup(document.body, 'ArrowDown').defaultPrevented).toBe(false)
    expect(a.actions).toEqual(['volumeDown'])
  })

  it('после отпускания клавиша снова срабатывает сразу', () => {
    const a = add('a')
    play(a)

    keydown(document.body, 'Space')
    keyup(document.body, 'Space')
    keydown(document.body, 'Space')

    expect(a.actions).toEqual(['playPause', 'playPause'])
  })

  it('поле ввода, чужая кнопка и модалка забирают клавиши себе', () => {
    const a = add('a')
    play(a)
    const input = document.body.appendChild(document.createElement('input'))
    const button = document.body.appendChild(document.createElement('button'))
    const dialog = document.body.appendChild(document.createElement('div'))
    dialog.setAttribute('role', 'dialog')

    expect(keydown(input, 'Space').defaultPrevented).toBe(false)
    expect(keydown(button, 'Space').defaultPrevented).toBe(false)
    expect(keydown(dialog, 'Space').defaultPrevented).toBe(false)
    expect(a.actions).toEqual([])
  })

  it('кнопка плеера: после клика пробел — пауза, после Tab — сама кнопка', () => {
    const a = add('a')
    play(a)

    keydown(a.button, 'Space')
    keyup(a.button, 'Space')
    expect(a.actions).toEqual(['playPause'])

    a.state.pointer = false
    expect(keydown(a.button, 'Space').defaultPrevented).toBe(false)
    expect(a.actions).toEqual(['playPause'])
  })

  it('уже обработанное событие и сочетания с Cmd не трогаем', () => {
    const a = add('a')
    play(a)
    const stop = (e: Event): void => e.preventDefault()
    document.body.addEventListener('keydown', stop)

    keydown(document.body, 'Space')
    document.body.removeEventListener('keydown', stop)
    keydown(document.body, 'KeyF', { metaKey: true })

    expect(a.actions).toEqual([])
  })

  it('слушатель снимается вместе с последним плеером', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    add('a')
    add('b')

    unregister.splice(0, 1)[0]!()
    expect(remove).not.toHaveBeenCalledWith('keydown', expect.any(Function))
    unregister.splice(0, 1)[0]!()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
