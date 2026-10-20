/**
 * Сжатие перед загрузкой — только в приложении для компьютера: системный
 * FFmpeg пережимает файл в MP4 (H.264, звук AAC) не выше 1080p, с битрейтом
 * под разрешение — то же, что делало окно «Сжатие видео». Копию на диске не
 * храним: «Повторить» берёт сжатый файл из задачи, а загруженный ролик — на
 * сервере.
 *
 * FFmpeg у приложения один: Rust держит один процесс, а прогресс шлёт общим
 * событием. Поэтому сжатия идут по очереди, а отмена останавливает FFmpeg,
 * только если он сейчас занят именно этим файлом.
 */

import { transcoder } from '@/b-components/video-uploader/transcoder'
import { selectTargetResolution } from '@/b-components/video-uploader/transcoder/resolution-selector'
import { getBitrateForResolution } from '@/b-components/video-uploader/utils/constants'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { logger } from '@/services/logger'

const log = logger.scope('[video-studio]')

export interface CompressOptions {
  signal: AbortSignal
  onProgress: (percent: number) => void
  /** Очередь дошла: FFmpeg занялся этим файлом. */
  onStart?: () => void
}

let queue: Promise<unknown> = Promise.resolve()

/** Битрейт в кбит/с по размеру и длительности — когда ffprobe его не знает. */
function averageBitrate(fileSizeBytes: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0
  return Math.round((fileSizeBytes * 8) / (durationSeconds * 1000))
}

/** Есть ли чем сжимать: приложение для компьютера и FFmpeg с ffprobe в системе. */
export async function compressionAvailable(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const status = await transcoder.checkFfmpegAvailable()
    return status.ffmpeg && status.ffprobe
  } catch (e) {
    log.debug('ffmpeg check failed', e)
    return false
  }
}

/** Пережать файл; возвращает сжатый файл для загрузки. Отмена — через `signal`. */
export function compressForUpload(file: File, options: CompressOptions): Promise<File> {
  const task = queue.then(() => compressNow(file, options))
  queue = task.catch(() => undefined)
  return task
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
}

async function compressNow(
  file: File,
  { signal, onProgress, onStart }: CompressOptions
): Promise<File> {
  throwIfAborted(signal)
  onStart?.()
  const stop = () => transcoder.destroy()
  signal.addEventListener('abort', stop, { once: true })
  try {
    const metadata = await transcoder.getMetadata(file)
    throwIfAborted(signal)
    const target = selectTargetResolution(metadata.width, metadata.height)
    const sourceBitrate = metadata.videoBitrate || averageBitrate(file.size, metadata.duration)
    const result = await transcoder.transcode(
      file,
      { videoBitrate: Math.min(getBitrateForResolution(target), sourceBitrate) },
      (progress) => {
        // Отменили, пока файл копировался и FFmpeg ещё не запустился, — гасим его теперь.
        if (signal.aborted) stop()
        else onProgress(progress.progress)
      }
    )
    throwIfAborted(signal)
    const base = file.name.replace(/\.[^./\\]{1,8}$/, '') || 'video'
    return new File([result.blob], `${base}.mp4`, { type: result.mimeType || 'video/mp4' })
  } finally {
    signal.removeEventListener('abort', stop)
  }
}
