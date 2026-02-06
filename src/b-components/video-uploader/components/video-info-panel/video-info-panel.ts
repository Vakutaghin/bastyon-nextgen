import type { VideoMetadata } from '../../transcoder/types'

export interface VideoInfoPanelProps {
  sourceMetadata: VideoMetadata | null
  fileName: string | null
  fileSize: number
  targetWidth: number
  targetHeight: number
  targetResolution: string
  targetVideoBitrate: number
  targetFps: number
  targetMimeType: string
  transcoderName: string
  isWorker: boolean
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

/**
 * Форматирование длительности
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Вычислить битрейт видео из размера файла и длительности
 */
export function calculateVideoBitrate(fileSizeBytes: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0
  // Битрейт в kbps = (размер файла в байтах * 8) / (длительность в секундах * 1000)
  return Math.round((fileSizeBytes * 8) / (durationSeconds * 1000))
}
