<template>
  <!-- Кнопка в body через Teleport — в Tauri иначе может перехватываться клик. -->
  <Teleport to="body">
    <FabButton @click="openModal" />
  </Teleport>

  <!-- Главная модалка: кастомный overlay с Teleport в body — гарантированно
       виден в Tauri webview. -->
  <Teleport to="body">
    <SC_ModalOverlay
      v-if="isModalOpen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-uploader-title"
      @click.self="closeModal"
    >
      <SC_ModalBox @click.stop>
        <SC_ModalHeader>
          <SC_ModalTitle id="video-uploader-title">Загрузчик видео</SC_ModalTitle>
          <SC_ModalClose type="button" aria-label="Закрыть" @click="closeModal">×</SC_ModalClose>
        </SC_ModalHeader>
        <SC_ModalBody>
          <SC_ModalContent>
            <VideoList
              :videos="videos"
              :loading="isLoadingVideos"
              @play="playVideo"
              @info="showVideoInfo"
              @delete="confirmDelete"
              @download="downloadVideo"
            />
            <VideoPlayerModal :video="selectedVideo" :video-url="videoUrl" @close="closePlayer" />
            <UploadDropzone
              :state="uploadState"
              :progress="uploadProgress"
              :error="uploadError"
              :file-name="selectedFile?.name || null"
              :file-size="selectedFile?.size || 0"
              :source-metadata="sourceMetadata"
              :target-width="targetWidth"
              :target-height="targetHeight"
              :target-resolution="targetResolution"
              :target-video-bitrate="targetVideoBitrate"
              :target-fps="targetFps"
              :target-mime-type="targetMimeType"
              :transcoder-name="transcoderName"
              :is-worker="isWorker"
              @file-select="handleFileSelect"
              @start="startTranscodingFromReady"
              @reset="resetUploadState"
            />
          </SC_ModalContent>
        </SC_ModalBody>
      </SC_ModalBox>
    </SC_ModalOverlay>
  </Teleport>

  <!-- Модалка информации о видео. -->
  <VideoInfoModal :open="isInfoModalOpen" :video="infoVideo" @close="closeVideoInfo" />

  <!-- Модалка подтверждения удаления. -->
  <DeleteConfirmModal
    :open="isDeleteModalOpen"
    :video="deleteVideo"
    @confirm="deleteVideoConfirm"
    @cancel="cancelDelete"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { transcoder } from './transcoder'
import { useVideoTranscoderInit } from './composables/use-video-transcoder-init'
import { useVideoManager } from './composables/use-video-manager'
import { useUploadState } from './composables/use-upload-state'
import FabButton from './components/fab-button/fab-button.vue'
import VideoList from './components/video-list/video-list.vue'
import VideoPlayerModal from './components/video-player-modal/video-player-modal.vue'
import VideoInfoModal from './components/video-info-modal/video-info-modal.vue'
import UploadDropzone from './components/upload-dropzone/upload-dropzone.vue'
import DeleteConfirmModal from './components/delete-confirm-modal/delete-confirm-modal.vue'
import {
  SC_ModalOverlay,
  SC_ModalBox,
  SC_ModalHeader,
  SC_ModalTitle,
  SC_ModalClose,
  SC_ModalBody,
  SC_ModalContent,
} from './styled'

const isModalOpen = ref(false)

const { isInitialized, initError, initialize } = useVideoTranscoderInit()

// Порядок: сначала manager, потом upload — onSaved/onDeleteError ссылаются
// друг на друга через замыкания, поэтому одна из ссылок будет резолвлена
// позже (через временный ref в onDeleteError).
const manager = useVideoManager({
  onDeleteError: (message) => {
    upload.uploadError.value = message
  },
})

const upload = useUploadState({
  onSaved: () => manager.loadVideos(),
})

const {
  videos,
  isLoadingVideos,
  selectedVideo,
  videoUrl,
  playVideo,
  downloadVideo,
  infoVideo,
  isInfoModalOpen,
  showVideoInfo,
  closeVideoInfo,
  deleteVideo,
  isDeleteModalOpen,
  confirmDelete,
  deleteVideoConfirm,
  cancelDelete,
  closePlayer,
} = manager

const {
  uploadState,
  uploadProgress,
  uploadError,
  selectedFile,
  handleFileSelect,
  startTranscodingFromReady,
  resetUploadState,
  cancelTranscoding,
  sourceMetadata,
  targetWidth,
  targetHeight,
  targetResolution,
  targetVideoBitrate,
  targetFps,
  targetMimeType,
  transcoderName,
  isWorker,
} = upload

if (initError.value) {
  uploadError.value = initError.value
}

async function openModal(): Promise<void> {
  if (!isInitialized.value) {
    await initialize()
    if (initError.value) uploadError.value = initError.value
  }
  isModalOpen.value = true
  await manager.loadVideos()
}

function closeModal(): void {
  isModalOpen.value = false
  closePlayer()
  if (uploadState.value !== 'transcoding') {
    resetUploadState()
  }
}

onMounted(() => {
  initialize().then(() => {
    if (initError.value) uploadError.value = initError.value
  })
})

onBeforeUnmount(() => {
  cancelTranscoding()
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value)
    videoUrl.value = null
  }
  transcoder.destroy()
})

if (typeof window !== 'undefined') {
  // beforeunload — на случай перезагрузки страницы с активным транскодингом,
  // чтобы не оставлять висящий worker / blob-URL.
  window.addEventListener('beforeunload', () => {
    cancelTranscoding()
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    transcoder.destroy()
  })
}
</script>
