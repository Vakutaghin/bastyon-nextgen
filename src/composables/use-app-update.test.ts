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
    remove: async (key: string) => {
      settingsStore.delete(key)
    },
  },
}))
vi.mock('@/helpers/changelog/changelog-loader', () => ({ CURRENT_APP_VERSION: '0.2.0' }))
const installUpdate = vi.hoisted(() => vi.fn())
vi.mock('@/helpers/updates/install-update', () => ({ installUpdate }))
const android = vi.hoisted(() => ({ available: false, install: vi.fn() }))
vi.mock('@/helpers/updates/android-update', () => ({
  isAndroidUpdaterAvailable: () => android.available,
  installAndroidUpdate: android.install,
}))

import {
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

const APK_ASSET = {
  name: 'Android-Bastyon-NextGen-0.3.0.apk',
  size: 16456301,
  digest: 'sha256:50e4dfe12608de9633675216d5fb5384f7960429473f9a6ace09f25d214318eb',
  browser_download_url:
    'https://github.com/Vakutaghin/bastyon-nextgen/releases/download/v0.3.0/Android-Bastyon-NextGen-0.3.0.apk',
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
    android.available = false
    android.install.mockReset()
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

  it('кнопка у номера версии предлагает и пропущенную версию', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    await useAppUpdate().skip()
    expect(useAppUpdate().hasUpdate.value).toBe(false)

    await checkForUpdateNow({ offerSkipped: true })
    const { hasUpdate, shouldPrompt } = useAppUpdate()
    expect(hasUpdate.value).toBe(true)
    expect(shouldPrompt.value).toBe(true)
  })

  it('повторный пропуск прячет версию и у номера версии', async () => {
    respondWith(RELEASE)
    await checkForUpdateNow({ offerSkipped: true })
    await useAppUpdate().skip()
    expect(useAppUpdate().hasUpdate.value).toBe(false)
    expect(useAppUpdate().shouldPrompt.value).toBe(false)
  })

  it('«позже» закрывает окно, а номер версии помнит о новой', async () => {
    respondWith(RELEASE)
    await checkForUpdate()
    useAppUpdate().dismiss()
    expect(useAppUpdate().shouldPrompt.value).toBe(false)
    expect(useAppUpdate().hasUpdate.value).toBe(true)
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

  it('проверка — при каждом запуске упакованной сборки, но раз за запуск', async () => {
    vi.stubEnv('DEV', false)
    env.tauri = true
    respondWith(RELEASE)

    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(1)
    expect(useAppUpdate().shouldPrompt.value).toBe(true)

    // Окно смонтировали заново — тот же запуск, второй раз не спрашиваем.
    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(1)

    // Следующий запуск — снова, хоть через минуту.
    resetAppUpdateForTests()
    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(2)
    expect(useAppUpdate().shouldPrompt.value).toBe(true)
  })

  it('пропущенную версию проверка при запуске не предлагает', async () => {
    vi.stubEnv('DEV', false)
    env.capacitor = true
    settingsStore.set('bastyonUpdateSkippedVersion', '0.3.0')
    respondWith(RELEASE)
    await maybeCheckForUpdate()
    expect(appFetch).toHaveBeenCalledTimes(1)
    expect(useAppUpdate().shouldPrompt.value).toBe(false)
  })

  it('ручная проверка — и после проверки при запуске', async () => {
    vi.stubEnv('DEV', false)
    env.tauri = true
    respondWith(RELEASE)
    await maybeCheckForUpdate()
    await checkForUpdateNow()
    expect(appFetch).toHaveBeenCalledTimes(2)
  })

  describe('закрыть окно с галкой «Пропустить эту версию» и без', () => {
    it('с галкой — версия пропущена и после перезапуска', async () => {
      respondWith(RELEASE)
      await checkForUpdate()
      await useAppUpdate().close(true)
      expect(useAppUpdate().shouldPrompt.value).toBe(false)
      expect(settingsStore.get('bastyonUpdateSkippedVersion')).toBe('0.3.0')
    })

    it('без галки — до следующего запуска, пропуска нет', async () => {
      respondWith(RELEASE)
      await checkForUpdate()
      await useAppUpdate().close(false)
      expect(useAppUpdate().shouldPrompt.value).toBe(false)
      expect(useAppUpdate().hasUpdate.value).toBe(true)
      expect(settingsStore.has('bastyonUpdateSkippedVersion')).toBe(false)
    })

    it('галку сняли у пропущенной раньше версии — снова напоминать', async () => {
      respondWith(RELEASE)
      await checkForUpdate()
      await useAppUpdate().skip()
      await checkForUpdateNow({ offerSkipped: true })
      expect(useAppUpdate().skipped.value).toBe(true)

      await useAppUpdate().close(false)
      expect(useAppUpdate().skipped.value).toBe(false)
      expect(settingsStore.has('bastyonUpdateSkippedVersion')).toBe(false)
      expect(useAppUpdate().hasUpdate.value).toBe(true)
    })
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

  describe('обновление изнутри приложения', () => {
    it('ставит само на компьютере и на Android, если в релизе есть APK с хешем', async () => {
      env.tauri = true
      expect(useAppUpdate().canInstall.value).toBe(true)

      env.tauri = false
      env.capacitor = true
      android.available = true
      respondWith(RELEASE)
      await checkForUpdate()
      // В релизе нет APK — только страница.
      expect(useAppUpdate().canInstall.value).toBe(false)

      respondWith({ ...RELEASE, assets: [APK_ASSET] })
      await checkForUpdateNow()
      expect(useAppUpdate().canInstall.value).toBe(true)

      // Браузер: плагина нет.
      android.available = false
      expect(useAppUpdate().canInstall.value).toBe(false)
    })

    it('прогресс виден, пока идёт установка', async () => {
      env.tauri = true
      let resolveInstall: (r: string) => void = () => {}
      installUpdate.mockImplementation((onProgress: (p: unknown) => void) => {
        onProgress({ phase: 'download', fraction: 0.5 })
        return new Promise((r) => (resolveInstall = r))
      })
      const api = useAppUpdate()
      const running = api.install()
      await vi.waitFor(() =>
        expect(api.installProgress.value).toEqual({ phase: 'download', fraction: 0.5 })
      )
      expect(api.installing.value).toBe(true)
      resolveInstall('restarting')
      await expect(running).resolves.toBe(true)
      expect(api.installFailed.value).toBe(false)
    })

    it('не вышло (ошибка или нет сборки для системы) — предлагается страница релиза', async () => {
      env.tauri = true
      const api = useAppUpdate()
      installUpdate.mockRejectedValueOnce(new Error('permission denied'))
      await expect(api.install()).resolves.toBe(false)
      expect(api.installFailed.value).toBe(true)
      expect(api.installing.value).toBe(false)

      installUpdate.mockResolvedValueOnce('unavailable')
      await expect(api.install()).resolves.toBe(false)
      expect(api.installFailed.value).toBe(true)
    })

    describe('Android', () => {
      beforeEach(async () => {
        installUpdate.mockClear()
        env.capacitor = true
        android.available = true
        respondWith({ ...RELEASE, assets: [APK_ASSET] })
        await checkForUpdate()
      })

      it('APK релиза уходит установщику; прогресс скачивания виден', async () => {
        let finish: (r: string) => void = () => {}
        android.install.mockImplementation((_apk: unknown, onProgress: (p: unknown) => void) => {
          onProgress({ phase: 'download', fraction: 0.25 })
          return new Promise((r) => (finish = r))
        })
        const api = useAppUpdate()
        const running = api.install()
        await vi.waitFor(() =>
          expect(api.installProgress.value).toEqual({ phase: 'download', fraction: 0.25 })
        )
        expect(android.install.mock.calls[0]![0]).toEqual({
          url: APK_ASSET.browser_download_url,
          size: APK_ASSET.size,
          sha256: '50e4dfe12608de9633675216d5fb5384f7960429473f9a6ace09f25d214318eb',
        })
        expect(installUpdate).not.toHaveBeenCalled()

        // Установщик закрыли, не обновив: «Обновить» остаётся, страница не нужна.
        finish('dismissed')
        await expect(running).resolves.toBe(false)
        expect(api.installNotice.value).toBe('dismissed')
        expect(api.installFailed.value).toBe(false)
        expect(api.installing.value).toBe(false)
        expect(api.installProgress.value).toBeNull()
      })

      it('не дали разрешение — подсказка, а не провал', async () => {
        android.install.mockResolvedValueOnce('permission')
        const api = useAppUpdate()
        await api.install()
        expect(api.installNotice.value).toBe('permission')
        expect(api.installFailed.value).toBe(false)
      })

      it('хеш, подпись или сеть подвели — страница релиза', async () => {
        android.install.mockRejectedValueOnce(Object.assign(new Error('hash'), { code: 'hash' }))
        const api = useAppUpdate()
        await expect(api.install()).resolves.toBe(false)
        expect(api.installFailed.value).toBe(true)
        expect(api.installNotice.value).toBeNull()
      })
    })
  })
})
