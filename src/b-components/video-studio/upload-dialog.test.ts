// Окно загрузки, как в творческой студии YouTube: файл выбран — загрузка уже
// идёт, окно можно свернуть; по состоянию — «Отменить»/«Свернуть»,
// «Убрать»/«Повторить», «Сохранить без поста». На компьютере с FFmpeg —
// «Сначала сжать на этом компьютере»; без него — скачать модуль сжатия.
// У видео — обложка: первый кадр, свой кадр или картинка. Пост пишут здесь
// же — описание, теги, настройки — и «Опубликовать» одной кнопкой, хоть во
// время загрузки: пост уйдёт сам, когда ролик загрузится.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: false,
  ffmpeg: true,
  supported: true,
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
vi.mock('@/b-components/app-toast', () => ({
  appToast: { info: mocks.toastInfo, success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/helpers/common/haptics', () => ({ haptic: vi.fn() }))
// Подсказки тегов спрашивают ноду; здесь они не нужны.
vi.mock('@/composables/use-rpc-query', async () => {
  const { ref } = await import('vue')
  return { useRpcQuery: () => ({ data: ref(null) }) }
})
vi.mock('@/b-components/content/post-composer/pending-post', () => ({ trackPendingPost: vi.fn() }))
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

/** Набрать в поле, как человек: значение и событие input. */
function type(selector: string, value: string): void {
  const field = document.body.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

const hint = (): string =>
  document.body.querySelector('[data-testid="video-post-hint"]')?.textContent?.trim() ?? ''

const RESULT = {
  pointer: 'peertube://pt.host/uuid1',
  host: 'pt.host',
  uuid: 'uuid1',
  isAudio: false,
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
      owner: 'PMe',
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
      post: {
        message: '',
        tags: [],
        tagInput: '',
        language: 'ru',
        visibility: '0',
        scheduledTime: 0,
      },
      postStatus: 'none',
      postError: '',
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

  it('сбой — причина и «Повторить»; готово — описание, теги и «Опубликовать» с видео и названием', async () => {
    const store = await open()
    const send = vi.fn(async () => 'tx1')
    store.setDepsForTests({
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce(RESULT),
      rename: vi.fn(),
      send,
    })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('error'))
    await flushPromises()
    button('Повторить')!.click()
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    await flushPromises()
    expect(text()).toContain('Видео загружено')
    // Чего не хватает — видно сразу, а не после нажатия.
    expect(hint()).toBe('Добавьте хотя бы один тег')
    expect(button('Опубликовать')!.disabled).toBe(true)

    type('#video-studio-text', 'Лучшие моменты')
    // Тег набран, Enter не нажат — всё равно считается.
    type('input[aria-label="Добавьте теги…"]', 'отпуск')
    await flushPromises()
    expect(hint()).toBe('')
    expect(button('Опубликовать')!.disabled).toBe(false)
    button('Опубликовать')!.click()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: 'Отпуск',
        message: 'Лучшие моменты',
        tags: ['отпуск'],
        url: RESULT.pointer,
      })
    )
    await vi.waitFor(() => expect(store.jobs).toHaveLength(0))
    expect(store.dialogOpen).toBe(false)
  })

  it('пробел после слова на телефоне — слово становится тегом', async () => {
    const store = await open()
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await flushPromises()
    type('input[aria-label="Добавьте теги…"]', 'море, горы ')
    await flushPromises()
    expect(store.jobs[0]!.post.tags).toEqual(['море', 'горы'])
    expect(store.jobs[0]!.post.tagInput).toBe('')
    expect(text()).toContain('#море')
  })

  it('«Опубликовать» во время загрузки — окно сворачивается, пост уходит сам, второй раз жать не нужно', async () => {
    const store = await open()
    let finish: (v: typeof RESULT) => void = () => {}
    const send = vi.fn(async () => 'tx1')
    store.setDepsForTests({
      upload: vi.fn(() => new Promise<typeof RESULT>((resolve) => (finish = resolve))),
      rename: vi.fn(),
      send,
    })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await flushPromises()
    type('input[aria-label="Добавьте теги…"]', 'отпуск')
    await flushPromises()
    button('Опубликовать')!.click()
    await flushPromises()
    expect(store.dialogOpen).toBe(false)
    expect(mocks.toastInfo).toHaveBeenCalledWith({
      message: 'Пост опубликуется, когда ролик загрузится',
    })
    expect(send).not.toHaveBeenCalled()

    // Окно снова открыли — видно, что пост ждёт; передумать можно.
    store.openDialog(id)
    await flushPromises()
    expect(hint()).toBe('Пост опубликуется, когда ролик загрузится. Окно можно свернуть.')
    expect(button('Не публиковать')).toBeTruthy()
    store.closeDialog()

    finish(RESULT)
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(store.jobs).toHaveLength(0))
  })

  it('«Не публиковать» — ролик загружается, пост не уходит', async () => {
    const store = await open()
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.updatePost(id, { tags: ['отпуск'] })
    store.publish(id)
    store.openDialog(id)
    await flushPromises()
    button('Не публиковать')!.click()
    await flushPromises()
    expect(store.jobs[0]!.postStatus).toBe('none')
    expect(button('Опубликовать')).toBeTruthy()
  })

  it('«Сохранить без поста» — окно закрывается, ролик остаётся в загрузках', async () => {
    const store = await open()
    store.setDepsForTests({ upload: vi.fn().mockResolvedValue(RESULT), rename: vi.fn() })
    const id = store.start(new File(['x'], 'Отпуск.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    await flushPromises()
    button('Сохранить без поста')!.click()
    expect(store.dialogOpen).toBe(false)
    expect(store.jobs.map((j) => j.id)).toEqual([id])
  })

  it('обложка видна в окне, а пост уходит, только когда она дошла до сервера', async () => {
    const store = await open()
    let saved: () => void = () => {}
    const send = vi.fn(async () => 'tx1')
    store.setDepsForTests({
      upload: vi.fn().mockResolvedValue(RESULT),
      rename: vi.fn(),
      send,
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

    store.updatePost(id, { tags: ['отпуск'] })
    await flushPromises()
    button('Опубликовать')!.click()
    await flushPromises()
    expect(hint()).toBe('Публикую пост…')
    expect(send).not.toHaveBeenCalled()
    saved()
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
  })
})
