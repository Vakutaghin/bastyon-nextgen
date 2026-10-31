/**
 * Загрузки видео, как в творческой студии YouTube: начатая загрузка живёт здесь,
 * а не в окне, поэтому её не прерывает ни закрытие окна, ни переход по
 * приложению. Окно загрузки (upload-dialog) и плашка «Загрузки» в углу
 * (uploads-panel) — два вида одних и тех же задач; обе смонтированы в src.vue.
 *
 * Задача: (сжатие на компьютере →) загрузка на видеосервер PeerTube → указатель
 * `peertube://host/uuid[/audio]` для поста. «Повторить» продолжает загрузку с
 * места обрыва (транспорт помнит upload_id). У ролика есть обложка: у видео —
 * первый кадр, у звука — та, что сделает сервер, или то, что выбрал человек;
 * сервер получает её, когда ролик загружен.
 *
 * Загрузка принадлежит аккаунту, который её начал: идёт его ключами до конца,
 * даже если аккаунт переключили, но видна и доступна только ему (attach).
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import type { KeyPair } from '@/blockchain/types/keys'
import {
  describeVideoUploadError,
  titleFromFileName,
} from '@/b-components/content/post-composer/use-composer-video'
import { uploadVideoToPeertube } from '@/services/peertube/peertube-video-service'
import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import {
  getInstanceVideoCover,
  renameInstanceVideo,
  saveVideoCover,
} from '@/services/peertube/peertube-videos'
import { buildPeertubeSignature, ensurePeertubeToken } from '@/services/peertube/peertube-auth'
import { logger } from '@/services/logger'
import { useModalStore } from './modal-store'
import type {
  CompressOptions,
  CompressOutcome,
  CompressSkip,
} from '@/b-components/video-studio/compress-for-upload'
import {
  createVideoCover,
  type CoverSource,
  type VideoCover,
  type VideoCoverState,
} from '@/b-components/video-studio/video-cover'
import { firstFrame } from '@/b-components/video-studio/video-frames'

const log = logger.scope('[video-uploads]')

export type VideoUploadStatus = 'compressing' | 'uploading' | 'done' | 'error'

export interface VideoUploadResult {
  pointer: string
  host: string
  uuid: string
  isAudio: boolean
}

export interface VideoUploadJob {
  id: string
  /** Адрес аккаунта, начавшего загрузку. */
  owner: string
  fileName: string
  size: number
  /** Название ролика: им же станет заголовок поста. */
  title: string
  status: VideoUploadStatus
  /** Проценты текущего шага (сжатия или загрузки). */
  progress: number
  /** Сжать на этом компьютере перед загрузкой. */
  compress: boolean
  /** Сжатие ждёт очереди: FFmpeg занят другим видео. */
  waiting: boolean
  /** Видео ушло без сжатия — почему (null — сжато или сжимать не просили). */
  compressSkipped: CompressSkip | null
  error: string
  result: VideoUploadResult | null
  startedAt: number
  /** Обложка ролика. */
  cover?: VideoCoverState
}

interface UploadAuthor {
  keyPair: KeyPair
  address: string
}

interface JobRuntime {
  /** Ключи аккаунта, начавшего загрузку: ролик уходит в его канал. */
  author: UploadAuthor
  file: File
  /** Сжатый файл: при повторе загрузки второй раз не сжимаем. */
  uploadFile: File | null
  controller: AbortController | null
  /** Имя, под которым видео сейчас на сервере. */
  serverName: string
  cover: VideoCover | null
}

/** Подмена шагов в тестах. */
export interface VideoUploadsDeps {
  upload: typeof uploadVideoToPeertube
  rename: typeof renameInstanceVideo
  compress: (file: File, options: CompressOptions) => Promise<CompressOutcome>
  firstFrame: (file: File) => Promise<Blob | null>
  saveCover: typeof saveVideoCover
  serverCover: typeof getInstanceVideoCover
}

const defaultDeps = (): VideoUploadsDeps => ({
  upload: uploadVideoToPeertube,
  rename: renameInstanceVideo,
  compress: async (file, options) =>
    (await import('@/b-components/video-studio/compress-for-upload')).compressForUpload(
      file,
      options
    ),
  firstFrame,
  saveCover: saveVideoCover,
  serverCover: getInstanceVideoCover,
})

const isActive = (job: VideoUploadJob): boolean =>
  job.status === 'compressing' || job.status === 'uploading'

export const useVideoUploadsStore = defineStore('video-uploads', () => {
  /** Загрузки текущего аккаунта. */
  const jobs = ref<VideoUploadJob[]>([])
  /** Загрузки других аккаунтов этого устройства: идут, но не видны. */
  let parked: VideoUploadJob[] = []
  /** Окно загрузки открыто; `dialogJobId` — какая задача в нём (null — выбор файла). */
  const dialogOpen = ref(false)
  const dialogJobId = ref<string | null>(null)
  /** Плашка «Загрузки» свёрнута до заголовка. */
  const panelCollapsed = ref(false)
  /** Плашку закрыли — до следующей загрузки. */
  const panelHidden = ref(false)

  const runtime = new Map<string, JobRuntime>()
  let deps: VideoUploadsDeps = defaultDeps()

  const activeJobs = computed(() => jobs.value.filter(isActive))
  const dialogJob = computed(() => jobs.value.find((j) => j.id === dialogJobId.value) ?? null)

  const find = (id: string): VideoUploadJob | undefined =>
    jobs.value.find((j) => j.id === id) ?? parked.find((j) => j.id === id)

  function auth(): UploadAuthor | null {
    const authStore = useAuthStore()
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress
    return keyPair && address ? { keyPair, address } : null
  }

  /** Открыть окно: выбор файла или уже идущая загрузка. */
  function openDialog(jobId: string | null = null): void {
    dialogJobId.value = jobId && find(jobId) ? jobId : null
    dialogOpen.value = true
  }

  /** Закрыть окно; идущая загрузка продолжается в плашке. */
  function closeDialog(): void {
    const job = dialogJob.value
    dialogOpen.value = false
    if (job) void commitTitle(job.id)
  }

  /** Начать загрузку файла; null — не вошли (открывается вход). */
  function start(file: File, options: { compress?: boolean } = {}): string | null {
    const author = auth()
    if (!author) {
      useModalStore().openAuthModal('login')
      return null
    }
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const title = titleFromFileName(file.name)
    const cover = createCover(author, file.type.startsWith('audio/'))
    jobs.value.unshift({
      id,
      owner: author.address,
      fileName: file.name,
      size: file.size,
      title,
      status: options.compress ? 'compressing' : 'uploading',
      progress: 0,
      compress: !!options.compress,
      waiting: false,
      compressSkipped: null,
      error: '',
      result: null,
      startedAt: Date.now(),
      cover: cover?.state,
    })
    runtime.set(id, { author, file, uploadFile: null, controller: null, serverName: title, cover })
    cover?.begin(file)
    panelHidden.value = false
    void run(id)
    return id
  }

  async function run(id: string): Promise<void> {
    const job = find(id)
    const rt = runtime.get(id)
    if (!job || !rt) return
    const controller = new AbortController()
    rt.controller = controller
    job.error = ''

    try {
      let file = rt.uploadFile ?? rt.file
      if (job.compress && !rt.uploadFile) {
        job.status = 'compressing'
        job.progress = 0
        job.waiting = true
        const outcome = await deps.compress(rt.file, {
          signal: controller.signal,
          onStart: () => {
            if (rt.controller === controller) job.waiting = false
          },
          onProgress: (percent) => {
            if (rt.controller === controller) job.progress = Math.min(100, Math.round(percent))
          },
        })
        file = outcome.file
        rt.uploadFile = file
        job.compressSkipped = outcome.skipped
      }
      if (rt.controller !== controller) return

      const { author } = rt
      job.status = 'uploading'
      job.progress = 0
      const name = job.title.trim() || titleFromFileName(rt.file.name)
      rt.serverName = name
      const result = await deps.upload({
        file,
        name,
        keyPair: author.keyPair,
        address: author.address,
        signal: controller.signal,
        onProgress: (p) => {
          if (rt.controller === controller) job.progress = Math.min(100, Math.round(p.percent))
        },
      })
      if (rt.controller !== controller) return
      job.result = { ...result }
      job.status = 'done'
      job.progress = 100
      // Название дописали, пока шла загрузка, — пусть и на сервере будет оно.
      void commitTitle(id)
      rt.cover?.attach({ host: result.host, uuid: result.uuid }, { audio: result.isAudio })
    } catch (error) {
      if (rt.controller !== controller) return
      if (error instanceof PeertubeUploadError && error.cancelled) return
      log.warn('upload failed', error)
      job.error = describeVideoUploadError(error)
      job.status = 'error'
      job.waiting = false
    } finally {
      if (rt.controller === controller) rt.controller = null
    }
  }

  /** Отменить: сжатие этого видео останавливается, недогруженный файл сервер удаляет. */
  function cancel(id: string): void {
    const rt = runtime.get(id)
    rt?.controller?.abort()
    if (rt) rt.controller = null
    remove(id)
  }

  /** Тот же файл ещё раз: загрузка продолжится с места обрыва. */
  function retry(id: string): void {
    const job = find(id)
    if (!job || job.status !== 'error') return
    void run(id)
  }

  /** Убрать законченную или упавшую загрузку из списка. */
  function dismiss(id: string): void {
    const job = find(id)
    if (job && !isActive(job)) remove(id)
  }

  function remove(id: string): void {
    jobs.value = jobs.value.filter((j) => j.id !== id)
    parked = parked.filter((j) => j.id !== id)
    forget(id)
    if (dialogJobId.value === id) dialogJobId.value = null
  }

  function forget(id: string): void {
    runtime.get(id)?.cover?.dispose()
    runtime.delete(id)
  }

  /** Закрыть плашку: законченные убираются, идущие загрузки продолжаются. */
  function hidePanel(): void {
    jobs.value = jobs.value.filter(isActive)
    for (const id of [...runtime.keys()]) if (!find(id)) forget(id)
    panelHidden.value = jobs.value.length > 0
  }

  /**
   * Сменился аккаунт: видны только его загрузки, загрузки прежнего идут
   * дальше незаметно и вернутся, когда на него переключатся. Окно загрузки
   * прежнего закрывается — в нём были бы его ролик и его кнопка «В пост».
   */
  function attach(address: string | null): void {
    const all = [...jobs.value, ...parked]
    jobs.value = all.filter((j) => j.owner === address)
    parked = all.filter((j) => j.owner !== address)
    if (dialogJobId.value && !jobs.value.some((j) => j.id === dialogJobId.value)) {
      dialogJobId.value = null
      dialogOpen.value = false
    }
    panelHidden.value = false
  }

  /** Аккаунт ушёл с устройства: его загрузки отменяются, ключей больше нет. */
  function forgetAccount(address: string | null): void {
    for (const job of [...jobs.value, ...parked]) {
      if (address === null || job.owner === address) cancel(job.id)
    }
  }

  function setTitle(id: string, title: string): void {
    const job = find(id)
    if (job) job.title = title
  }

  /** Видео уже на сервере под другим именем — переименовать (без шума при сбое). */
  async function commitTitle(id: string): Promise<void> {
    const job = find(id)
    const rt = runtime.get(id)
    const title = job?.title.trim()
    if (!job || !rt || job.status !== 'done' || !job.result || !title || title === rt.serverName)
      return
    const { author } = rt
    const { host, uuid } = job.result
    try {
      const signature = buildPeertubeSignature(author.keyPair, author.address)
      const token = await ensurePeertubeToken({ host, address: author.address, signature })
      await deps.rename({ host, id: uuid, name: title, accessToken: token.access_token })
      rt.serverName = title
    } catch (e) {
      log.warn('rename failed', e)
    }
  }

  function createCover(author: UploadAuthor, audio: boolean): VideoCover {
    return createVideoCover(
      {
        firstFrame: (file) => deps.firstFrame(file),
        save: async ({ host, uuid }, image) => {
          await deps.saveCover({ host, uuid, image, ...author })
        },
        serverCover: ({ host, uuid }) => deps.serverCover({ host, id: uuid }),
      },
      { audio }
    )
  }

  /** Исходный файл: из него выбирают кадр обложки. */
  function fileOf(id: string): File | null {
    return runtime.get(id)?.file ?? null
  }

  /** Новая обложка: сервер получит её сразу, если видео уже загружено. */
  function setCover(id: string, image: Blob, source: CoverSource, time = 0): void {
    runtime.get(id)?.cover?.set(image, source, time)
  }

  function retryCover(id: string): void {
    runtime.get(id)?.cover?.retry()
  }

  /** Дождаться, пока обложка дойдёт до сервера (перед постом). */
  async function commitCover(id: string): Promise<void> {
    await runtime.get(id)?.cover?.flush()
  }

  /** Подмена шагов — только для тестов. */
  function setDepsForTests(next: Partial<VideoUploadsDeps>): void {
    deps = { ...defaultDeps(), ...next }
  }

  return {
    jobs,
    activeJobs,
    dialogOpen,
    dialogJobId,
    dialogJob,
    panelCollapsed,
    panelHidden,
    openDialog,
    closeDialog,
    start,
    cancel,
    retry,
    dismiss,
    hidePanel,
    attach,
    forgetAccount,
    setTitle,
    commitTitle,
    fileOf,
    setCover,
    retryCover,
    commitCover,
    setDepsForTests,
  }
})
