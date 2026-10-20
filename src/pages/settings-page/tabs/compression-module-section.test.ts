// Настройки → модуль сжатия видео: статус (установлен / FFmpeg из системы /
// не установлен), «Скачать» с размером, «Удалить» с подтверждением. В вебе
// раздела нет.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: true,
  installed: false,
  tools: false,
  invoke: vi.fn(),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))

import CompressionModuleSection from './compression-module-section.vue'

let wrapper: VueWrapper | null = null
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const button = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

async function mountSection(): Promise<void> {
  wrapper = mount(CompressionModuleSection, {
    attachTo: document.body,
    global: { plugins: [i18n] },
  })
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await vi.dynamicImportSettled()
  }
}

describe('CompressionModuleSection', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.desktop = true
    mocks.installed = false
    mocks.tools = false
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'ffmpeg_module_status')
        return { supported: true, installed: mocks.installed, size: 38_000_000 }
      if (cmd === 'check_ffmpeg_available')
        return { ffmpeg: mocks.tools, ffprobe: mocks.tools, x264: mocks.tools }
      if (cmd === 'ffmpeg_module_remove') mocks.installed = false
      return undefined
    })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('не установлен — «Скачать» с размером', async () => {
    await mountSection()
    expect(text()).toContain('Модуль сжатия видео')
    expect(text()).toContain('Не установлен')
    expect(button('Скачать (36 МБ)')).toBeTruthy()
  })

  it('FFmpeg уже есть в системе — модуль не нужен', async () => {
    mocks.tools = true
    await mountSection()
    expect(text()).toContain('Работает FFmpeg из системы')
    expect(button('Скачать (36 МБ)')).toBeUndefined()
  })

  it('установлен — «Удалить» спрашивает и удаляет', async () => {
    mocks.installed = true
    mocks.tools = true
    await mountSection()
    expect(text()).toContain('Установлен')
    button('Удалить')!.click()
    await flushPromises()
    expect(text()).toContain('Удалить модуль сжатия?')
    const confirm = [...document.body.querySelectorAll('.ant-modal-confirm-btns button')].find(
      (b) => b.textContent?.trim() === 'Удалить'
    ) as HTMLButtonElement
    confirm.click()
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('ffmpeg_module_remove', undefined)
    )
  })

  it('в вебе раздела нет', async () => {
    mocks.desktop = false
    await mountSection()
    expect(text()).not.toContain('Модуль сжатия видео')
  })
})
