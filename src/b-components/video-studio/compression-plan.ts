/**
 * Стоит ли сжимать видео перед загрузкой. Сжатие пережимает его в MP4 не выше
 * 1080p с битрейтом под разрешение; если файл и так не больше того, что
 * получится, время и качество тратятся зря — такое видео уходит как есть.
 */

import { selectTargetResolution } from '@/b-components/video-uploader/transcoder/resolution-selector'
import {
  MAX_AUDIO_BITRATE,
  getBitrateForResolution,
} from '@/b-components/video-uploader/utils/constants'

export interface VideoShape {
  width: number
  height: number
  /** Секунды. */
  duration: number
}

/** Сжатие должно сэкономить хотя бы пятую часть файла. */
export const MIN_SAVING = 0.2

/**
 * Сжатый файл приложение читает в память целиком, прежде чем отдать
 * загрузке: длиннее не берём (около получаса в 1080p).
 */
export const MAX_COMPRESS_OUTPUT_BYTES = 1024 ** 3

/** compress — сжимать; small — почти ничего не даст; long — слишком длинное. */
export type CompressionPlan = 'compress' | 'small' | 'long'

export function planCompression(shape: VideoShape | null, size: number): CompressionPlan {
  // Не знаем, что внутри, — решит FFmpeg.
  if (!shape || !(shape.duration > 0) || !(shape.width > 0) || !(shape.height > 0)) {
    return 'compress'
  }
  const target = selectTargetResolution(shape.width, shape.height)
  const targetKbps = getBitrateForResolution(target) + MAX_AUDIO_BITRATE
  const sourceKbps = (size * 8) / 1000 / shape.duration
  // Битрейт сжатие не поднимает: у скромного исходника он останется тем же.
  const estimate = ((Math.min(targetKbps, sourceKbps) * 1000) / 8) * shape.duration
  if (estimate > size * (1 - MIN_SAVING)) return 'small'
  if (estimate > MAX_COMPRESS_OUTPUT_BYTES) return 'long'
  return 'compress'
}

/**
 * Размер кадра и длительность силами браузера — без FFmpeg и без копирования
 * файла. null — этот формат браузер не читает (тогда спросим ffprobe).
 */
export function probeVideo(file: File, timeoutMs = 8000): Promise<VideoShape | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const finish = (shape: VideoShape | null): void => {
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(shape)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () =>
      finish(
        video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration)
          ? { width: video.videoWidth, height: video.videoHeight, duration: video.duration }
          : null
      )
    video.onerror = () => finish(null)
    video.src = url
  })
}
