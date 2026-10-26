// «Модули» → Tor: скачан ли, сколько занимает, «Удалить» — только у выключенного.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ installed: true, invoke: vi.fn() }))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({ isTauri: () => true }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))

import TorModuleSection from './tor-module-section.vue'
import { useTorStore } from '@/stores/tor-store'

let wrapper: VueWrapper | null = null
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const button = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

async function mountSection(): Promise<void> {
  wrapper = mount(TorModuleSection, { attachTo: document.body, global: { plugins: [i18n] } })
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await vi.dynamicImportSettled()
  }
}

describe('TorModuleSection', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.installed = true
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'tor_installed') return mocks.installed
      if (cmd === 'tor_uninstall') mocks.installed = false
      return undefined
    })
    useTorStore().available = true
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('не скачан — скачается при первом включении, удалять нечего', async () => {
    mocks.installed = false
    await mountSection()
    expect(text()).toContain('Не скачан')
    expect(text()).toContain('Скачается сам при первом включении Tor.')
    expect(button('Удалить')).toBeUndefined()
  })

  it('включён — «Удалить» недоступна, пока его не выключат', async () => {
    useTorStore().enabled = true
    await mountSection()
    expect(button('Удалить')?.disabled).toBe(true)
    expect(text()).toContain('Сначала выключите Tor.')
  })

  it('выключен — «Удалить» с подтверждением', async () => {
    await mountSection()
    expect(text()).toContain('Скачан')
    button('Удалить')!.click()
    await flushPromises()
    expect(text()).toContain('Удалить Tor?')
  })
})
