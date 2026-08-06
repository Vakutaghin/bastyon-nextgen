import type { VideoMetadata } from '../../transcoder/types'

export type UploadState =
  | 'idle'
  | 'analyzing'
  | 'ready'
  | 'transcoding'
  | 'saving'
  | 'completed'
  | 'error'

export interface UploadDropzoneProps {
  state: UploadState
  progress: number
  error: string | null
  fileName: string | null
  fileSize: number
  sourceMetadata: VideoMetadata | null
  targetWidth: number
  targetHeight: number
  targetResolution: string
  targetVideoBitrate: number
  targetFps: number
  targetMimeType: string
  transcoderName: string
  isWorker: boolean
}

export interface UploadDropzoneEmits {
  fileSelect: [file: File]
  start: []
  reset: []
  cancel: []
}
