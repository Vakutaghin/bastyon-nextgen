import type { TranscodedVideo } from '@/db/types'

export interface VideoInfoModalProps {
  open: boolean
  video: TranscodedVideo | null
}

export interface VideoInfoModalEmits {
  (e: 'close'): void
}
