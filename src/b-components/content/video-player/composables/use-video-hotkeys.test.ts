// Что горячие клавиши делают с плеером: пауза не перезапускает первую
// загрузку, перемотка на 10 с в пределах ролика и только после метаданных,
// громкость шагами 0,1 без накопления ошибки (0,7 + 0,1 = 0,8, а не
// 0,7999…), Esc закрывает справку, потом полноэкранный режим, а иначе
// достаётся странице. Ролик недоступен (ошибка, Tor) — клавиши не его.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { SEEK_STEP } from '../consts'
import { useVideoHotkeys } from './use-video-hotkeys'

function setup(opts: { initialized?: boolean; loading?: boolean; unavailable?: boolean } = {}) {
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
  }
  const isFullscreen = ref(false)
  const hotkeys = useVideoHotkeys({
    videoElement: ref(video),
    isInitialized: ref(opts.initialized ?? true),
    isLoading: ref(opts.loading ?? false),
    isFullscreen,
    isUnavailable: () => opts.unavailable ?? false,
    volume,
    ...handlers,
  })
  return { hotkeys, video, volume, isFullscreen, ...handlers }
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

  it('перемотка на 10 с вперёд и назад, в пределах ролика', () => {
    p.hotkeys.handleHotkey('seekForward')
    expect(p.video.currentTime).toBe(50 + SEEK_STEP)
    expect(p.triggerSeekNotification).toHaveBeenLastCalledWith(SEEK_STEP)

    p.video.currentTime = 95
    p.hotkeys.handleHotkey('seekForward')
    expect(p.video.currentTime).toBe(100)

    p.video.currentTime = 3
    p.hotkeys.handleHotkey('seekBackward')
    expect(p.video.currentTime).toBe(0)
    expect(p.triggerSeekNotification).toHaveBeenLastCalledWith(-SEEK_STEP)
  })

  it('до метаданных перемотка не срабатывает и отдаёт клавишу странице', () => {
    Object.defineProperty(p.video, 'duration', { value: NaN, configurable: true })
    expect(p.hotkeys.handleHotkey('seekForward')).toBe(false)
    expect(p.triggerSeekNotification).not.toHaveBeenCalled()
  })

  it('громкость шагами 0,1 без накопленной ошибки', () => {
    p.hotkeys.handleHotkey('volumeUp')
    expect(p.volume.value).toBe(0.8)
    p.hotkeys.handleHotkey('volumeDown')
    p.hotkeys.handleHotkey('volumeDown')
    expect(p.volume.value).toBe(0.6)
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

  it('Esc: сначала справка, потом полный экран, иначе — не наша клавиша', () => {
    p.hotkeys.handleHotkey('help')
    expect(p.hotkeys.showHotkeysHelp.value).toBe(true)
    expect(p.hotkeys.handleHotkey('escape')).toBe(true)
    expect(p.hotkeys.showHotkeysHelp.value).toBe(false)

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
