/**
 * Обложка загружаемого видео или звука. У видео по умолчанию — первый кадр:
 * его снимают, как только файл выбран. Человек может выбрать другой кадр или
 * свою картинку, пока файл грузится или после. Видеосервер получает обложку,
 * когда у него уже есть ролик (PUT videos/:id), и каждый новый выбор — тоже;
 * сохранения идут по очереди, последним остаётся последний выбор.
 *
 * Без своей обложки видеосервер Bastyon делает её сам: у видео — кадр из
 * середины, у звука — картинку, вшитую в файл, а без неё — заставку Bastyon.
 * Её показываем, когда ролик загружен.
 */

import { reactive } from 'vue'

import { firstFrame } from './video-frames'

/**
 * Откуда обложка: первый кадр, выбранный кадр, своя картинка, видеосервер или
 * (в «Медиастудии») обложка, которая у ролика уже стоит.
 */
export type CoverSource = 'first' | 'frame' | 'image' | 'server' | 'current'

/** none — своей обложки нет, её делает видеосервер. */
export type CoverStatus = 'none' | 'pending' | 'saving' | 'saved' | 'error'

export interface VideoCoverState {
  /** Картинка обложки (blob: своя, https: от видеосервера) или пусто. */
  url: string
  source: CoverSource | null
  /** Секунда кадра. */
  time: number
  status: CoverStatus
  /** Снимается первый кадр или обложка уходит на сервер: пост пока не публиковать. */
  busy: boolean
  /** Это звук: кадров нет, только своя картинка или обложка видеосервера. */
  audio: boolean
}

export interface VideoCoverTarget {
  host: string
  uuid: string
}

export interface VideoCoverDeps {
  firstFrame: (file: File) => Promise<Blob | null>
  save: (target: VideoCoverTarget, image: File) => Promise<void>
  /** Обложка, которую видеосервер сделал сам: URL картинки или null. */
  serverCover: (target: VideoCoverTarget) => Promise<string | null>
}

export interface VideoCover {
  readonly state: VideoCoverState
  /** Файл выбран: снять первый кадр, если человек ещё ничего не выбрал. */
  begin(file: File): void
  set(image: Blob, source: CoverSource, time?: number): void
  /**
   * Ролик уже на сервере: отправить обложку и дальше отправлять каждый выбор.
   * `audio` — сервер сказал, что это звук (MIME у файла мог быть пустым).
   */
  attach(target: VideoCoverTarget, options?: { audio?: boolean }): void
  retry(): void
  /** Дождаться, пока обложка снимется и сохранится. */
  flush(): Promise<void>
  dispose(): void
}

const isBlobUrl = (url: string): boolean => url.startsWith('blob:')

export function createVideoCover(
  deps: Pick<VideoCoverDeps, 'save'> & Partial<VideoCoverDeps>,
  options: { audio?: boolean } = {}
) {
  const grabFirst = deps.firstFrame ?? firstFrame
  const state = reactive<VideoCoverState>({
    url: '',
    source: null,
    time: 0,
    status: 'none',
    busy: false,
    audio: !!options.audio,
  })
  let image: Blob | null = null
  let target: VideoCoverTarget | null = null
  let grabbing: Promise<void> | null = null
  let saving: Promise<void> | null = null
  let dirty = false
  let disposed = false

  const syncBusy = (): void => {
    state.busy = !!grabbing || !!saving
  }

  const releaseUrl = (): void => {
    if (isBlobUrl(state.url)) URL.revokeObjectURL(state.url)
    state.url = ''
  }

  function set(next: Blob, source: CoverSource, time = 0): void {
    if (disposed) return
    releaseUrl()
    image = next
    state.url = URL.createObjectURL(next)
    state.source = source
    state.time = time
    state.status = 'pending'
    save()
  }

  function begin(file: File): void {
    if (disposed || state.audio || grabbing || image) return
    grabbing = grabFirst(file)
      .then((frame) => {
        if (frame && !image) set(frame, 'first', 0)
      })
      .catch(() => {})
      .finally(() => {
        grabbing = null
        syncBusy()
      })
    syncBusy()
  }

  function save(): void {
    if (!target || !image) return
    dirty = true
    if (!saving) {
      saving = drain().finally(() => {
        saving = null
        syncBusy()
      })
      syncBusy()
    }
  }

  async function drain(): Promise<void> {
    while (dirty && target && image) {
      dirty = false
      const current = image
      state.status = 'saving'
      try {
        await deps.save(target, new File([current], 'cover.jpg', { type: 'image/jpeg' }))
        if (!dirty && !disposed) state.status = 'saved'
      } catch {
        if (!dirty && !disposed) state.status = 'error'
      }
    }
  }

  /** Своей обложки нет — показать ту, что видеосервер сделал сам. */
  function showServerCover(at: VideoCoverTarget): void {
    deps
      .serverCover?.(at)
      .then((url) => {
        if (!url || image || disposed) return
        state.url = url
        state.source = 'server'
      })
      .catch(() => {})
  }

  function attach(next: VideoCoverTarget, attachOptions: { audio?: boolean } = {}): void {
    target = next
    if (attachOptions.audio && !state.audio) {
      state.audio = true
      // Кадр у «звука» — разве что картинка из файла; её сервер возьмёт сам.
      if (state.source === 'first') {
        image = null
        releaseUrl()
        state.source = null
        state.status = 'none'
      }
    }
    if (image) save()
    else showServerCover(next)
  }

  function retry(): void {
    if (state.status === 'error') save()
  }

  async function flush(): Promise<void> {
    await grabbing
    await saving
  }

  function dispose(): void {
    disposed = true
    releaseUrl()
  }

  return { state, begin, set, attach, retry, flush, dispose } satisfies VideoCover
}
