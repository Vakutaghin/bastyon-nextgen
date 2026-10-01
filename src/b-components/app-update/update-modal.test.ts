// «Перейти к загрузке»: окно закрывается и открывает страницу релиза в
// браузере. Не открылось — ссылка в буфере обмена и на экране, а не молча
// закрытое окно (так было на компьютере до 0.9.3).

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const URL = 'https://github.com/Vakutaghin/bastyon-nextgen/releases/tag/v0.9.3'

const mocks = vi.hoisted(() => ({
  openReleasePage: vi.fn(),
  dismiss: vi.fn(),
  copyText: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/composables/use-app-update', () => ({
  useAppUpdate: () => ({
    available: ref({ tag: 'v0.9.3', pageUrl: URL, publishedAt: '2026-09-30T19:00:45Z' }),
    shouldPrompt: ref(true),
    currentVersion: '0.9.2',
    maybeCheck: vi.fn(),
    dismiss: mocks.dismiss,
    skip: vi.fn(),
    openReleasePage: mocks.openReleasePage,
  }),
}))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copyText }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))

import UpdateModal from './update-modal.vue'

let wrapper: VueWrapper | null = null

async function download(): Promise<void> {
  wrapper = mount(UpdateModal, { attachTo: document.body, global: { plugins: [i18n] } })
  await flushPromises()
  const button = [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Перейти к загрузке'
  )
  button!.click()
  await flushPromises()
}

describe('UpdateModal — «Перейти к загрузке»', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    vi.clearAllMocks()
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
})
