import { ref } from 'vue'
import { transcodedVideoAPI } from '@/db/apis/transcoded-video-api'
import type { TranscodedVideo } from '@/db'
import { isTauri } from '../utils/environment'

export interface UseVideoManagerOptions {
  onDeleteError?: (message: string) => void
}

export function useVideoManager(options: UseVideoManagerOptions = {}) {
  const videos = ref<TranscodedVideo[]>([])
  const isLoadingVideos = ref(false)

  const selectedVideo = ref<TranscodedVideo | null>(null)
  const videoUrl = ref<string | null>(null)

  const infoVideo = ref<TranscodedVideo | null>(null)
  const isInfoModalOpen = ref(false)

  const deleteVideo = ref<TranscodedVideo | null>(null)
  const isDeleteModalOpen = ref(false)

  const loadVideos = async () => {
    isLoadingVideos.value = true
    try {
      videos.value = await transcodedVideoAPI.getRecent()
    } catch (error) {
      console.error('Failed to load videos:', error)
    } finally {
      isLoadingVideos.value = false
    }
  }

  const closePlayer = () => {
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value)
      videoUrl.value = null
    }
    selectedVideo.value = null
  }

  const playVideo = async (video: TranscodedVideo) => {
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value)
    }

    const url = await transcodedVideoAPI.getVideoUrl(video.id)
    if (url) {
      videoUrl.value = url
      selectedVideo.value = video
    }
  }

  const downloadVideo = async (video: TranscodedVideo) => {
    try {
      const blob = await transcodedVideoAPI.getVideoBlob(video.id)
      if (!blob) {
        console.error('Video blob not found')
        return
      }

      let extension = 'mp4'
      if (video.mimeType.includes('webm')) {
        extension = 'webm'
      } else if (video.mimeType.includes('mp4')) {
        extension = 'mp4'
      }

      const fileName = video.originalFileName
        ? video.originalFileName.replace(/\.[^/.]+$/, '') + `_${video.resolution}.${extension}`
        : `video_${video.id}_${video.resolution}.${extension}`

      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { writeFile } = await import('@tauri-apps/plugin-fs')

        const filePath = await save({
          defaultPath: fileName,
          filters: [
            {
              name: 'Video',
              extensions: [extension],
            },
          ],
        })

        if (filePath) {
          const arrayBuffer = await blob.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          await writeFile(filePath, uint8Array)
        }
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.style.display = 'none'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 100)
      }
    } catch (error) {
      console.error('Error downloading video:', error)
    }
  }

  const showVideoInfo = (video: TranscodedVideo) => {
    infoVideo.value = video
    isInfoModalOpen.value = true
  }

  const closeVideoInfo = () => {
    isInfoModalOpen.value = false
    infoVideo.value = null
  }

  const confirmDelete = (video: TranscodedVideo) => {
    deleteVideo.value = video
    isDeleteModalOpen.value = true
  }

  const deleteVideoConfirm = async () => {
    if (!deleteVideo.value) return

    const videoIdToDelete = deleteVideo.value.id

    try {
      if (selectedVideo.value?.id === videoIdToDelete && videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value)
        videoUrl.value = null
        selectedVideo.value = null
      }

      await transcodedVideoAPI.delete(videoIdToDelete)

      const deletedVideo = await transcodedVideoAPI.get(videoIdToDelete)
      if (deletedVideo) {
        console.error('Видео не было удалено из базы данных')
        throw new Error('Не удалось удалить видео из базы данных')
      }

      await loadVideos()

      isDeleteModalOpen.value = false
      deleteVideo.value = null
    } catch (error) {
      console.error('Ошибка при удалении видео:', error)
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      options.onDeleteError?.(`Не удалось удалить видео: ${errorMessage}`)
    }
  }

  const cancelDelete = () => {
    isDeleteModalOpen.value = false
    deleteVideo.value = null
  }

  return {
    videos,
    isLoadingVideos,
    loadVideos,

    selectedVideo,
    videoUrl,
    playVideo,
    closePlayer,
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
  }
}
