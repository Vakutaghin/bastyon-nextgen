import type { TranscodedVideo } from '@/db'

export interface VideoPlayerModalProps {
  video: TranscodedVideo | null
  videoUrl: string | null
}

export interface VideoPlayerModalEmits {
  (e: 'close'): void
}
