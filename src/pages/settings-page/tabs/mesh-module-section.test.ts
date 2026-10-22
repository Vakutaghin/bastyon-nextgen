// Модуль mesh-сетей на компьютере: на странице «Mesh-сети» — «Скачать модуль»,
// пока его нет, и «Обновить», если он прошлой версии; в настройках — статус и
// «Удалить». На Android mesh встроен — карточки нет.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: true,
  installed: false,
  current: false,
  invoke: vi.fn(),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))

import MeshModuleSection from './mesh-module-section.vue'
import { useMeshModuleStore } from '@/stores/mesh-module-store'

let wrapper: VueWrapper | null = null
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const button = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

async function mountSection(page = false): Promise<void> {
  wrapper = mount(MeshModuleSection, {
    props: { page },
    attachTo: document.body,
    global: { plugins: [i18n] },
  })
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await vi.dynamicImportSettled()
  }
}

describe('MeshModuleSection', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.desktop = true
    mocks.installed = false
    mocks.current = false
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'mesh_module_status')
        return {
          supported: true,
          installed: mocks.installed,
          current: mocks.current,
          installing: false,
          running: false,
          size: 2_300_000,
        }
      if (cmd === 'mesh_module_install') {
        mocks.installed = true
        mocks.current = true
      }
      return undefined
    })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('страница: модуля нет — «Скачать модуль» с размером, после скачивания карточка уходит', async () => {
    await mountSection(true)
    expect(text()).toContain('Модуль mesh-сетей')
    expect(text()).toContain('Не установлен')
    const download = button('Скачать модуль (2.2 МБ)')
    expect(download).toBeTruthy()
    expect(useMeshModuleStore().ready).toBe(false)

    download!.click()
    for (let i = 0; i < 3; i++) await flushPromises()
    expect(mocks.invoke).toHaveBeenCalledWith('mesh_module_install', undefined)
    expect(useMeshModuleStore().ready).toBe(true)
    expect(text()).not.toContain('Модуль mesh-сетей')
  })

  it('страница: модуль прошлой версии — «Обновить», без «Удалить»', async () => {
    mocks.installed = true
    await mountSection(true)
    expect(text()).toContain('Есть новая версия')
    expect(button('Обновить (2.2 МБ)')).toBeTruthy()
    expect(button('Удалить')).toBeUndefined()
  })

  it('настройки: модуль на месте — «Установлен» и «Удалить» с подтверждением', async () => {
    mocks.installed = true
    mocks.current = true
    await mountSection()
    expect(text()).toContain('Установлен')
    expect(button('Обновить (2.2 МБ)')).toBeUndefined()
    button('Удалить')!.click()
    await flushPromises()
    expect(text()).toContain('Удалить модуль mesh-сетей?')
  })

  it('ошибка скачивания — понятная причина', async () => {
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'mesh_module_status')
        return { supported: true, installed: false, current: false, size: 2_300_000 }
      if (cmd === 'mesh_module_install') throw 'hash_mismatch: bastyon-mesh-darwin-aarch64.gz'
      return undefined
    })
    await mountSection(true)
    button('Скачать модуль (2.2 МБ)')!.click()
    for (let i = 0; i < 3; i++) await flushPromises()
    expect(text()).toContain('Скачанный файл не совпал с ожидаемым')
  })

  it('Android: mesh встроен — карточки нет, модуль не нужен', async () => {
    mocks.desktop = false
    await mountSection(true)
    expect(text()).not.toContain('Модуль mesh-сетей')
    expect(useMeshModuleStore().ready).toBe(true)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
})
