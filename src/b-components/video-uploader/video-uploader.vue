<template>
  <!-- Кнопка в body через Teleport — в Tauri иначе может перехватываться клик -->
  <Teleport to="body">
    <FabButton @click="openModal" />
  </Teleport>

  <!-- Главная модалка: кастомный overlay с Teleport в body — гарантированно виден в Tauri webview -->
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
            <VideoPlayerModal
              :video="selectedVideo"
              :videoUrl="videoUrl"
              @close="closePlayer"
            />
            <UploadDropzone
              :state="uploadState"
              :progress="uploadProgress"
              :error="uploadError"
              :fileName="selectedFile?.name || null"
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
              @fileSelect="handleFileSelect"
              @start="startTranscodingFromReady"
              @reset="resetUploadState"
            />
          </SC_ModalContent>
        </SC_ModalBody>
      </SC_ModalBox>
    </SC_ModalOverlay>
  </Teleport>

  <!-- Модалка информации о видео -->
  <VideoInfoModal
    :open="isInfoModalOpen"
    :video="infoVideo"
    @close="closeVideoInfo"
  />

  <!-- Модалка подтверждения удаления -->
  <DeleteConfirmModal
    :open="isDeleteModalOpen"
    :video="deleteVideo"
    @confirm="deleteVideoConfirm"
    @cancel="cancelDelete"
  />
</template>

<script>
import { videoUploaderOptions } from './video-uploader.ts'
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
  SC_ModalContent
} from './styled'

export default {
  name: 'VideoUploader',
  components: {
    FabButton,
    VideoList,
    VideoPlayerModal,
    VideoInfoModal,
    UploadDropzone,
    DeleteConfirmModal,
    SC_ModalOverlay,
    SC_ModalBox,
    SC_ModalHeader,
    SC_ModalTitle,
    SC_ModalClose,
    SC_ModalBody,
    SC_ModalContent
  },
  setup() {
    return videoUploaderOptions.setup()
  }
}
</script>
