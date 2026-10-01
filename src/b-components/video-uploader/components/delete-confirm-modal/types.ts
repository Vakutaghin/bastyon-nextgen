import type { TranscodedVideo } from '@/db/types'

export interface DeleteConfirmModalProps {
  open: boolean
  video: TranscodedVideo | null
}

export interface DeleteConfirmModalEmits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}
