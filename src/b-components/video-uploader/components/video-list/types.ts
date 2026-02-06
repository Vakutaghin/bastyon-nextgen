import type { TranscodedVideo } from '@/db'

export interface VideoListProps {
  videos: TranscodedVideo[]
  loading: boolean
}

export interface VideoListEmits {
  play: [video: TranscodedVideo]
  info: [video: TranscodedVideo]
  delete: [video: TranscodedVideo]
  download: [video: TranscodedVideo]
}
