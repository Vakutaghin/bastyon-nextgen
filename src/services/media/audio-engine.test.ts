// Мини-плеер под Tor: звук грузится окном напрямую с сервера PeerTube, поэтому
// сначала согласие «Слушать мимо Tor», как у видео.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sources } = vi.hoisted(() => ({ sources: vi.fn() }))
vi.mock('@/helpers/api/peertube-url', () => ({ getVideoSourcesFromUrl: sources }))
vi.mock('@/b-components/content/video-player/services/hls-error-recovery', () => ({
  HLS_LOAD_POLICY: {},
}))
vi.mock('hls.js', () => ({ default: { isSupported: () => false } }))
vi.mock('@/b-components/content/video-player/composables/background-media-controller', () => ({
  backgroundMediaController: { update: vi.fn(), release: vi.fn(async () => {}) },
}))
vi.mock('@/b-components/content/video-player/video-player-manager', () => ({
  videoPlayerManager: { register: vi.fn(), play: vi.fn(), unregister: vi.fn() },
}))

import { useTorStore } from '@/stores/tor-store'
import { acceptTorBypass, audioState, load, stop, toggle } from './audio-engine'

const track = { id: 'tx1', url: 'peertube://host/uuid', title: 'Песня' } as never

describe('audio-engine × Tor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stop()
    sources.mockReset().mockResolvedValue({ progressiveUrl: 'https://host/a.mp3' })
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })

  it('без Tor трек грузится сразу', async () => {
    await load(track)
    expect(sources).toHaveBeenCalledTimes(1)
    expect(audioState.torBlocked).toBe(false)
  })

  it('под Tor — ни запроса к PeerTube, ни звука, пока нет согласия', async () => {
    const tor = useTorStore()
    tor.available = true
    tor.enabled = true
    await load(track)
    expect(sources).not.toHaveBeenCalled()
    expect(audioState.torBlocked).toBe(true)
    expect(audioState.loading).toBe(false)
    toggle()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()

    acceptTorBypass()
    await vi.waitFor(() => expect(sources).toHaveBeenCalledTimes(1))
    expect(audioState.torBlocked).toBe(false)
    // Согласие — до конца сеанса: следующий трек без вопроса.
    await load({ ...(track as object), id: 'tx2' } as never)
    expect(sources).toHaveBeenCalledTimes(2)
  })
})
