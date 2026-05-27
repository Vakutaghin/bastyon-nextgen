import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { transcoder } from './transcoder'
import { useVideoTranscoderInit } from './composables/use-video-transcoder-init'
import { useVideoManager } from './composables/use-video-manager'
import { useUploadState } from './composables/use-upload-state'
import { formatFileSize, formatDuration } from './utils/video-formatter'

export const videoUploaderOptions = defineComponent({
  name: 'VideoUploader',
  setup() {
    const isModalOpen = ref(false)

    const { isInitialized, initError, initialize } = useVideoTranscoderInit()

    const upload = useUploadState({
      onSaved: () => manager.loadVideos(),
    })

    const manager = useVideoManager({
      onDeleteError: (message) => {
        upload.uploadError.value = message
      },
    })

    if (initError.value) {
      upload.uploadError.value = initError.value
    }

    const openModal = async () => {
      if (!isInitialized.value) {
        await initialize()
        if (initError.value) {
          upload.uploadError.value = initError.value
        }
      }
      isModalOpen.value = true
      await manager.loadVideos()
    }

    const closeModal = () => {
      isModalOpen.value = false
      manager.closePlayer()
      if (upload.uploadState.value !== 'transcoding') {
        upload.resetUploadState()
      }
    }

    onMounted(() => {
      initialize().then(() => {
        if (initError.value) {
          upload.uploadError.value = initError.value
        }
      })
    })

    onBeforeUnmount(() => {
      upload.cancelTranscoding()

      if (manager.videoUrl.value) {
        URL.revokeObjectURL(manager.videoUrl.value)
        manager.videoUrl.value = null
      }

      transcoder.destroy()
    })

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        upload.cancelTranscoding()

        if (manager.videoUrl.value) {
          URL.revokeObjectURL(manager.videoUrl.value)
        }

        transcoder.destroy()
      })
    }

    return {
      isModalOpen,
      openModal,
      closeModal,

      videos: manager.videos,
      isLoadingVideos: manager.isLoadingVideos,
      selectedVideo: manager.selectedVideo,
      videoUrl: manager.videoUrl,
      playVideo: manager.playVideo,
      downloadVideo: manager.downloadVideo,

      infoVideo: manager.infoVideo,
      isInfoModalOpen: manager.isInfoModalOpen,
      showVideoInfo: manager.showVideoInfo,
      closeVideoInfo: manager.closeVideoInfo,

      deleteVideo: manager.deleteVideo,
      isDeleteModalOpen: manager.isDeleteModalOpen,
      confirmDelete: manager.confirmDelete,
      deleteVideoConfirm: manager.deleteVideoConfirm,
      cancelDelete: manager.cancelDelete,

      uploadState: upload.uploadState,
      uploadProgress: upload.uploadProgress,
      uploadError: upload.uploadError,
      selectedFile: upload.selectedFile,
      handleFileSelect: upload.handleFileSelect,
      startTranscodingFromReady: upload.startTranscodingFromReady,
      resetUploadState: upload.resetUploadState,
      closePlayer: manager.closePlayer,

      sourceMetadata: upload.sourceMetadata,
      targetWidth: upload.targetWidth,
      targetHeight: upload.targetHeight,
      targetResolution: upload.targetResolution,
      targetVideoBitrate: upload.targetVideoBitrate,
      targetFps: upload.targetFps,
      targetMimeType: upload.targetMimeType,
      transcoderName: upload.transcoderName,
      isWorker: upload.isWorker,

      formatFileSize,
      formatDuration,
    }
  },
})
