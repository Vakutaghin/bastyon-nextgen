import { Modal } from 'ant-design-vue'
import {
  SC_InfoContent,
  SC_InfoRow,
  SC_InfoLabel,
  SC_InfoValue
} from './styled'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' КБ'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' МБ'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ'
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function useVideoInfoModal() {
  return {
    Modal,
    SC_InfoContent,
    SC_InfoRow,
    SC_InfoLabel,
    SC_InfoValue,
    formatFileSize,
    formatDuration
  }
}
