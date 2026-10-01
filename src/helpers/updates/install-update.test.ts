// Обновление изнутри приложения: плагин берёт latest.json, качает сборку с
// прогрессом, ставит и перезапускает приложение. Под Tor — через его SOCKS,
// упавший Tor — ошибка, а не прямое соединение.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(async () => {}),
  routing: 'direct' as string,
  socksPort: 9250,
}))

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }))
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
    downloadAndInstall: vi.fn(async (onEvent: (e: DownloadEvent) => void) => {
      events.forEach(onEvent)
    }),
  }
}

describe('installUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(mocks.relaunch).toHaveBeenCalledTimes(1)
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
    expect(progress.every((p) => p.fraction === null)).toBe(true)
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
