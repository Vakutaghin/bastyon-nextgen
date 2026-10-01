import type { TranscodedVideo } from '@/db/types'

export interface VideoListProps {
  videos: TranscodedVideo[]
  loading: boolean
  /** Заголовок раздела; по умолчанию «Сохранённые видео». */
  title?: string
  /** Текст пустого списка; по умолчанию «Нет сохранённых видео». */
  emptyText?: string
  /** Показать кнопку «Загрузить на видеосервер». */
  canUpload?: boolean
}

export interface VideoListEmits {
  play: [video: TranscodedVideo]
  info: [video: TranscodedVideo]
  delete: [video: TranscodedVideo]
  download: [video: TranscodedVideo]
  upload: [video: TranscodedVideo]
}
