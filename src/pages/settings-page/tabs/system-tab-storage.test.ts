// «Система» → «Локальные данные» на компьютере: размер веб-кэша и кэша IPFS,
// предел и «Очистить» (src-tauri storage), «Хранить расшифрованные сообщения».

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const MB = 1024 * 1024

const mocks = vi.hoisted(() => ({
  ipfsCache: null as number | null,
  invoke: vi.fn(),
  clearAllDecrypted: vi.fn(async () => {}),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({ isTauri: () => true }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/composables/use-autostart', () => ({
  isAutostartEnabled: async () => false,
  setAutostart: async () => true,
}))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: { get: async () => undefined, set: async (key: string) => key },
}))
vi.mock('@/db/apis/decrypted-messages-api', () => ({
  clearAllDecrypted: mocks.clearAllDecrypted,
}))

import SystemTab from './system-tab.vue'

let wrapper: VueWrapper | null = null
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const row = (kind: string) => document.body.querySelector(`[data-testid="cache-${kind}"]`)
const buttonIn = (el: Element | null, label: string) =>
  [...(el?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === label)

async function mountTab(): Promise<void> {
  wrapper = mount(SystemTab, { attachTo: document.body, global: { plugins: [i18n] } })
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await vi.dynamicImportSettled()
  }
}

describe('SystemTab: кэш и расшифровки', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.ipfsCache = null
    mocks.invoke.mockImplementation(async (cmd: string, args?: { limits?: unknown }) => {
      if (cmd === 'storage_usage')
        return {
          webCache: 300 * MB,
          ipfsCache: mocks.ipfsCache,
          limits: { web: 512 * MB, ipfs: 2048 * MB },
          modules: { ipfs: 0, tor: 0, voice: 0, compression: 0, mesh: 0 },
        }
      if (cmd === 'storage_set_limits') return args?.limits
      return undefined
    })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('веб-кэш: сколько занято и предел; кэша IPFS без модуля нет', async () => {
    await mountTab()
    expect(row('web')?.textContent).toContain('Веб-кэш')
    expect(row('web')?.textContent).toContain('Занято 300 МБ из 512 МБ')
    expect(row('ipfs')).toBeNull()
  })

  it('модуль IPFS скачан — строка его кэша с пределом 2 ГБ', async () => {
    mocks.ipfsCache = 40 * MB
    await mountTab()
    expect(row('ipfs')?.textContent).toContain('Кэш IPFS')
    expect(row('ipfs')?.textContent).toContain('Занято 40 МБ из 2 ГБ')
  })

  it('другой предел уходит в приложение вместе с прежним вторым', async () => {
    await mountTab()
    buttonIn(row('web'), '250 МБ')!.click()
    await flushPromises()
    expect(mocks.invoke).toHaveBeenCalledWith('storage_set_limits', {
      limits: { web: 250 * MB, ipfs: 2048 * MB },
    })
  })

  it('«Очистить» чистит именно этот кэш', async () => {
    await mountTab()
    buttonIn(row('web'), 'Очистить')!.click()
    await flushPromises()
    expect(mocks.invoke).toHaveBeenCalledWith('storage_clear', { kind: 'web' })
  })

  it('выключили «Хранить расшифрованные сообщения» — сохранённые тексты стираются', async () => {
    await mountTab()
    expect(text()).toContain('Хранить расшифрованные сообщения')
    const toggle = document.body.querySelector<HTMLElement>('[data-testid="store-decrypted"]')
    expect(toggle?.getAttribute('aria-checked')).toBe('true')
    toggle!.click()
    for (let i = 0; i < 3; i++) await flushPromises()
    expect(mocks.clearAllDecrypted).toHaveBeenCalledTimes(1)
    expect(toggle?.getAttribute('aria-checked')).toBe('false')
  })
})
