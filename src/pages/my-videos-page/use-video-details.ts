/**
 * Окно ролика в «Медиастудии», вкладка «Сведения»: что о ролике знает
 * видеосервер, и то, что у него можно поменять, — название, описание и
 * обложку. Правки копятся и уходят по «Сохранить», как в творческой студии
 * YouTube: сначала текст (PUT JSON), потом обложка (PUT multipart). Текст ушёл,
 * а обложка нет — текст уже сохранён, обложка ждёт повторного «Сохранить».
 *
 * Название и описание ролика на видеосервере — не текст поста: пост лежит в
 * блокчейне и правится в самом посте. Описание здесь видно в «Медиастудии» и
 * на странице ролика на видеосервере.
 */

import { computed, reactive, ref, shallowRef, watch, type Ref } from 'vue'

import type { CoverSource, VideoCoverState } from '@/b-components/video-studio/video-cover'
import {
  getInstanceVideoDescription,
  getInstanceVideoDetails,
  updateInstanceVideo,
  VIDEO_DESCRIPTION_MAX,
  VIDEO_DESCRIPTION_MIN,
  VIDEO_NAME_MAX,
  VIDEO_NAME_MIN,
  type InstanceVideoDetails,
  type InstanceVideoFile,
  type VideoTextChanges,
} from '@/services/peertube/peertube-video-studio'
import { getVideosInfo, setInstanceVideoCover } from '@/services/peertube/peertube-videos'
import { logger } from '@/services/logger'
import type { ServerVideo } from './use-server-videos'

const log = logger.scope('[video-details]')

/** Кадры для обложки — из файла не выше этой высоты: хватает и грузится быстрее. */
export const FRAMES_MAX_HEIGHT = 720
/** Столько знаков описания видеосервер отдаёт в списках. */
export const LIST_DESCRIPTION_LENGTH = 250

export type DetailsStatus = 'loading' | 'ready' | 'error' | 'gone'

export interface VideoDetailsDeps {
  getDetails: typeof getInstanceVideoDetails
  getDescription: typeof getInstanceVideoDescription
  update: typeof updateInstanceVideo
  setCover: typeof setInstanceVideoCover
  /** Токен автора на сервере ролика. */
  token: (host: string) => Promise<string>
  /** Обновить кэш ноды: ролики из постов «Медиастудия» берёт оттуда. */
  refreshNode: (pointer: string) => Promise<unknown>
}

/** Ошибка поля: какой предел нарушен. */
export type FieldError = 'nameShort' | 'descriptionShort' | null

/** Чем закончилось «Сохранить». */
export type SaveResult = 'saved' | 'failed' | 'coverFailed' | 'unchanged'

/** Изменения, которые надо показать в списке «Медиастудии». */
export type ListChanges = Partial<
  Pick<ServerVideo, 'name' | 'description' | 'thumbnailUrl' | 'views'>
>

const absolute = (host: string, path: string | null): string | null =>
  !path
    ? null
    : /^https?:\/\//.test(path)
      ? path
      : `https://${host}${path.startsWith('/') ? '' : '/'}${path}`

/** Файл для кадров обложки: лучший не выше 720p, иначе самый лёгкий. */
export function framesFile(files: InstanceVideoFile[]): InstanceVideoFile | null {
  const video = files.filter((file) => file.height > 0)
  return (
    video.find((file) => file.height <= FRAMES_MAX_HEIGHT) ??
    video.reduce<InstanceVideoFile | null>(
      (low, file) => (!low || file.height < low.height ? file : low),
      null
    )
  )
}

export function useVideoDetails(
  video: Ref<ServerVideo>,
  options: {
    deps?: Partial<VideoDetailsDeps>
    /** Список «Медиастудии»: показать сохранённое без перезагрузки. */
    onChanged?: (changes: ListChanges) => void
  } = {}
) {
  const deps: VideoDetailsDeps = {
    getDetails: getInstanceVideoDetails,
    getDescription: getInstanceVideoDescription,
    update: updateInstanceVideo,
    setCover: setInstanceVideoCover,
    refreshNode: (pointer) => getVideosInfo({ urls: [pointer], update: true }),
    token: () => Promise.reject(new Error('no_token')),
    ...options.deps,
  }

  const status = ref<DetailsStatus>('loading')
  const details = shallowRef<InstanceVideoDetails | null>(null)
  /** Что сейчас на сервере. */
  const saved = reactive({ name: '', description: '' })
  const form = reactive({ name: '', description: '' })
  const saving = ref(false)

  /** Обложка для выбора: текущая с сервера или выбранная, ещё не сохранённая. */
  const cover = reactive<VideoCoverState>({
    url: '',
    source: null,
    time: 0,
    status: 'none',
    busy: false,
    audio: false,
  })
  let coverImage: Blob | null = null
  let serverCoverUrl = ''

  const releaseCoverUrl = (): void => {
    if (cover.url.startsWith('blob:')) URL.revokeObjectURL(cover.url)
  }

  function showServerCover(found: InstanceVideoDetails): void {
    const { host } = video.value
    serverCoverUrl =
      absolute(host, found.previewPath ?? found.thumbnailPath) ?? video.value.thumbnailUrl ?? ''
    releaseCoverUrl()
    coverImage = null
    cover.url = serverCoverUrl
    cover.source = serverCoverUrl ? 'current' : null
    cover.time = 0
    cover.audio = found.isAudio
  }

  async function load(): Promise<void> {
    const { host, uuid, id } = video.value
    status.value = 'loading'
    try {
      const [found, description] = await Promise.all([
        deps.getDetails({ host, id: uuid || id }),
        deps.getDescription({ host, id: uuid || id }),
      ])
      if (!found) {
        status.value = 'gone'
        return
      }
      details.value = found
      saved.name = found.name
      saved.description = description
      form.name = found.name
      form.description = description
      showServerCover(found)
      status.value = 'ready'
      if (found.views !== video.value.views) options.onChanged?.({ views: found.views })
    } catch (e) {
      log.warn('load failed', host, e)
      status.value = 'error'
    }
  }

  const nameError = computed<FieldError>(() =>
    form.name.trim().length < VIDEO_NAME_MIN ? 'nameShort' : null
  )
  const descriptionError = computed<FieldError>(() => {
    const length = form.description.trim().length
    return length > 0 && length < VIDEO_DESCRIPTION_MIN ? 'descriptionShort' : null
  })

  const textChanges = computed<VideoTextChanges>(() => {
    const changes: VideoTextChanges = {}
    const name = form.name.trim()
    const description = form.description.trim()
    if (name !== saved.name.trim()) changes.name = name
    if (description !== saved.description.trim()) changes.description = description || null
    return changes
  })

  const coverChanged = ref(false)
  const dirty = computed(() => Object.keys(textChanges.value).length > 0 || coverChanged.value)
  const canSave = computed(
    () =>
      status.value === 'ready' &&
      dirty.value &&
      !saving.value &&
      !nameError.value &&
      !descriptionError.value
  )

  function pickCover(image: Blob, source: CoverSource, time = 0): void {
    releaseCoverUrl()
    coverImage = image
    cover.url = URL.createObjectURL(image)
    cover.source = source
    cover.time = time
    coverChanged.value = true
  }

  function reset(): void {
    form.name = saved.name
    form.description = saved.description
    if (details.value) showServerCover(details.value)
    coverChanged.value = false
  }

  async function save(): Promise<SaveResult> {
    if (!canSave.value) return 'unchanged'
    const { host, uuid, id, pointer } = video.value
    const target = uuid || id
    const changes = textChanges.value
    saving.value = true
    try {
      const accessToken = await deps.token(host)
      const listChanges: ListChanges = {}
      if (Object.keys(changes).length) {
        await deps.update({ host, id: target, accessToken, changes })
        if (changes.name !== undefined) {
          saved.name = changes.name
          listChanges.name = changes.name
        }
        if (changes.description !== undefined) {
          saved.description = changes.description ?? ''
          listChanges.description = saved.description.slice(0, LIST_DESCRIPTION_LENGTH)
        }
        form.name = saved.name
        form.description = saved.description
      }
      if (coverChanged.value && coverImage) {
        try {
          const image = new File([coverImage], 'cover.jpg', { type: 'image/jpeg' })
          await deps.setCover({ host, id: target, image, accessToken })
          coverChanged.value = false
          cover.source = 'current'
          // Новая миниатюра — новый файл на сервере: путь берём заново.
          const fresh = await deps.getDetails({ host, id: target }).catch(() => null)
          if (fresh) {
            details.value = fresh
            serverCoverUrl =
              absolute(host, fresh.previewPath ?? fresh.thumbnailPath) ?? serverCoverUrl
            const thumbnail = absolute(host, fresh.thumbnailPath)
            if (thumbnail) listChanges.thumbnailUrl = thumbnail
          }
        } catch (e) {
          log.warn('cover failed', host, e)
          if (Object.keys(listChanges).length) options.onChanged?.(listChanges)
          // Текст ушёл, обложка нет — сказать именно это; менялась одна обложка — просто не сохранилось.
          return Object.keys(changes).length ? 'coverFailed' : 'failed'
        }
      }
      if (Object.keys(listChanges).length) options.onChanged?.(listChanges)
      void deps.refreshNode(pointer).catch((e: unknown) => log.debug('node refresh failed', e))
      return 'saved'
    } catch (e) {
      log.warn('save failed', host, e)
      return 'failed'
    } finally {
      saving.value = false
    }
  }

  /** Ссылка на файл ролика для кадров обложки; null — у звука или файлов нет. */
  const framesUrl = computed<string | null>(() => {
    const found = details.value
    if (!found || found.isAudio) return null
    return framesFile(found.files)?.fileUrl ?? null
  })

  function dispose(): void {
    releaseCoverUrl()
  }

  watch(
    () => video.value.pointer,
    () => void load(),
    { immediate: true }
  )

  return {
    status,
    details,
    form,
    cover,
    saving,
    dirty,
    canSave,
    nameError,
    descriptionError,
    framesUrl,
    limits: {
      nameMin: VIDEO_NAME_MIN,
      nameMax: VIDEO_NAME_MAX,
      descriptionMin: VIDEO_DESCRIPTION_MIN,
      descriptionMax: VIDEO_DESCRIPTION_MAX,
    },
    load,
    pickCover,
    reset,
    save,
    dispose,
  }
}
