// Окно загрузки, как в творческой студии YouTube: файл выбран — загрузка уже
// идёт, окно можно свернуть; по состоянию — «Отменить»/«Свернуть»,
// «Убрать»/«Повторить», «Готово»/«Создать пост». На компьютере с FFmpeg —
// «Сначала сжать на этом компьютере»; без него — скачать модуль сжатия.
// У видео — обложка: первый кадр, свой кадр или картинка.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: false,
  ffmpeg: true,
  supported: true,
  openComposer: vi.fn(),
  toastInfo: vi.fn(),
  install: vi.fn(async () => {}),
  progress: null as ((e: { payload: { received: number; total: number } }) => void) | null,
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string) => {
    switch (cmd) {
      case 'ffmpeg_module_status':
        return { supported: mocks.supported, installed: false, size: 38_000_000 }
      case 'check_ffmpeg_available':
        return { ffmpeg: mocks.ffmpeg, ffprobe: mocks.ffmpeg, x264: mocks.ffmpeg }
      case 'ffmpeg_module_install':
        return mocks.install()
      default:
        return undefined
    }
  },
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (_event: string, cb: typeof mocks.progress) => {
    mocks.progress = cb
    return () => {}
  },
}))
vi.mock('@/services/peertube/peertube-videos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/peertube/peertube-videos')>()),
  // Обложка от видеосервера — без сети.
  getInstanceVideoCover: vi.fn(async () => null),
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
  await settle()
  return store
}

/** Стор модуля сжатия грузит Tauri через import() — ждём и его. */
async function settle(): Promise<void> {
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
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
    mocks.supported = true
    mocks.install.mockImplementation(async () => {})
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

  it('на компьютере с FFmpeg — сжатие по умолчанию, и большого видео тоже; звук не сжимаем', async () => {
    mocks.desktop = true
    const store = await open()
    const start = vi.spyOn(store, 'start').mockReturnValue(null)
    expect(text()).toContain('Сначала сжать на этом компьютере')
    expect(text()).not.toContain('Скачать модуль сжатия')
    pickFile('a.mp4')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: true })
    // Файл уходит в FFmpeg кусками — прежнего предела в 500 МБ нет.
    pickFile('big.mp4', 600 * 1024 * 1024)
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: true })
    pickFile('song.mp3', 1000, 'audio/mpeg')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: false })
  })

  it('без FFmpeg — модуль сжатия по кнопке: размер, проценты, потом сжатие', async () => {
    mocks.desktop = true
    mocks.ffmpeg = false
    let finish: () => void = () => {}
    mocks.install.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    const store = await open()
    const start = vi.spyOn(store, 'start').mockReturnValue(null)
    expect(text()).not.toContain('Сначала сжать на этом компьютере')
    expect(text()).toMatch(/Он скачивается один раз: 36 МБ/)
    pickFile('a.mp4')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: false })

    button('Скачать модуль сжатия')!.click()
    await settle()
    mocks.progress!({ payload: { received: 15_200_000, total: 38_000_000 } })
    await flushPromises()
    expect(text()).toMatch(/Скачиваю модуль сжатия: 40\s?%/)

    mocks.ffmpeg = true
    finish()
    await settle()
    expect(text()).toContain('Сначала сжать на этом компьютере')
    pickFile('b.mp4')
    expect(start).toHaveBeenLastCalledWith(expect.any(File), { compress: true })
  })

  it('модуль не скачался — причина, кнопка остаётся', async () => {
    mocks.desktop = true
    mocks.ffmpeg = false
    mocks.install.mockRejectedValue('download_failed: 503')
    await open()
    button('Скачать модуль сжатия')!.click()
    await settle()
    expect(text()).toContain('Не удалось скачать модуль сжатия.')
    expect(button('Скачать модуль сжатия')).toBeTruthy()
  })

  it('модуля для этой системы нет — подсказка, как поставить FFmpeg', async () => {
    mocks.desktop = true
    mocks.ffmpeg = false
    mocks.supported = false
    await open()
    expect(text()).toContain('если установлен FFmpeg')
    expect(button('Скачать модуль сжатия')).toBeUndefined()
  })

  it('сжимать не стали — окно говорит почему', async () => {
    const store = await open()
    store.jobs.unshift({
      id: 'j1',
      fileName: 'Кот.mp4',
      size: 1000,
      title: 'Кот',
      status: 'uploading',
      progress: 10,
      compress: true,
      waiting: false,
      compressSkipped: 'small',
      error: '',
      result: null,
      startedAt: 0,
    })
    store.openDialog('j1')
    await flushPromises()
    expect(text()).toContain('Сжимать не стали: видео и так компактное')
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

  it('обложка видна в окне, а «Создать пост» ждёт, пока она дойдёт до сервера', async () => {
    const store = await open()
    let saved: () => void = () => {}
    store.setDepsForTests({
      upload: vi.fn().mockResolvedValue({
        pointer: 'peertube://pt.host/uuid1',
        host: 'pt.host',
        uuid: 'uuid1',
        isAudio: false,
      }),
      rename: vi.fn(),
      firstFrame: async () => new Blob(['first'], { type: 'image/jpeg' }),
      saveCover: vi.fn(() => new Promise<void>((resolve) => (saved = resolve))),
    })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.status).toBe('saving'))
    await flushPromises()
    expect(text()).toContain('Первый кадр')
    expect(text()).toContain('Сохраняю обложку')
    expect(document.body.querySelector('button[aria-label="Как выбрать обложку"]')).toBeTruthy()
    expect(button('Загрузить картинку')).toBeUndefined()
    expect(text()).toContain('Загрузить картинку')

    button('Создать пост')!.click()
    await flushPromises()
    expect(mocks.openComposer).not.toHaveBeenCalled()
    saved()
    await vi.waitFor(() => expect(mocks.openComposer).toHaveBeenCalled())
  })
})
