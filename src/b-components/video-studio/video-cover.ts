/**
 * Обложка загружаемого видео. По умолчанию — первый кадр: его снимают, как
 * только файл выбран. Человек может выбрать другой кадр или свою картинку,
 * пока видео грузится или после. Видеосервер получает обложку, когда у него
 * уже есть видео (PUT videos/:id), и каждый новый выбор — тоже; сохранения идут
 * по очереди, последним остаётся последний выбор.
 *
 * Без своей обложки PeerTube берёт кадр из середины ролика.
 */

import { reactive } from 'vue'

import { firstFrame } from './video-frames'

/** Откуда обложка: первый кадр, выбранный кадр или своя картинка. */
export type CoverSource = 'first' | 'frame' | 'image'

/** none — обложки нет (кадр не взять), её выберет видеосервер. */
export type CoverStatus = 'none' | 'pending' | 'saving' | 'saved' | 'error'

export interface VideoCoverState {
  /** Картинка обложки (blob:) или пусто. */
  url: string
  source: CoverSource | null
  /** Секунда кадра. */
  time: number
  status: CoverStatus
  /** Снимается первый кадр или обложка уходит на сервер: пост пока не публиковать. */
  busy: boolean
}

export interface VideoCoverTarget {
  host: string
  uuid: string
}

export interface VideoCoverDeps {
  firstFrame: (file: File) => Promise<Blob | null>
  save: (target: VideoCoverTarget, image: File) => Promise<void>
}

export interface VideoCover {
  readonly state: VideoCoverState
  /** Файл выбран: снять первый кадр, если человек ещё ничего не выбрал. */
  begin(file: File): void
  set(image: Blob, source: CoverSource, time?: number): void
  /** Видео уже на сервере: отправить обложку и дальше отправлять каждый выбор. */
  attach(target: VideoCoverTarget): void
  retry(): void
  /** Дождаться, пока обложка снимется и сохранится. */
  flush(): Promise<void>
  dispose(): void
}

export function createVideoCover(deps: Pick<VideoCoverDeps, 'save'> & Partial<VideoCoverDeps>) {
  const grabFirst = deps.firstFrame ?? firstFrame
  const state = reactive<VideoCoverState>({
    url: '',
    source: null,
    time: 0,
    status: 'none',
    busy: false,
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

  function set(next: Blob, source: CoverSource, time = 0): void {
    if (disposed) return
    if (state.url) URL.revokeObjectURL(state.url)
    image = next
    state.url = URL.createObjectURL(next)
    state.source = source
    state.time = time
    state.status = 'pending'
    save()
  }

  function begin(file: File): void {
    if (disposed || grabbing || image) return
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

  function attach(next: VideoCoverTarget): void {
    target = next
    save()
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
    if (state.url) URL.revokeObjectURL(state.url)
    state.url = ''
  }

  return { state, begin, set, attach, retry, flush, dispose } satisfies VideoCover
}
