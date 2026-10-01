// «Перейти к загрузке»: окно закрывается и открывает страницу релиза в
// браузере; не открылось — ссылка в буфере и на экране. На компьютере вместо
// неё «Обновить»: обновление ставится само, с прогрессом; не вышло — страница.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const URL = 'https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/v0.9.3'

const mocks = vi.hoisted(() => ({
  openReleasePage: vi.fn(),
  dismiss: vi.fn(),
  copyText: vi.fn(),
  toastError: vi.fn(),
  install: vi.fn(),
  canInstall: false,
  state: null as null | {
    installing: { value: boolean }
    installProgress: { value: unknown }
    installFailed: { value: boolean }
  },
}))

vi.mock('@/composables/use-app-update', async () => {
  const { ref } = await import('vue')
  const installing = ref(false)
  const installProgress = ref<unknown>(null)
  const installFailed = ref(false)
  mocks.state = { installing, installProgress, installFailed }
  return {
    useAppUpdate: () => ({
      available: ref({ tag: 'v0.9.3', pageUrl: URL, publishedAt: '2026-09-30T19:00:45Z' }),
      shouldPrompt: ref(true),
      currentVersion: '0.9.2',
      maybeCheck: vi.fn(),
      dismiss: mocks.dismiss,
      skip: vi.fn(),
      openReleasePage: mocks.openReleasePage,
      canInstall: mocks.canInstall,
      installing,
      installProgress,
      installFailed,
      install: mocks.install,
    }),
  }
})
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copyText }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))

import UpdateModal from './update-modal.vue'

let wrapper: VueWrapper | null = null

const button = (text: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)

async function open(): Promise<void> {
  wrapper = mount(UpdateModal, { attachTo: document.body, global: { plugins: [i18n] } })
  await flushPromises()
}

async function download(): Promise<void> {
  await open()
  button('Перейти к загрузке')!.click()
  await flushPromises()
}

describe('UpdateModal — «Перейти к загрузке»', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canInstall = false
    mocks.state!.installing.value = false
    mocks.state!.installProgress.value = null
    mocks.state!.installFailed.value = false
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('браузер открылся — окно закрыто, больше ничего', async () => {
    mocks.openReleasePage.mockResolvedValue(true)
    await download()
    expect(mocks.dismiss).toHaveBeenCalled()
    expect(mocks.copyText).not.toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('не открылся — ссылка в буфере обмена и в сообщении', async () => {
    mocks.openReleasePage.mockResolvedValue(false)
    mocks.copyText.mockResolvedValue(true)
    await download()
    expect(mocks.copyText).toHaveBeenCalledWith(URL)
    const { message } = mocks.toastError.mock.lastCall![0] as { message: string }
    expect(message).toContain('скопирована')
    expect(message).toContain(URL)
  })

  it('и в буфер не вышло — ссылка в сообщении, открыть её вручную', async () => {
    mocks.openReleasePage.mockResolvedValue(false)
    mocks.copyText.mockResolvedValue(false)
    await download()
    const { message } = mocks.toastError.mock.lastCall![0] as { message: string }
    expect(message).toContain('вручную')
    expect(message).toContain(URL)
  })

  describe('на компьютере обновление ставится само', () => {
    beforeEach(() => {
      mocks.canInstall = true
    })

    it('«Обновить» ставит обновление, страница релиза не нужна', async () => {
      await open()
      expect(document.body.textContent).toContain('скачает новую версию')
      expect(button('Перейти к загрузке')).toBeUndefined()
      button('Обновить')!.click()
      await flushPromises()
      expect(mocks.install).toHaveBeenCalledTimes(1)
      expect(mocks.openReleasePage).not.toHaveBeenCalled()
    })

    it('пока ставится — прогресс, кнопки неактивны, окно не закрыть', async () => {
      mocks.state!.installing.value = true
      mocks.state!.installProgress.value = { phase: 'download', fraction: 0.42 }
      await open()
      expect(document.body.textContent).toMatch(/Скачиваю обновление: 42\s?%/)
      expect(button('Обновить')!.disabled).toBe(true)
      expect(button('Позже')!.disabled).toBe(true)
      expect(document.body.querySelector('.ant-modal-close')).toBeNull()

      mocks.state!.installProgress.value = { phase: 'install', fraction: 1 }
      await flushPromises()
      expect(document.body.textContent).toContain('перезапускаю')
    })

    it('само не вышло — объяснение и страница релиза', async () => {
      mocks.state!.installFailed.value = true
      await open()
      expect(document.body.textContent).toContain('само не получилось')
      expect(button('Обновить')).toBeUndefined()
      expect(button('Перейти к загрузке')).toBeDefined()
    })
  })
})
