import { ref } from 'vue'
import { transcoder } from '../transcoder'
import { storageManager } from '../utils'
import type { TranscodedVideo } from '@/db'
import type { TranscodeProgress, VideoMetadata } from '../transcoder/types'
import {
  selectTargetResolution,
  calculateTargetDimensions,
  getResolutionString,
} from '../transcoder/resolution-selector'
import { getBitrateForResolution, TARGET_FPS, MAX_FPS } from '../utils/constants'
import { getBestMimeType } from '../utils/environment'
import { calculateVideoBitrate } from '../components/video-info-panel/video-info-panel'
import { formatFileSize } from '../utils/video-formatter'
import { t } from '@/i18n'
import { message } from 'ant-design-vue'
import type { UploadState } from '../types'

export interface UseUploadStateOptions {
  onSaved?: () => void | Promise<void>
}

export function useUploadState(options: UseUploadStateOptions = {}) {
  const uploadState = ref<UploadState>('idle')
  const uploadProgress = ref(0)
  const uploadError = ref<string | null>(null)
  const selectedFile = ref<File | null>(null)

  let isTranscoding = false
  let currentTranscodeAbortController: AbortController | null = null

  const sourceMetadata = ref<VideoMetadata | null>(null)
  const targetWidth = ref(0)
  const targetHeight = ref(0)
  const targetResolution = ref('')
  const targetVideoBitrate = ref(0)
  const targetFps = ref(0)
  const targetMimeType = ref('')
  const transcoderName = ref('')
  const isWorker = ref(false)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      uploadError.value = t('videoMsg.selectVideoFile')
      uploadState.value = 'error'
      return
    }

    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      uploadError.value = t('videoMsg.fileTooLarge', {
        size: formatFileSize(file.size),
        max: formatFileSize(maxSize),
      })
      uploadState.value = 'error'
      return
    }

    selectedFile.value = file

    try {
      uploadState.value = 'analyzing'
      uploadError.value = null

      const metadata = await transcoder.getMetadata(file)
      sourceMetadata.value = metadata

      const targetRes = selectTargetResolution(metadata.width, metadata.height)
      const { width, height } = calculateTargetDimensions(
        metadata.width,
        metadata.height,
        targetRes
      )

      targetWidth.value = width
      targetHeight.value = height
      targetResolution.value = getResolutionString(targetRes)

      const sourceBitrate = metadata.videoBitrate
        ? metadata.videoBitrate
        : calculateVideoBitrate(file.size, metadata.duration)

      const calculatedTargetBitrate = getBitrateForResolution(targetRes)
      targetVideoBitrate.value = Math.min(calculatedTargetBitrate, sourceBitrate)

      targetFps.value = Math.min(TARGET_FPS, MAX_FPS)
      targetMimeType.value = getBestMimeType() || t('videoMsg.unknown')

      const transcoderInfo = transcoder.getTranscoderInfo()
      transcoderName.value =
        transcoderInfo.method === 'tauri'
          ? 'TauriTranscoder'
          : transcoderInfo.method === 'wasm'
            ? 'ffmpeg.wasm'
            : t('videoMsg.unknown')
      isWorker.value = transcoderInfo.method === 'wasm'

      uploadState.value = 'ready'
    } catch (error) {
      uploadState.value = 'error'
      const errorMessage = error instanceof Error ? error.message : t('videoMsg.analyzeError')
      uploadError.value = errorMessage
      console.error('File analysis error:', error)
    }
  }

  const resetUploadState = () => {
    if (isTranscoding) {
      return
    }
    uploadState.value = 'idle'
    uploadProgress.value = 0
    uploadError.value = null
    selectedFile.value = null
    sourceMetadata.value = null
    targetWidth.value = 0
    targetHeight.value = 0
    targetResolution.value = ''
    targetVideoBitrate.value = 0
    targetFps.value = 0
    targetMimeType.value = ''
    transcoderName.value = ''
    isWorker.value = false
  }

  const startTranscoding = async (file: File, metadata?: VideoMetadata) => {
    if (isTranscoding) {
      uploadError.value = t('videoMsg.transcodeInProgress')
      uploadState.value = 'error'
      return
    }

    isTranscoding = true
    currentTranscodeAbortController = new AbortController()

    try {
      const fileMetadata = metadata || (await transcoder.getMetadata(file))

      const estimatedSizeMB = (file.size * 0.7) / (1024 * 1024)
      const canSave = await storageManager.canSave(estimatedSizeMB)

      if (!canSave.canSave) {
        const cleanup = await storageManager.autoCleanup()
        // Авто-очистка раньше была молчаливой — теперь уведомляем, что именно удалили.
        if (cleanup.totalDeleted > 0) {
          message.info(t('videoMsg.autoCleanupNotice', { count: cleanup.totalDeleted }))
        }
        const canSaveAfterCleanup = await storageManager.canSave(estimatedSizeMB)
        if (!canSaveAfterCleanup.canSave) {
          throw new Error(canSaveAfterCleanup.reason || 'Storage limit reached')
        }
      }

      uploadState.value = 'transcoding'

      const sourceBitrate = fileMetadata.videoBitrate
        ? fileMetadata.videoBitrate
        : calculateVideoBitrate(file.size, fileMetadata.duration)

      const transcodeOptions = {
        videoBitrate: Math.min(targetVideoBitrate.value, sourceBitrate),
      }

      const result = await transcoder.transcode(
        file,
        transcodeOptions,
        (progress: TranscodeProgress) => {
          if (currentTranscodeAbortController?.signal.aborted) {
            return
          }
          uploadProgress.value = progress.progress
        }
      )

      if (currentTranscodeAbortController?.signal.aborted) {
        throw new Error(t('videoMsg.transcodeCancelled'))
      }

      uploadState.value = 'saving'

      const videoData: Omit<TranscodedVideo, 'createdAt' | 'updatedAt'> = {
        id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        originalFileName: file.name,
        originalSize: file.size,
        transcodedBlob: result.blob,
        resolution: result.resolution,
        bitrate: result.videoBitrate,
        hasAudio: result.hasAudio,
        duration: result.duration,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        fps: result.fps,
      }

      const sizeMB = result.blob.size / (1024 * 1024)
      await storageManager.saveWithCleanup(videoData, sizeMB)

      uploadState.value = 'completed'
      uploadProgress.value = 100

      await options.onSaved?.()

      setTimeout(() => {
        if (uploadState.value === 'completed') {
          resetUploadState()
        }
      }, 3000)
    } catch (error) {
      uploadState.value = 'error'
      const errorMessage = error instanceof Error ? error.message : t('videoMsg.transcodeError')
      let displayMessage: string
      if (errorMessage.includes('Storage limit')) {
        displayMessage = t('videoMsg.storageLimitReached')
      } else if (errorMessage.includes('not supported')) {
        displayMessage = t('videoMsg.transcodeNotSupported')
      } else {
        displayMessage = errorMessage.startsWith(t('videoMsg.transcodeError'))
          ? errorMessage
          : t('videoMsg.transcodeErrorPrefix', { message: errorMessage })
        const lower = errorMessage.toLowerCase()
        if (
          (lower.includes('ffmpeg') &&
            (lower.includes('no such file') ||
              lower.includes('not found') ||
              lower.includes('command not found'))) ||
          lower.includes('failed to execute ffmpeg')
        ) {
          displayMessage += ' ' + t('videoMsg.installFfmpegHint')
        }
      }
      uploadError.value = displayMessage
      console.error('Transcoding error:', error)
    } finally {
      isTranscoding = false
    }
  }

  const startTranscodingFromReady = async () => {
    if (!selectedFile.value) {
      uploadError.value = t('videoMsg.fileNotSelected')
      uploadState.value = 'error'
      return
    }

    const metadata = sourceMetadata.value
    if (!metadata) {
      uploadError.value = t('videoMsg.metadataNotFound')
      uploadState.value = 'error'
      return
    }

    await startTranscoding(selectedFile.value, metadata)
  }

  const cancelTranscoding = () => {
    if (isTranscoding) {
      if (currentTranscodeAbortController) {
        currentTranscodeAbortController.abort()
        currentTranscodeAbortController = null
      }

      transcoder.destroy()

      isTranscoding = false
      uploadState.value = 'idle'
      uploadProgress.value = 0
      uploadError.value = t('videoMsg.transcodeCancelled')
      selectedFile.value = null
      resetUploadState()
    }
  }

  return {
    uploadState,
    uploadProgress,
    uploadError,
    selectedFile,

    sourceMetadata,
    targetWidth,
    targetHeight,
    targetResolution,
    targetVideoBitrate,
    targetFps,
    targetMimeType,
    transcoderName,
    isWorker,

    handleFileSelect,
    resetUploadState,
    startTranscodingFromReady,
    cancelTranscoding,
  }
}
