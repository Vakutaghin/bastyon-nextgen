import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const appFetch = vi.hoisted(() => vi.fn())
const settingsStore = vi.hoisted(() => new Map<string, unknown>())
const openExternal = vi.hoisted(() => vi.fn(async () => true))
const env = vi.hoisted(() => ({ tauri: false, capacitor: false }))

vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal }))
vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => env.tauri,
  isCapacitor: () => env.capacitor,
}))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: async (key: string) => settingsStore.get(key),
    set: async (key: string, value: unknown) => {
      settingsStore.set(key, value)
      return key
    },
  },
}))
vi.mock('@/helpers/changelog/changelog-loader', () => ({ CURRENT_APP_VERSION: '0.2.0' }))

import {
  AUTO_CHECK_INTERVAL_MS,
  checkForUpdate,
  checkForUpdateNow,
  maybeCheckForUpdate,
  resetAppUpdateForTests,
  supportsUpdateCheck,
  useAppUpdate,
} from './use-app-update'

const RELEASE = {
  tag_name: 'v0.3.0',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/v0.3.0',
  published_at: '2026-09-24T15:00:00Z',
}

function respondWith(body: unknown, ok = true, status = 200): void {
  appFetch.mockResolvedValue({ ok, status, json: async () => body } as unknown as Response)
}

describe('use-app-update', () => {
  beforeEach(() => {
    resetAppUpdateForTests()
    settingsStore.clear()
    appFetch.mockReset()
    openExternal.mockClear()
    env.tauri = false
    env.capacitor = false
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('находит более новый релиз и предлагает его', async () => {
    respondWith(RELEASE)
    const release = await checkForUpdate()
    expect(release?.version).toBe('0.3.0')
    expect(useAppUpdate().shouldPrompt.value).toBe(true)
  })

  it('на своей версии ничего не предлагает', async () => {
    respondWith({ ...RELEASE, tag_name: 'v0.2.0' })
    expect(await checkForUpdate()).toBeNull()
    const { shouldPrompt, failed, checked } = useAppUpdate()
    expect(shouldPrompt.value).toBe(false)
    // Это не ошибка проверки — просто обновления нет.
    expect(failed.value).toBe(false)
    expect(checked.value).toBe(true)
  })

  it('ошибка сети не роняет проверку', async () => {
    appFetch.mockRejectedValue(new Error('offline'))
    expect(await checkForUpdate()).toBeNull()
    expect(useAppUpdate().failed.value).toBe(true)
  })

  it('ответ не 200 считается неудачей', async () => {
    respondWith({}, false, 403)
    expect(await checkForUpdate()).toBeNull()
    expect(useAppUpdate().failed.value).toBe(true)
  })

  it('параллельные вызовы дают один запрос', async () => {
    respondWith(RELEASE)
    await Promise.all([checkForUpdate(), checkForUpdate(), checkForUpdate()])
    expect(appFetch).toHaveBeenCalledTimes(1)
  })

  it('«позже» прячет предложение до перезапуска', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    const { shouldPrompt, dismiss, available } = useAppUpdate()
    dismiss()
    expect(shouldPrompt.value).toBe(false)
    // Сама версия из состояния не пропадает — диагностика её показывает.
    expect(available.value?.tag).toBe('v0.3.0')
  })

  it('пропущенная версия не всплывает и после повторной проверки', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    await useAppUpdate().skip()
    expect(useAppUpdate().shouldPrompt.value).toBe(false)

    resetAppUpdateForTests()
    respondWith(RELEASE)
    await checkForUpdateNow()
    expect(useAppUpdate().shouldPrompt.value).toBe(false)
  })

  it('следующая версия после пропущенной снова предлагается', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    await useAppUpdate().skip()

    resetAppUpdateForTests()
    respondWith({ ...RELEASE, tag_name: 'v0.4.0' })
    await checkForUpdateNow()
    expect(useAppUpdate().shouldPrompt.value).toBe(true)
  })

  it('автопроверка в браузере не ходит в сеть', async () => {
    respondWith(RELEASE)
    await maybeCheckForUpdate()
    expect(appFetch).not.toHaveBeenCalled()
    expect(supportsUpdateCheck()).toBe(false)
  })

  it('в dev-сборке автопроверка молчит', async () => {
    env.tauri = true
    respondWith(RELEASE)
    await maybeCheckForUpdate()
    expect(appFetch).not.toHaveBeenCalled()
  })

  it('автопроверка в упакованной сборке не чаще раза в сутки', async () => {
    vi.stubEnv('DEV', false)
    env.tauri = true
    respondWith(RELEASE)

    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(1)

    resetAppUpdateForTests()
    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(1)

    // Сутки спустя — снова можно.
    settingsStore.set('bastyonUpdateLastCheckedAt', Date.now() - AUTO_CHECK_INTERVAL_MS - 1)
    resetAppUpdateForTests()
    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(2)
  })

  it('неудачная проверка не переводит часы троттлинга', async () => {
    vi.stubEnv('DEV', false)
    env.tauri = true
    appFetch.mockRejectedValue(new Error('offline'))
    await maybeCheckForUpdate()
    expect(settingsStore.has('bastyonUpdateLastCheckedAt')).toBe(false)
  })

  it('ручная проверка игнорирует троттлинг', async () => {
    settingsStore.set('bastyonUpdateLastCheckedAt', Date.now())
    respondWith(RELEASE)
    await checkForUpdateNow()
    expect(appFetch).toHaveBeenCalledTimes(1)
  })

  it('«скачать» открывает страницу релиза наружу', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    expect(await useAppUpdate().openReleasePage()).toBe(true)
    expect(openExternal).toHaveBeenCalledWith(RELEASE.html_url)
  })

  it('без найденного релиза открывать нечего', async () => {
    expect(await useAppUpdate().openReleasePage()).toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('запрос уходит на api.github.com без куки', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    const [url, init] = appFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('api.github.com')
    expect(init.credentials).toBe('omit')
  })
})
