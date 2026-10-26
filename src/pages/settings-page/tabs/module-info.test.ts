// «Модули»: под карточкой — сколько модуль занимает и какая у него версия;
// стоит прежняя — что новая скачается и встанет сама.

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

vi.mock('@/b-components/video-uploader/utils/environment', () => ({ isTauri: () => true }))

import ModuleInfo from './module-info.vue'
import { useStorageStore, type ModulesUsage, type StorageUsage } from '@/stores/storage-store'

const MB = 1024 * 1024

function usage(over: Partial<StorageUsage['versions']> = {}): StorageUsage {
  return {
    webCache: 0,
    ipfsCache: null,
    limits: { web: 512 * MB, ipfs: 2048 * MB },
    modules: { ipfs: 45 * MB, tor: 0, voice: 190 * MB, compression: 0, mesh: 0 },
    versions: { ipfs: null, tor: null, compression: null, mesh: null, ...over },
  }
}

const render = (module: keyof ModulesUsage) =>
  mount(ModuleInfo, { props: { module }, global: { plugins: [i18n] } })

describe('ModuleInfo', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('без замера строки нет', () => {
    expect(render('ipfs').find('[data-testid="module-info"]').exists()).toBe(false)
  })

  it('размер и версия', () => {
    useStorageStore().usage = usage({
      ipfs: { installed: '0.43.0', latest: '0.43.0', pending: false },
    })
    expect(render('ipfs').text()).toBe('На диске: 45 МБ · версия 0.43.0')
  })

  it('стоит прежняя — новая скачается и встанет сама', () => {
    useStorageStore().usage = usage({
      ipfs: { installed: '0.43.0', latest: '0.44.0', pending: true },
    })
    expect(render('ipfs').text()).toBe(
      'На диске: 45 МБ · версия 0.43.0, новая 0.44.0 скачается и встанет сама'
    )
  })

  it('у голосового ввода версии нет, у неизвестной версии — тоже', () => {
    useStorageStore().usage = usage({ tor: { installed: '', latest: '15.0.1', pending: true } })
    expect(render('voice').text()).toBe('На диске: 190 МБ')
    expect(render('tor').find('[data-testid="module-info"]').exists()).toBe(false)
  })
})
