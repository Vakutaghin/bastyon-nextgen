// Обновление изнутри приложения: плагин берёт latest.json, качает сборку с
// прогрессом, ставит и перезапускает приложение. Перед установкой дочерние
// процессы гасятся (Windows выходит мимо RunEvent::Exit). Под Tor — через его
// SOCKS, упавший Tor — ошибка, а не прямое соединение.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  calls: [] as string[],
  relaunch: vi.fn(async () => {
    mocks.calls.push('relaunch')
  }),
  invoke: vi.fn(async (cmd: string) => {
    mocks.calls.push(cmd)
  }),
  routing: 'direct' as string,
  socksPort: 9250,
}))

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helpers/tor/tor-gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/tor/tor-gate')>()
  return {
    TorNotReadyError: actual.TorNotReadyError,
    torRoutingMode: async () => mocks.routing,
    waitForTorRouting: async () => 'tor',
  }
})
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => ({ socksPort: mocks.socksPort }) }))

import { installUpdate, type InstallProgress } from './install-update'

type DownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }

/** Обновление, которое при загрузке отдаёт эти события. */
function updateEmitting(events: DownloadEvent[]) {
  return {
    version: '0.9.4',
    download: vi.fn(async (onEvent: (e: DownloadEvent) => void) => {
      events.forEach(onEvent)
    }),
    install: vi.fn(async () => {
      mocks.calls.push('install')
    }),
  }
}

describe('installUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.calls = []
    mocks.routing = 'direct'
  })

  it('качает с прогрессом, ставит и перезапускает приложение', async () => {
    const update = updateEmitting([
      { event: 'Started', data: { contentLength: 200 } },
      { event: 'Progress', data: { chunkLength: 50 } },
      { event: 'Progress', data: { chunkLength: 150 } },
      { event: 'Finished' },
    ])
    mocks.check.mockResolvedValue(update)
    const progress: InstallProgress[] = []
    await expect(installUpdate((p) => progress.push(p))).resolves.toBe('restarting')
    expect(mocks.check).toHaveBeenCalledWith({ timeout: 60_000 })
    expect(progress.map((p) => [p.phase, p.fraction])).toEqual([
      ['download', null],
      ['download', 0],
      ['download', 0.25],
      ['download', 1],
      ['install', 1],
    ])
    expect(mocks.calls).toEqual(['prepare_update_exit', 'install', 'relaunch'])
  })

  it('не скачалось или не сошлась подпись — дочерние процессы не трогаются', async () => {
    const update = updateEmitting([])
    update.download.mockRejectedValue(new Error('signature verification failed'))
    mocks.check.mockResolvedValue(update)
    await expect(installUpdate(() => {})).rejects.toThrow(/signature/)
    expect(mocks.calls).toEqual([])
  })

  it('сервер не назвал размер — прогресс без доли', async () => {
    mocks.check.mockResolvedValue(
      updateEmitting([
        { event: 'Started', data: {} },
        { event: 'Progress', data: { chunkLength: 10 } },
      ])
    )
    const progress: InstallProgress[] = []
    await installUpdate((p) => progress.push(p))
    const downloading = progress.filter((p) => p.phase === 'download')
    expect(downloading.length).toBeGreaterThan(1)
    expect(downloading.every((p) => p.fraction === null)).toBe(true)
  })

  it('обновления для этой системы нет — без перезапуска', async () => {
    mocks.check.mockResolvedValue(null)
    await expect(installUpdate(() => {})).resolves.toBe('unavailable')
    expect(mocks.relaunch).not.toHaveBeenCalled()
  })

  it('под Tor проверка и загрузка идут через его SOCKS', async () => {
    mocks.routing = 'tor'
    mocks.check.mockResolvedValue(null)
    await installUpdate(() => {})
    expect(mocks.check).toHaveBeenCalledWith({
      timeout: 60_000,
      proxy: 'socks5h://127.0.0.1:9250',
    })
  })

  it('Tor ещё запускается — ждёт его, а не идёт напрямую', async () => {
    mocks.routing = 'wait'
    mocks.check.mockResolvedValue(null)
    await installUpdate(() => {})
    expect(mocks.check).toHaveBeenCalledWith(
      expect.objectContaining({ proxy: 'socks5h://127.0.0.1:9250' })
    )
  })

  it('Tor включён, но упал — ошибка, сеть не трогается', async () => {
    mocks.routing = 'failed'
    await expect(installUpdate(() => {})).rejects.toThrow(/Tor is enabled but failed/)
    expect(mocks.check).not.toHaveBeenCalled()
  })
})
