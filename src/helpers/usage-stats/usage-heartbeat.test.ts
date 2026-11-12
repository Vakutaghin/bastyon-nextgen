import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  appFetch: vi.fn(),
  offline: { value: false },
  stored: new Map<string, unknown>(),
}))

vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: mocks.appFetch }))
vi.mock('@/helpers/api/offline', () => ({ isOfflineNow: () => mocks.offline.value }))
vi.mock('@/helpers/changelog/changelog-loader', () => ({ CURRENT_APP_VERSION: '0.36.0' }))
vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => true,
  isCapacitor: () => false,
}))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: vi.fn(async (key: string) => mocks.stored.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      mocks.stored.set(key, value)
      return key
    }),
  },
}))
vi.mock('@/db/apis/decrypted-messages-api', () => ({ clearAllDecrypted: vi.fn() }))

import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { beatIfDue, resetUsageHeartbeatForTests, runUsageHeartbeat } from './usage-heartbeat'

const START = Date.parse('2026-11-12T21:05:00+03:00')
const STATS_URL = 'https://stats.example:8460/beat'
let visibility: DocumentVisibilityState = 'visible'

function prefs(loaded = true, usageStats = true) {
  const store = useAppPreferencesStore()
  store.loaded = loaded
  store.usageStats = usageStats
  return store
}

function sentUrl(index: number): URL {
  const call = mocks.appFetch.mock.calls[index]
  if (!call) throw new Error(`no request #${index}`)
  return new URL(String(call[0]))
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  vi.stubEnv('VITE_USAGE_STATS_URL', STATS_URL)
  vi.useFakeTimers()
  vi.setSystemTime(START)
  setActivePinia(createPinia())
  mocks.appFetch.mockReset()
  mocks.appFetch.mockResolvedValue({ ok: true, status: 204 })
  mocks.offline.value = false
  mocks.stored.clear()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  resetUsageHeartbeatForTests()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('usage heartbeat', () => {
  it('при запуске уходит первая отметка — без куки, Referer и идентификатора', async () => {
    prefs()
    await runUsageHeartbeat()
    await flush()

    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mocks.appFetch.mock.calls[0]
    const parsed = new URL(String(url))
    expect(parsed.origin + parsed.pathname).toBe(STATS_URL)
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      v: '0.36.0',
      p: expect.stringMatching(/^(windows|macos|linux)$/),
      d: '1',
      w: '1',
      m: '1',
      n: '1',
    })
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
    expect(init.headers).toBeUndefined()
    expect(mocks.stored.get('usageBeatState')).toMatchObject({ day: '2026-11-12' })
  })

  it('одна отметка за 15-минутку, следующая — с новыми флагами', async () => {
    prefs()
    await runUsageHeartbeat()
    await flush()

    // 21:05 → 21:12, та же 15-минутка.
    await vi.advanceTimersByTimeAsync(7 * 60_000)
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)

    // В 21:15 действий ещё не было — отметки нет; первое действие шлёт её сразу.
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    expect(Object.fromEntries(sentUrl(1).searchParams)).toMatchObject({
      d: '0',
      w: '0',
      m: '0',
      n: '0',
    })
  })

  it('до чтения настроек не шлёт: выключивший статистику не отправит ни одной', async () => {
    const store = prefs(false, true)
    await runUsageHeartbeat()
    await flush()
    expect(mocks.appFetch).not.toHaveBeenCalled()

    // Настройки прочитались — выключено.
    store.usageStats = false
    store.loaded = true
    await flush()
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(mocks.appFetch).not.toHaveBeenCalled()

    // Включили (нажатие на переключатель — то самое pointerdown) — отметка сразу.
    store.usageStats = true
    await flush()
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
  })

  it('свёрнутое приложение и простой без действий отметок не шлют', async () => {
    prefs()
    visibility = 'hidden'
    await runUsageHeartbeat()
    await flush()
    expect(mocks.appFetch).not.toHaveBeenCalled()

    // Вернулись в приложение — запуск ещё считается действием.
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)

    // Час без касаний — новых отметок нет.
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('keydown'))
    await flush()
    expect(mocks.appFetch).toHaveBeenCalledTimes(2)
  })

  it('играющее видео — использование и без касаний', async () => {
    prefs()
    await runUsageHeartbeat()
    await flush()

    const video = document.createElement('video')
    Object.defineProperty(video, 'paused', { get: () => false })
    Object.defineProperty(video, 'ended', { get: () => false })
    document.body.append(video)
    try {
      // 21:05 → 21:45: 15-минутки 21:15, 21:30 и 21:45 — по видео.
      await vi.advanceTimersByTimeAsync(40 * 60_000)
      expect(mocks.appFetch).toHaveBeenCalledTimes(4)
    } finally {
      video.remove()
    }
  })

  it('сбой не теряет флаги: следующая попытка шлёт их снова', async () => {
    prefs()
    mocks.appFetch.mockRejectedValueOnce(new Error('network'))
    await runUsageHeartbeat()
    await flush()
    expect(mocks.stored.has('usageBeatState')).toBe(false)

    mocks.appFetch.mockResolvedValueOnce({ ok: false, status: 502 })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.stored.has('usageBeatState')).toBe(false)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.appFetch).toHaveBeenCalledTimes(3)
    expect(sentUrl(2).searchParams.get('n')).toBe('1')
    expect(mocks.stored.has('usageBeatState')).toBe(true)
  })

  it('без адреса сервера в сборке — ни одной отметки', async () => {
    prefs()
    vi.stubEnv('VITE_USAGE_STATS_URL', '')
    await runUsageHeartbeat()
    await flush()
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(mocks.appFetch).not.toHaveBeenCalled()
  })

  it('адрес не по HTTPS выключает статистику', async () => {
    prefs()
    vi.stubEnv('VITE_USAGE_STATS_URL', 'http://stats.example:8460/beat')
    expect(await beatIfDue()).toBe(false)
    expect(mocks.appFetch).not.toHaveBeenCalled()
  })

  it('без сети не пытается', async () => {
    prefs()
    mocks.offline.value = true
    expect(await beatIfDue()).toBe(false)
    expect(mocks.appFetch).not.toHaveBeenCalled()
  })

  it('помнит прошлую отметку между запусками', async () => {
    prefs()
    await runUsageHeartbeat()
    await flush()
    resetUsageHeartbeatForTests()

    vi.setSystemTime(START + 60 * 60_000)
    await runUsageHeartbeat()
    await flush()
    expect(Object.fromEntries(sentUrl(1).searchParams)).toMatchObject({ d: '0', n: '0' })
  })
})
