// Окно загрузки, как в творческой студии YouTube: файл выбран — загрузка уже
// идёт, окно можно свернуть; по состоянию — «Отменить»/«Свернуть»,
// «Убрать»/«Повторить», «Готово»/«Создать пост». На компьютере с FFmpeg —
// «Сначала сжать на этом компьютере».

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: false,
  ffmpeg: true,
  openComposer: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('./compress-for-upload', () => ({
  compressionAvailable: async () => mocks.ffmpeg,
}))
vi.mock('./use-open-composer-with-video', () => ({
  useOpenComposerWithVideo: () => mocks.openComposer,
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { info: mocks.toastInfo } }))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getKeyPair: { privateKey: 'k' }, getUserAddress: 'PMe' }),
}))

import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import UploadDialog from './upload-dialog.vue'

let wrapper: VueWrapper | null = null

const text = (): string => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const button = (label: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

async function open(): Promise<ReturnType<typeof useVideoUploadsStore>> {
  const store = useVideoUploadsStore()
  store.openDialog()
  wrapper = mount(UploadDialog, {
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  await flushPromises()
  return store
}

function pickFile(name: string, size = 1000, type = 'video/mp4'): void {
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([new Uint8Array(size)], name, { type })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
}

describe('UploadDialog', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.desktop = false
    mocks.ffmpeg = true
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('выбор файла: в вебе сжатия нет, загрузка начинается сразу и видна в окне', async () => {
    const store = await open()
    const start = vi.spyOn(store, 'start').mockReturnValue(null)
    expect(text()).toContain('Перетащите сюда видео или звук')
    expect(text()).not.toContain('Сначала сжать')
    pickFile('Отпуск.mp4')
    expect(start).toHaveBeenCalledWith(expect.any(File), { compress: false })
  })

  it('на компьютере с FFmpeg — сжатие по умолчанию; файл больше 500 МБ грузится без него', async () => {
    mocks.desktop = true
    const store = await open()
    const start = vi.spyOn(store, 'start').mockReturnValue(null)
    expect(text()).toContain('Сначала сжать на этом компьютере')
    pickFile('a.mp4')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: true })
    pickFile('big.mp4', 600 * 1024 * 1024)
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: false })
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
    // Звук не сжимаем — это пережатие видео.
    pickFile('song.mp3', 1000, 'audio/mpeg')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: false })
  })

  it('на компьютере без FFmpeg — подсказка, как его поставить', async () => {
    mocks.desktop = true
    mocks.ffmpeg = false
    await open()
    expect(text()).toContain('если установлен FFmpeg')
    expect(text()).not.toContain('Сначала сжать на этом компьютере')
  })

  it('идёт загрузка: прогресс, «Свернуть» не останавливает её, «Отменить загрузку» — да', async () => {
    const store = await open()
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    store.jobs[0]!.progress = 42
    await flushPromises()
    expect(text()).toMatch(/Загрузка: 42\s?%/)
    expect((document.getElementById('video-studio-title') as HTMLInputElement).value).toBe('Отпуск')
    button('Свернуть')!.click()
    await flushPromises()
    expect(store.dialogOpen).toBe(false)
    expect(store.jobs).toHaveLength(1)

    store.openDialog(id)
    await flushPromises()
    button('Отменить загрузку')!.click()
    expect(store.jobs).toHaveLength(0)
  })

  it('сбой — причина и «Повторить»; готово — «Создать пост» с видео и названием', async () => {
    const store = await open()
    store.setDepsForTests({
      upload: vi.fn().mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce({
        pointer: 'peertube://pt.host/uuid1',
        host: 'pt.host',
        uuid: 'uuid1',
        isAudio: false,
      }),
      rename: vi.fn(),
    })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('error'))
    await flushPromises()
    expect(button('Повторить')).toBeDefined()
    button('Повторить')!.click()
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    await flushPromises()
    expect(text()).toContain('Видео загружено')
    button('Создать пост')!.click()
    await flushPromises()
    expect(mocks.openComposer).toHaveBeenCalledWith({
      pointer: 'peertube://pt.host/uuid1',
      title: 'Отпуск',
    })
    expect(store.dialogOpen).toBe(false)
    expect(store.jobs).toHaveLength(0)
  })
})
