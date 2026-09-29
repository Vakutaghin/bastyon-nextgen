// Что горячие клавиши делают с плеером — как у YouTube: пауза не
// перезапускает первую загрузку, стрелки перематывают на 5 с, J и L на 10 —
// в пределах ролика и только после метаданных, цифры ведут к доле ролика,
// запятая и точка шагают на кадр только на паузе, громкость шагами 5 % без
// накопления ошибки, Esc закрывает справку, меню, потом полноэкранный режим,
// а иначе достаётся странице. Ролик недоступен (ошибка, Tor) — клавиши не его.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { FRAME_STEP, SEEK_STEP, SEEK_STEP_SHORT } from '../consts'
import { useVideoHotkeys } from './use-video-hotkeys'

function setup(
  opts: { initialized?: boolean; loading?: boolean; unavailable?: boolean; pip?: boolean } = {}
) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'duration', { value: 100, configurable: true })
  video.currentTime = 50
  const volume = ref(0.7)
  const handlers = {
    togglePlay: vi.fn(),
    toggleFullscreen: vi.fn(),
    toggleMute: vi.fn(),
    setVolume: vi.fn((v: number) => (volume.value = v)),
    displayVolumeNotification: vi.fn(),
    increasePlaybackRate: vi.fn(),
    decreasePlaybackRate: vi.fn(),
    triggerSeekNotification: vi.fn(),
    closeMenu: vi.fn(),
  }
  const menuOpen = ref(false)
  const togglePip = vi.fn()
  const isFullscreen = ref(false)
  const hotkeys = useVideoHotkeys({
    videoElement: ref(video),
    isInitialized: ref(opts.initialized ?? true),
    isLoading: ref(opts.loading ?? false),
    isFullscreen,
    isUnavailable: () => opts.unavailable ?? false,
    volume,
    ...handlers,
    togglePip: opts.pip === false ? undefined : togglePip,
    isMenuOpen: () => menuOpen.value,
  })
  return { hotkeys, video, volume, isFullscreen, menuOpen, togglePip, ...handlers }
}

describe('useVideoHotkeys', () => {
  let p: ReturnType<typeof setup>
  beforeEach(() => {
    p = setup()
  })

  it('пробел — пауза с уведомлением', () => {
    expect(p.hotkeys.handleHotkey('playPause')).toBe(true)
    expect(p.togglePlay).toHaveBeenCalledWith(true)
  })

  it('пока первый запуск грузится, повторное нажатие не перезапускает загрузку', () => {
    const loading = setup({ initialized: false, loading: true })
    expect(loading.hotkeys.handleHotkey('playPause')).toBe(true)
    expect(loading.togglePlay).not.toHaveBeenCalled()
  })

  it('стрелки — на 5 с, J и L — на 10, в пределах ролика', () => {
    p.hotkeys.handleHotkey('seekForward')
    expect(p.video.currentTime).toBe(50 + SEEK_STEP_SHORT)
    expect(p.triggerSeekNotification).toHaveBeenLastCalledWith(SEEK_STEP_SHORT)

    p.hotkeys.handleHotkey('seekBackwardLong')
    expect(p.video.currentTime).toBe(50 + SEEK_STEP_SHORT - SEEK_STEP)
    expect(p.triggerSeekNotification).toHaveBeenLastCalledWith(-SEEK_STEP)

    p.video.currentTime = 95
    p.hotkeys.handleHotkey('seekForwardLong')
    expect(p.video.currentTime).toBe(100)

    p.video.currentTime = 3
    p.hotkeys.handleHotkey('seekBackward')
    expect(p.video.currentTime).toBe(0)
  })

  it('цифры — к доле ролика, Home и End — в начало и в конец', () => {
    p.hotkeys.handleHotkey('seekTo5')
    expect(p.video.currentTime).toBe(50)
    p.hotkeys.handleHotkey('seekTo0')
    expect(p.video.currentTime).toBe(0)
    p.hotkeys.handleHotkey('seekEnd')
    expect(p.video.currentTime).toBe(100)
    p.hotkeys.handleHotkey('seekStart')
    expect(p.video.currentTime).toBe(0)
  })

  it('запятая и точка шагают на кадр только на паузе', () => {
    Object.defineProperty(p.video, 'paused', { value: true, configurable: true })
    expect(p.hotkeys.handleHotkey('frameForward')).toBe(true)
    expect(p.video.currentTime).toBeCloseTo(50 + FRAME_STEP)
    p.hotkeys.handleHotkey('frameBackward')
    expect(p.video.currentTime).toBeCloseTo(50)

    Object.defineProperty(p.video, 'paused', { value: false, configurable: true })
    expect(p.hotkeys.handleHotkey('frameForward')).toBe(false)
  })

  it('I — «картинка в картинке», если она есть', () => {
    expect(p.hotkeys.handleHotkey('pip')).toBe(true)
    expect(p.togglePip).toHaveBeenCalledTimes(1)
    expect(setup({ pip: false }).hotkeys.handleHotkey('pip')).toBe(false)
  })

  it('до метаданных перемотка не срабатывает и отдаёт клавишу странице', () => {
    Object.defineProperty(p.video, 'duration', { value: NaN, configurable: true })
    expect(p.hotkeys.handleHotkey('seekForward')).toBe(false)
    expect(p.triggerSeekNotification).not.toHaveBeenCalled()
  })

  it('громкость шагами 5 % без накопленной ошибки', () => {
    p.hotkeys.handleHotkey('volumeUp')
    expect(p.volume.value).toBe(0.75)
    p.hotkeys.handleHotkey('volumeDown')
    p.hotkeys.handleHotkey('volumeDown')
    expect(p.volume.value).toBe(0.65)
    expect(p.displayVolumeNotification).toHaveBeenCalledTimes(3)
  })

  it('M, F и скорость вызывают своё действие ровно один раз', () => {
    p.hotkeys.handleHotkey('mute')
    p.hotkeys.handleHotkey('fullscreen')
    p.hotkeys.handleHotkey('speedUp')
    p.hotkeys.handleHotkey('speedDown')
    expect(p.toggleMute).toHaveBeenCalledTimes(1)
    expect(p.toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(p.increasePlaybackRate).toHaveBeenCalledTimes(1)
    expect(p.decreasePlaybackRate).toHaveBeenCalledTimes(1)
  })

  it('Esc: сначала справка, потом меню, потом полный экран, иначе — не наша клавиша', () => {
    p.hotkeys.handleHotkey('help')
    expect(p.hotkeys.showHotkeysHelp.value).toBe(true)
    expect(p.hotkeys.handleHotkey('escape')).toBe(true)
    expect(p.hotkeys.showHotkeysHelp.value).toBe(false)

    p.menuOpen.value = true
    expect(p.hotkeys.handleHotkey('escape')).toBe(true)
    expect(p.closeMenu).toHaveBeenCalledTimes(1)
    p.menuOpen.value = false

    p.isFullscreen.value = true
    expect(p.hotkeys.handleHotkey('escape')).toBe(true)
    expect(p.toggleFullscreen).toHaveBeenCalledTimes(1)

    p.isFullscreen.value = false
    expect(p.hotkeys.handleHotkey('escape')).toBe(false)
  })

  it('вместо ролика ошибка или предупреждение Tor — клавиши достаются их кнопкам', () => {
    const blocked = setup({ unavailable: true })
    expect(blocked.hotkeys.handleHotkey('playPause')).toBe(false)
    expect(blocked.hotkeys.handleHotkey('mute')).toBe(false)
    expect(blocked.togglePlay).not.toHaveBeenCalled()
    expect(blocked.toggleMute).not.toHaveBeenCalled()
  })
})
