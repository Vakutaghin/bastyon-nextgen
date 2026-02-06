import type { TranscodedVideo } from '@/db'

export interface VideoInfoModalProps {
  open: boolean
  video: TranscodedVideo | null
}

export interface VideoInfoModalEmits {
  (e: 'close'): void
}
