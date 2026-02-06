<template>
  <!-- Fixed кнопка для открытия модалки -->
  <FabButton @click="openModal" />

  <!-- Главная модалка -->
  <Modal
    :open="isModalOpen"
    title="Загрузчик видео"
    :width="'95vw'"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :destroyOnClose="false"
    :footer="null"
    @cancel="closeModal"
  >
    <SC_ModalContent>
      <!-- Верхняя зона: Список видео -->
      <VideoList
        :videos="videos"
        :loading="isLoadingVideos"
        @play="playVideo"
        @info="showVideoInfo"
        @delete="confirmDelete"
        @download="downloadVideo"
      />

      <!-- Видеоплеер (если выбрано видео) -->
      <VideoPlayerModal
        :video="selectedVideo"
        :videoUrl="videoUrl"
        @close="closePlayer"
      />

      <!-- Нижняя зона: Область загрузки -->
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
  </Modal>

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
import { Modal } from 'ant-design-vue'
import FabButton from './components/fab-button/fab-button.vue'
import VideoList from './components/video-list/video-list.vue'
import VideoPlayerModal from './components/video-player-modal/video-player-modal.vue'
import VideoInfoModal from './components/video-info-modal/video-info-modal.vue'
import UploadDropzone from './components/upload-dropzone/upload-dropzone.vue'
import DeleteConfirmModal from './components/delete-confirm-modal/delete-confirm-modal.vue'
import { SC_ModalContent } from './styled'

export default {
  name: 'VideoUploader',
  components: {
    Modal,
    FabButton,
    VideoList,
    VideoPlayerModal,
    VideoInfoModal,
    UploadDropzone,
    DeleteConfirmModal,
    SC_ModalContent
  },
  setup() {
    return videoUploaderOptions.setup()
  }
}
</script>
