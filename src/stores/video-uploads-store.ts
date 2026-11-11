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
 *
 * Пост к ролику пишут в том же окне: текст, теги, настройки. «Опубликовать»
 * можно нажать и во время загрузки — пост уйдёт сам, когда ролик загрузится,
 * даже если окно свернули (publish).
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import type { KeyPair } from '@/blockchain/types/keys'
import type { SharePostData } from '@/blockchain/core/actions/post-action'
import { i18n, t } from '@/i18n'
import { queryClient } from '@/query-client'
import { appToast } from '@/b-components/app-toast'
import { haptic } from '@/helpers/common/haptics'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import {
  describeVideoUploadError,
  titleFromFileName,
} from '@/b-components/content/post-composer/use-composer-video'
import { sendPost } from '@/b-components/content/post-composer/post-sender'
import { prefetchFeeUnspents } from '@/blockchain/core/transactions/unspents-manager'
import { trackPendingPost } from '@/b-components/content/post-composer/pending-post'
import { withTypedTag } from '@/b-components/content/post-composer/use-post-tags'
import { UPLOADING_VIDEO_POINTER } from '@/b-components/content/post-composer/consts'
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

/** Пост к ролику, как его заполнили в окне загрузки (заголовок — `title` ролика). */
export interface VideoPostDraft {
  message: string
  tags: string[]
  /** Набранный, но не добавленный тег: с ним пост тоже уйдёт. */
  tagInput: string
  language: string
  /** Видимость: '0' все, '1' подписчики, '2' зарегистрированные, '3' платные подписчики. */
  visibility: string
  /** Отложенная публикация: unix-секунды (0 — сразу). */
  scheduledTime: number
}

/**
 * «Опубликовать»: none — не нажимали; waiting — пост уйдёт, когда ролик
 * загрузится; sending — уходит; error — не ушёл, причина в `postError`.
 */
export type VideoPostStatus = 'none' | 'waiting' | 'sending' | 'error'

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
  post: VideoPostDraft
  postStatus: VideoPostStatus
  postError: string
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
  send: typeof sendPost
  /** Монеты на комиссию поста — заранее, чтобы «Опубликовать» их не ждал. */
  prefetchFee: (address: string | null | undefined) => void
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
  send: sendPost,
  prefetchFee: prefetchFeeUnspents,
})

/** Сколько ждать обложку, прежде чем сказать «Медиастудии», что ролик загружен. */
export const COVER_WAIT_MS = 30_000

const isActive = (job: VideoUploadJob): boolean =>
  job.status === 'compressing' || job.status === 'uploading'

/** Указатель-заглушка звука на время загрузки: только для проверки поста. */
const UPLOADING_AUDIO_POINTER = `${UPLOADING_VIDEO_POINTER}/audio`

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
  /**
   * Сколько раз ролики на сервере менялись: загрузка дошла вместе с обложкой,
   * дошли новое название или обложка. «Медиастудия» по нему перечитывает список.
   */
  const serverChanges = ref(0)

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
    deps.prefetchFee(useAuthStore().getUserAddress)
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
      post: {
        message: '',
        tags: [],
        tagInput: '',
        language: i18n.global.locale.value,
        visibility: '0',
        scheduledTime: 0,
      },
      postStatus: 'none',
      postError: '',
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
      // Пост — уже скоро: монеты на комиссию заранее (окно открыто давно).
      deps.prefetchFee(job.owner)
      // Название дописали, пока шла загрузка, — пусть и на сервере будет оно.
      void commitTitle(id)
      rt.cover?.attach({ host: result.host, uuid: result.uuid }, { audio: result.isAudio })
      void afterCover(rt)
      // «Опубликовать» нажали во время загрузки — пост уходит сейчас.
      void sendJobPost(id)
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
    // Пост ждал, пока вернутся на аккаунт, загрузивший ролик.
    for (const job of jobs.value) void sendJobPost(job.id)
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
      serverChanges.value++
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
    const rt = runtime.get(id)
    rt?.cover?.set(image, source, time)
    if (rt && find(id)?.status === 'done') void afterCover(rt)
  }

  function retryCover(id: string): void {
    const rt = runtime.get(id)
    if (rt?.cover?.state.status !== 'error') return
    rt.cover.retry()
    void afterCover(rt)
  }

  /**
   * Обложка дошла до сервера (или не смогла) — ролик на сервере изменился.
   * Раньше не говорим: получив обложку, сервер удаляет миниатюру, которую
   * сделал сам, и список, прочитанный до этого, показал бы её или пустое
   * место вместо выбранной картинки. Зависший запрос ждём не дольше
   * COVER_WAIT_MS — ролик в списке важнее.
   */
  async function afterCover(rt: JobRuntime): Promise<void> {
    await settleCover(rt)
    serverChanges.value++
  }

  /** Обложка дошла до сервера или не смогла; зависший запрос — не дольше COVER_WAIT_MS. */
  async function settleCover(rt: JobRuntime): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      rt.cover?.flush(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, COVER_WAIT_MS)
      }),
    ])
    clearTimeout(timer)
  }

  /** Дождаться, пока обложка дойдёт до сервера (перед постом). */
  async function commitCover(id: string): Promise<void> {
    await runtime.get(id)?.cover?.flush()
  }

  /** Поправить пост к ролику: текст, теги, настройки. */
  function updatePost(id: string, patch: Partial<VideoPostDraft>): void {
    const job = find(id)
    if (job && job.postStatus !== 'sending') Object.assign(job.post, patch)
  }

  /**
   * Пост к ролику в виде для сети. Пока ролик грузится, вместо указателя —
   * заглушка: по ней пост проверяется как видео или звук (заголовок обязателен).
   */
  function postFor(id: string): SharePostData | null {
    const job = find(id)
    if (!job) return null
    const { post } = job
    // Пробным аккаунтам видимость не ограничить — как в окне поста.
    const trial = useAuthStore().getUserState?.trial === true
    const settings: SharePostData['settings'] = { f: trial ? '0' : post.visibility }
    if (post.scheduledTime > 1) settings.t = post.scheduledTime
    const audio = runtime.get(id)?.file.type.startsWith('audio/') ?? false
    return {
      message: post.message.trim(),
      caption: job.title.trim(),
      url: job.result?.pointer ?? (audio ? UPLOADING_AUDIO_POINTER : UPLOADING_VIDEO_POINTER),
      tags: withTypedTag(post.tags, post.tagInput),
      images: [],
      language: post.language,
      settings,
    }
  }

  /**
   * «Опубликовать»: ролик загружен — пост уходит сразу, иначе — как только
   * загрузится, хоть окно и свернули. Не ушёл — «Опубликовать» ещё раз.
   */
  function publish(id: string): void {
    const job = find(id)
    if (!job || job.postStatus === 'sending') return
    job.postStatus = 'waiting'
    job.postError = ''
    void sendJobPost(id)
  }

  /** Передумали, пока ролик грузится: он загрузится, пост — нет. */
  function cancelPublish(id: string): void {
    const job = find(id)
    if (job?.postStatus === 'waiting') job.postStatus = 'none'
  }

  async function sendJobPost(id: string): Promise<void> {
    const job = find(id)
    const rt = runtime.get(id)
    if (!job || !rt || job.postStatus !== 'waiting' || job.status !== 'done' || !job.result) return
    // Пост — от имени аккаунта, загрузившего ролик: выбран другой — ждём (attach).
    if (useAuthStore().getUserAddress !== job.owner) return
    job.postStatus = 'sending'
    try {
      // Название и обложка — на сервер раньше поста: в ленте сразу они.
      await Promise.all([commitTitle(id), settleCover(rt)])
      const post = postFor(id)!
      const txid = await deps.send(post)
      trackPendingPost(post, txid)
      haptic('small')
      appToast.success({ message: t('postMsg.publishSuccess') })
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
      if (dialogJobId.value === id) dialogOpen.value = false
      remove(id)
    } catch (error) {
      log.warn('post failed', error)
      job.postStatus = 'error'
      // Сетевой сбой — словами («Сеть Bastyon не отвечает…»), а не строкой
      // «All RPC servers failed. Last error: …»: она остаётся в журнале.
      job.postError =
        error instanceof Error ? extractErrorMessage(error) : t('postMsg.errSendFailed')
      appToast.error({ message: t('videoStudio.postFailed'), description: job.postError })
    }
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
    serverChanges,
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
    updatePost,
    postFor,
    publish,
    cancelPublish,
    setDepsForTests,
  }
})
