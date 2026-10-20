/**
 * Сжатие перед загрузкой — только в приложении для компьютера: FFmpeg (модуль
 * сжатия или системный) пережимает файл в MP4 (H.264, звук AAC) не выше
 * 1080p, с битрейтом под разрешение. Копию на диске не храним: «Повторить»
 * берёт сжатый файл из задачи, а загруженный ролик — на сервере.
 *
 * Сжимаем, только когда это заметно уменьшит файл (compression-plan): иначе
 * видео уходит как есть. Не вышло сжать — тоже уходит как есть: загрузка
 * важнее сжатия.
 *
 * FFmpeg у приложения один: Rust держит один процесс, а прогресс шлёт общим
 * событием. Поэтому сжатия идут по очереди, а отмена останавливает FFmpeg,
 * только если он сейчас занят именно этим файлом.
 */

import { transcoder } from '@/b-components/video-uploader/transcoder'
import { logger } from '@/services/logger'
import { planCompression, probeVideo, type VideoShape } from './compression-plan'

const log = logger.scope('[video-studio]')

export interface CompressOptions {
  signal: AbortSignal
  onProgress: (percent: number) => void
  /** Очередь дошла: FFmpeg занялся этим файлом. */
  onStart?: () => void
}

/**
 * Почему видео ушло без сжатия: small — сжатие почти ничего не дало бы;
 * long — слишком длинное; failed — FFmpeg не справился.
 */
export type CompressSkip = 'small' | 'long' | 'failed'

export interface CompressOutcome {
  /** Что загружать: сжатый файл или исходный. */
  file: File
  skipped: CompressSkip | null
}

let queue: Promise<unknown> = Promise.resolve()

/** Пережать файл, если стоит. Отмена — через `signal`. */
export async function compressForUpload(
  file: File,
  options: CompressOptions
): Promise<CompressOutcome> {
  // Решаем до очереди: видео, которое сжимать не стоит, не ждёт чужого сжатия.
  const shape = await probeVideo(file)
  throwIfAborted(options.signal)
  const plan = planCompression(shape, file.size)
  if (plan !== 'compress') return { file, skipped: plan }

  const task = queue.then(() => compressNow(file, shape, options))
  queue = task.catch(() => undefined)
  return task
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
}

async function compressNow(
  file: File,
  shape: VideoShape | null,
  { signal, onProgress, onStart }: CompressOptions
): Promise<CompressOutcome> {
  throwIfAborted(signal)
  onStart?.()
  const stop = () => transcoder.destroy()
  signal.addEventListener('abort', stop, { once: true })
  try {
    if (!shape) {
      // Формат браузеру незнаком — решает ffprobe.
      const plan = planCompression(await transcoder.getMetadata(file), file.size)
      throwIfAborted(signal)
      if (plan !== 'compress') return { file, skipped: plan }
    }
    const result = await transcoder.transcode(file, {}, (progress) => {
      // Отменили, пока файл копировался и FFmpeg ещё не запустился, — гасим его теперь.
      if (signal.aborted) stop()
      else onProgress(progress.progress)
    })
    throwIfAborted(signal)
    const base = file.name.replace(/\.[^./\\]{1,8}$/, '') || 'video'
    const compressed = new File([result.blob], `${base}.mp4`, {
      type: result.mimeType || 'video/mp4',
    })
    return { file: compressed, skipped: null }
  } catch (e) {
    throwIfAborted(signal)
    log.warn('compression failed, uploading the original', e)
    return { file, skipped: 'failed' }
  } finally {
    signal.removeEventListener('abort', stop)
  }
}
