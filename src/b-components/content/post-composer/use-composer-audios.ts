/**
 * Записи аудио-поста в композере: одна или несколько (аудиокнига по главам,
 * альбом). Файлы грузятся на PeerTube по очереди; первая запись становится `u`
 * поста, остальные уходят в настройки (helpers/content/post-audios).
 *
 * Обложка у поста одна — обложка первой записи: её показывают лента и прежний
 * Bastyon. Порядок поменяли — выбранная картинка сохраняется у новой первой.
 */

import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue'

import type { KeyPair } from '@/blockchain/types/keys'
import { composePeerTubeUrl, parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { MAX_AUDIO_TITLE, MAX_POST_AUDIOS, type PostAudio } from '@/helpers/content/post-audios'
import {
  titleFromFileName,
  uploadVideoToPeertube,
} from '@/services/peertube/peertube-video-service'
import { getInstanceVideoCover, saveVideoCover } from '@/services/peertube/peertube-videos'
import {
  createVideoCover,
  type CoverSource,
  type VideoCover,
} from '@/b-components/video-studio/video-cover'
import { audioDuration } from './audio-file'
import { describeVideoUploadError, uploadErrorDetail } from './use-composer-video'

export type ComposerAudioStatus = 'queued' | 'uploading' | 'done' | 'error'

export interface ComposerAudio {
  id: string
  /** Название главы или трека. */
  title: string
  /** `peertube://…/audio`, когда файл на сервере. */
  url: string
  duration: number | null
  status: ComposerAudioStatus
  percent: number
  error: string
  /** Байты файла; 0 — файл загружен раньше (черновик, правка). */
  size: number
}

export interface UseComposerAudiosOptions {
  /** Ключи автора; null — не вошёл (композер откроет вход). */
  getAuth: () => { keyPair: KeyPair; address: string } | null
  onAuthRequired: () => void
  /** Первая запись на сервере — её название годится в заголовок поста. */
  onFirstUploaded?: (title: string) => void
  /** Подмена сервисов в тестах. */
  upload?: typeof uploadVideoToPeertube
  saveCover?: typeof saveVideoCover
  serverCover?: typeof getInstanceVideoCover
  duration?: (file: File) => Promise<number | null>
}

/** «2 глава» раньше «10 глава»: файлы встают по именам, как их видит человек. */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

let lastId = 0

export function useComposerAudios(options: UseComposerAudiosOptions) {
  const upload = options.upload ?? uploadVideoToPeertube
  const readDuration = options.duration ?? audioDuration

  const items = ref<ComposerAudio[]>([])
  const cover = shallowRef<VideoCover | null>(null)
  /** Файлы — вне реактивности: уходят в fetch и slice как есть. */
  const files = new Map<string, File>()
  let active: { id: string; controller: AbortController } | null = null

  const find = (id: string): ComposerAudio | undefined => items.value.find((x) => x.id === id)

  const full = computed(() => items.value.length >= MAX_POST_AUDIOS)
  const failed = computed(() => items.value.some((x) => x.status === 'error'))
  const uploading = computed(() =>
    items.value.some((x) => x.status === 'queued' || x.status === 'uploading')
  )
  /** Файлы грузятся или обложка ещё не на сервере: пост публиковать рано. */
  const busy = computed(() => uploading.value || !!cover.value?.state.busy)
  /** Записи на сервере, по порядку, — какими они уйдут с постом. */
  const uploaded = computed<PostAudio[]>(() =>
    items.value
      .filter((x) => x.status === 'done')
      .map((x) => ({ url: x.url, title: x.title.trim(), duration: x.duration }))
  )
  /** `u` поста. */
  const firstUrl = computed(() => uploaded.value[0]?.url ?? '')

  // ─── обложка ──────────────────────────────────────────────────────────────

  function createCover(): VideoCover {
    return createVideoCover(
      {
        save: async ({ host, uuid }, image) => {
          const auth = options.getAuth()
          if (!auth) throw new Error('peertube_token_signed_out')
          await (options.saveCover ?? saveVideoCover)({ host, uuid, image, ...auth })
        },
        serverCover: ({ host, uuid }) =>
          (options.serverCover ?? getInstanceVideoCover)({ host, id: uuid }),
      },
      { audio: true }
    )
  }

  // Первая запись сменилась или догрузилась — обложка теперь её.
  watch(firstUrl, (url) => {
    const at = url ? parsePeerTubeUrl(url) : null
    if (at) cover.value?.attach({ host: at.host, uuid: at.videoId }, { audio: true })
  })

  function dropCover(): void {
    cover.value?.dispose()
    cover.value = null
  }

  // ─── загрузка по очереди ──────────────────────────────────────────────────

  async function run(): Promise<void> {
    if (active) return
    const item = items.value.find((x) => x.status === 'queued')
    const file = item ? files.get(item.id) : undefined
    if (!item || !file) return
    const auth = options.getAuth()
    if (!auth) {
      options.onAuthRequired()
      return
    }
    const controller = new AbortController()
    const mine = { id: item.id, controller }
    active = mine
    item.status = 'uploading'
    item.percent = 0
    item.error = ''
    try {
      const result = await upload({
        file,
        name: item.title.trim() || titleFromFileName(file.name),
        keyPair: auth.keyPair,
        address: auth.address,
        signal: controller.signal,
        onProgress: (p) => {
          const current = find(mine.id)
          if (current && active === mine) current.percent = Math.min(100, Math.round(p.percent))
        },
      })
      const done = find(mine.id)
      if (done && active === mine) {
        // Файл — звук: и с вшитой картинкой, которую сервер принял за видео.
        done.url = composePeerTubeUrl(result.host, result.uuid, { isAudio: true })
        done.status = 'done'
        files.delete(done.id)
        if (items.value[0]?.id === done.id) options.onFirstUploaded?.(done.title)
      }
    } catch (error) {
      const broken = find(mine.id)
      // Убрали или закрыли окно — это отмена, а не сбой: запись уже не эта.
      if (broken && active === mine) {
        // console.error попадает в сведения для поддержки — с ответом сервера.
        console.error('[composer-audios] upload failed:', uploadErrorDetail(error))
        broken.error = describeVideoUploadError(error)
        broken.status = 'error'
      }
    } finally {
      if (active === mine) active = null
    }
    void run()
  }

  // ─── список ───────────────────────────────────────────────────────────────

  /** Добавить файлы: вместе выбранные встают по именам. */
  function add(list: readonly File[]): void {
    const picked = [...list]
      .sort((a, b) => byName.compare(a.name, b.name))
      .slice(0, MAX_POST_AUDIOS - items.value.length)
    if (!picked.length) return
    if (!options.getAuth()) {
      options.onAuthRequired()
      return
    }
    // Своя картинка — только у поста, собранного здесь: у черновика и правки
    // она уже выбрана.
    if (!items.value.length) cover.value = createCover()
    for (const file of picked) {
      const id = `a${++lastId}`
      files.set(id, file)
      items.value.push({
        id,
        title: titleFromFileName(file.name).slice(0, MAX_AUDIO_TITLE),
        url: '',
        duration: null,
        status: 'queued',
        percent: 0,
        error: '',
        size: file.size,
      })
      void readDuration(file).then((seconds) => {
        const item = find(id)
        if (item && seconds) item.duration = Math.round(seconds)
      })
    }
    void run()
  }

  /** Записи, которые уже на сервере: черновик, правка, «Медиастудия». */
  function restore(list: readonly PostAudio[]): void {
    clear()
    items.value = list.slice(0, MAX_POST_AUDIOS).map((audio) => ({
      id: `a${++lastId}`,
      title: audio.title,
      url: audio.url,
      duration: audio.duration,
      status: 'done',
      percent: 100,
      error: '',
      size: 0,
    }))
  }

  /** Убрать из поста; на сервере загруженное остаётся, как и видео. */
  function remove(id: string): void {
    if (active?.id === id) {
      active.controller.abort()
      active = null
    }
    files.delete(id)
    items.value = items.value.filter((x) => x.id !== id)
    if (!items.value.length) dropCover()
    void run()
  }

  /** Тот же файл ещё раз: загрузка продолжится с места обрыва. */
  function retry(id: string): void {
    const item = find(id)
    if (!item || item.status !== 'error' || !files.has(id)) return
    item.status = 'queued'
    void run()
  }

  function rename(id: string, title: string): void {
    const item = find(id)
    if (item) item.title = title.slice(0, MAX_AUDIO_TITLE)
  }

  function move(from: number, to: number): void {
    const list = [...items.value]
    const [item] = list.splice(from, 1)
    if (!item || to < 0 || to > list.length) return
    list.splice(to, 0, item)
    items.value = list
  }

  function clear(): void {
    active?.controller.abort()
    active = null
    files.clear()
    items.value = []
    dropCover()
  }

  const setCover = (image: Blob, source: CoverSource, time = 0): void =>
    cover.value?.set(image, source, time)
  const retryCover = (): void => cover.value?.retry()

  if (getCurrentScope()) onScopeDispose(clear)

  return {
    items,
    cover,
    full,
    failed,
    uploading,
    busy,
    uploaded,
    firstUrl,
    add,
    restore,
    remove,
    retry,
    rename,
    move,
    clear,
    setCover,
    retryCover,
  }
}
