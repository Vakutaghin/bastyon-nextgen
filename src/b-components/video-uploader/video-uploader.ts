import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { transcodedVideoAPI } from '@/db/apis/transcoded-video-api'
import { transcoder } from './transcoder'
import { storageManager } from './utils'
import type { TranscodedVideo } from '@/db'
import type { TranscodeProgress, VideoMetadata } from './transcoder/types'
import {
  selectTargetResolution,
  calculateTargetDimensions,
  getResolutionString,
} from './transcoder/resolution-selector'
import { getBitrateForResolution, TARGET_FPS, MAX_FPS } from './utils/constants'
import { getBestMimeType, isTauri } from './utils/environment'
import { calculateVideoBitrate } from './components/video-info-panel/video-info-panel'

/**
 * Состояние загрузки и транскодирования
 */
type UploadState = 'idle' | 'analyzing' | 'ready' | 'transcoding' | 'saving' | 'completed' | 'error'

export const videoUploaderOptions = defineComponent({
  name: 'VideoUploader',
  setup() {
    // Состояние модалки
    const isModalOpen = ref(false)
    const isInitialized = ref(false)

    // Список видео
    const videos = ref<TranscodedVideo[]>([])
    const isLoadingVideos = ref(false)

    // Выбранное видео для воспроизведения
    const selectedVideo = ref<TranscodedVideo | null>(null)
    const videoUrl = ref<string | null>(null)

    // Информация о видео
    const infoVideo = ref<TranscodedVideo | null>(null)
    const isInfoModalOpen = ref(false)

    // Подтверждение удаления
    const deleteVideo = ref<TranscodedVideo | null>(null)
    const isDeleteModalOpen = ref(false)

    // Загрузка и транскодирование
    const uploadState = ref<UploadState>('idle')
    const uploadProgress = ref(0)
    const uploadError = ref<string | null>(null)
    const selectedFile = ref<File | null>(null)
    let isTranscoding = false // Флаг для предотвращения одновременного транскодирования
    let currentTranscodeAbortController: AbortController | null = null // Контроллер для отмены транскодирования

    // Информация о файле для отображения
    const sourceMetadata = ref<VideoMetadata | null>(null)
    const targetWidth = ref(0)
    const targetHeight = ref(0)
    const targetResolution = ref('')
    const targetVideoBitrate = ref(0)
    const targetFps = ref(0)
    const targetMimeType = ref('')
    const transcoderName = ref('')
    const isWorker = ref(false)

    // Инициализация компонента (один раз)
    const initialize = async () => {
      if (isInitialized.value) return

      try {
        // Проверяем поддержку транскодирования (только в Tauri)
        if (transcoder.isSupported()) {
          // В Tauri дополнительно проверяем, установлен ли системный ffmpeg/ffprobe.
          // Без этого пользователь увидел бы невнятное "Failed to execute ffprobe" только
          // после выбора файла и начала анализа.
          const ffmpegStatus = await transcoder.checkFfmpegAvailable()
          if (!ffmpegStatus.ffmpeg || !ffmpegStatus.ffprobe) {
            uploadError.value = getFfmpegMissingInstruction()
          }
        }

        isInitialized.value = true
      } catch (error) {
        console.error('Failed to initialize video uploader:', error)
      }
    }

    /** Инструкция по установке ffmpeg, специфичная для платформы пользователя. */
    const getFfmpegMissingInstruction = (): string => {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      if (/mac|darwin/i.test(ua)) {
        return 'Для транскодирования видео требуется FFmpeg. Установите его: brew install ffmpeg'
      }
      if (/win/i.test(ua)) {
        return 'Для транскодирования видео требуется FFmpeg. Установите его: winget install ffmpeg (или скачайте с ffmpeg.org)'
      }
      if (/linux/i.test(ua)) {
        return 'Для транскодирования видео требуется FFmpeg. Установите его: sudo apt install ffmpeg (или через ваш пакетный менеджер)'
      }
      return 'Для транскодирования видео требуется FFmpeg. Установите его системно (ffmpeg + ffprobe должны быть в PATH).'
    }

    // Загрузка списка видео
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

    // Открытие модалки
    const openModal = async () => {
      if (!isInitialized.value) {
        await initialize()
      }
      isModalOpen.value = true
      await loadVideos()
    }

    // Закрытие модалки
    const closeModal = () => {
      isModalOpen.value = false
      // Очищаем выбранное видео
      closePlayer()
      // Сбрасываем состояние загрузки
      if (uploadState.value !== 'transcoding') {
        resetUploadState()
      }
    }

    // Закрытие видеоплеера
    const closePlayer = () => {
      if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value)
        videoUrl.value = null
      }
      selectedVideo.value = null
    }

    // Воспроизведение видео
    const playVideo = async (video: TranscodedVideo) => {
      // Освобождаем предыдущий URL
      if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value)
      }

      const url = await transcodedVideoAPI.getVideoUrl(video.id)
      if (url) {
        videoUrl.value = url
        selectedVideo.value = video
      }
    }

    // Скачивание видео
    const downloadVideo = async (video: TranscodedVideo) => {
      try {
        // Получаем Blob из IndexedDB
        const blob = await transcodedVideoAPI.getVideoBlob(video.id)
        if (!blob) {
          console.error('Video blob not found')
          return
        }

        // Определяем расширение файла на основе MIME-типа
        let extension = 'mp4'
        if (video.mimeType.includes('webm')) {
          extension = 'webm'
        } else if (video.mimeType.includes('mp4')) {
          extension = 'mp4'
        }

        // Используем оригинальное имя файла или генерируем новое
        const fileName = video.originalFileName
          ? video.originalFileName.replace(/\.[^/.]+$/, '') + `_${video.resolution}.${extension}`
          : `video_${video.id}_${video.resolution}.${extension}`

        // В Tauri используем API для сохранения файла
        if (isTauri()) {
          const { save } = await import('@tauri-apps/plugin-dialog')
          const { writeFile } = await import('@tauri-apps/plugin-fs')

          // Показываем диалог сохранения файла
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
            // Конвертируем Blob в Uint8Array
            const arrayBuffer = await blob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            // Сохраняем файл используя writeFile с бинарными данными
            await writeFile(filePath, uint8Array)
          }
        } else {
          // В браузере используем стандартный метод
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = fileName
          link.style.display = 'none'

          // Добавляем в DOM, кликаем и удаляем
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Освобождаем URL
          setTimeout(() => {
            URL.revokeObjectURL(url)
          }, 100)
        }
      } catch (error) {
        console.error('Error downloading video:', error)
      }
    }

    // Показ информации о видео
    const showVideoInfo = (video: TranscodedVideo) => {
      infoVideo.value = video
      isInfoModalOpen.value = true
    }

    // Закрытие информации
    const closeVideoInfo = () => {
      isInfoModalOpen.value = false
      infoVideo.value = null
    }

    // Подтверждение удаления
    const confirmDelete = (video: TranscodedVideo) => {
      deleteVideo.value = video
      isDeleteModalOpen.value = true
    }

    // Удаление видео
    const deleteVideoConfirm = async () => {
      if (!deleteVideo.value) return

      const videoIdToDelete = deleteVideo.value.id

      try {
        // Освобождаем URL, если это видео воспроизводилось
        if (selectedVideo.value?.id === videoIdToDelete && videoUrl.value) {
          URL.revokeObjectURL(videoUrl.value)
          videoUrl.value = null
          selectedVideo.value = null
        }

        // Удаляем из базы данных
        await transcodedVideoAPI.delete(videoIdToDelete)

        // Проверяем, что запись действительно удалена
        const deletedVideo = await transcodedVideoAPI.get(videoIdToDelete)
        if (deletedVideo) {
          console.error('Видео не было удалено из базы данных')
          throw new Error('Не удалось удалить видео из базы данных')
        }

        // Обновляем список видео
        await loadVideos()

        isDeleteModalOpen.value = false
        deleteVideo.value = null
      } catch (error) {
        console.error('Ошибка при удалении видео:', error)
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
        uploadError.value = `Не удалось удалить видео: ${errorMessage}`
        // Не закрываем модалку при ошибке, чтобы пользователь мог попробовать снова
      }
    }

    // Отмена удаления
    const cancelDelete = () => {
      isDeleteModalOpen.value = false
      deleteVideo.value = null
    }

    // Обработка выбора файла
    const handleFileSelect = async (file: File) => {
      if (!file.type.startsWith('video/')) {
        uploadError.value = 'Пожалуйста, выберите видеофайл'
        uploadState.value = 'error'
        return
      }

      // Проверяем размер файла (максимум 500 MB для безопасности)
      const maxSize = 500 * 1024 * 1024 // 500 MB
      if (file.size > maxSize) {
        uploadError.value = `Файл слишком большой (${formatFileSize(file.size)}). Максимальный размер: ${formatFileSize(maxSize)}`
        uploadState.value = 'error'
        return
      }

      selectedFile.value = file

      // Получаем метаданные и вычисляем целевые параметры
      try {
        uploadState.value = 'analyzing'
        uploadError.value = null

        // Получаем метаданные исходного файла
        const metadata = await transcoder.getMetadata(file)
        sourceMetadata.value = metadata

        // Вычисляем целевые параметры
        const targetRes = selectTargetResolution(metadata.width, metadata.height)
        const { width, height } = calculateTargetDimensions(
          metadata.width,
          metadata.height,
          targetRes
        )

        targetWidth.value = width
        targetHeight.value = height
        targetResolution.value = getResolutionString(targetRes)

        // Вычисляем исходный битрейт
        const sourceBitrate = metadata.videoBitrate
          ? metadata.videoBitrate
          : calculateVideoBitrate(file.size, metadata.duration)

        // Вычисляем целевой битрейт и ограничиваем его исходным
        const calculatedTargetBitrate = getBitrateForResolution(targetRes)
        targetVideoBitrate.value = Math.min(calculatedTargetBitrate, sourceBitrate)

        targetFps.value = Math.min(TARGET_FPS, MAX_FPS)
        targetMimeType.value = getBestMimeType() || 'Неизвестно'

        // Получаем информацию о транскодере
        const transcoderInfo = transcoder.getTranscoderInfo()
        transcoderName.value = transcoderInfo.method === 'tauri' ? 'TauriTranscoder' : 'Неизвестно'
        isWorker.value = false // Tauri не использует Worker

        // Переходим в состояние готовности - пользователь может начать кодирование
        uploadState.value = 'ready'
      } catch (error) {
        uploadState.value = 'error'
        const errorMessage = error instanceof Error ? error.message : 'Ошибка анализа файла'
        uploadError.value = errorMessage
        console.error('File analysis error:', error)
      }
    }

    // Сброс состояния загрузки
    const resetUploadState = () => {
      // Не сбрасываем, если идет транскодирование
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

    // Начать транскодирование (вызывается по кнопке)
    const startTranscodingFromReady = async () => {
      if (!selectedFile.value) {
        uploadError.value = 'Файл не выбран'
        uploadState.value = 'error'
        return
      }

      // Используем уже полученные метаданные
      const metadata = sourceMetadata.value
      if (!metadata) {
        uploadError.value = 'Метаданные файла не найдены'
        uploadState.value = 'error'
        return
      }

      await startTranscoding(selectedFile.value, metadata)
    }

    // Отмена транскодирования
    const cancelTranscoding = () => {
      if (isTranscoding) {
        // Отменяем через AbortController, если есть
        if (currentTranscodeAbortController) {
          currentTranscodeAbortController.abort()
          currentTranscodeAbortController = null
        }

        // Уничтожаем транскодер (остановит воркер и освободит ресурсы)
        transcoder.destroy()

        // Сбрасываем состояние
        isTranscoding = false
        uploadState.value = 'idle'
        uploadProgress.value = 0
        uploadError.value = 'Транскодирование отменено'
        selectedFile.value = null
        resetUploadState()
      }
    }

    // Транскодирование видео
    const startTranscoding = async (file: File, metadata?: VideoMetadata) => {
      // Предотвращаем одновременное транскодирование
      if (isTranscoding) {
        uploadError.value = 'Транскодирование уже выполняется'
        uploadState.value = 'error'
        return
      }

      isTranscoding = true
      currentTranscodeAbortController = new AbortController()

      try {
        // Если метаданные не переданы, получаем их
        const fileMetadata = metadata || (await transcoder.getMetadata(file))

        // Проверяем возможность сохранения
        const estimatedSizeMB = (file.size * 0.7) / (1024 * 1024) // Примерная оценка
        const canSave = await storageManager.canSave(estimatedSizeMB)

        if (!canSave.canSave) {
          // Пытаемся очистить хранилище
          await storageManager.autoCleanup()
          const canSaveAfterCleanup = await storageManager.canSave(estimatedSizeMB)
          if (!canSaveAfterCleanup.canSave) {
            throw new Error(canSaveAfterCleanup.reason || 'Storage limit reached')
          }
        }

        // Начинаем транскодирование
        uploadState.value = 'transcoding'

        // Вычисляем исходный битрейт для ограничения целевого
        const sourceBitrate = fileMetadata.videoBitrate
          ? fileMetadata.videoBitrate
          : calculateVideoBitrate(file.size, fileMetadata.duration)

        // Передаем опции с ограниченным битрейтом
        const transcodeOptions = {
          videoBitrate: Math.min(targetVideoBitrate.value, sourceBitrate),
        }

        const result = await transcoder.transcode(
          file,
          transcodeOptions,
          (progress: TranscodeProgress) => {
            // Проверяем, не была ли отмена
            if (currentTranscodeAbortController?.signal.aborted) {
              return
            }
            uploadProgress.value = progress.progress
          }
        )

        // Проверяем отмену после транскодирования
        if (currentTranscodeAbortController?.signal.aborted) {
          throw new Error('Транскодирование отменено')
        }

        // Сохраняем результат
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

        // Обновляем список видео
        await loadVideos()

        // Автоматически сбрасываем состояние через 3 секунды
        setTimeout(() => {
          if (uploadState.value === 'completed') {
            resetUploadState()
          }
        }, 3000)
      } catch (error) {
        uploadState.value = 'error'
        const errorMessage = error instanceof Error ? error.message : 'Ошибка транскодирования'
        let displayMessage: string
        if (errorMessage.includes('Storage limit')) {
          displayMessage = 'Превышен лимит хранилища. Удалите старые видео.'
        } else if (errorMessage.includes('not supported')) {
          displayMessage = 'Транскодирование не поддерживается в вашем браузере'
        } else {
          displayMessage = errorMessage.startsWith('Ошибка')
            ? errorMessage
            : 'Ошибка транскодирования: ' + errorMessage
          const lower = errorMessage.toLowerCase()
          if (
            (lower.includes('ffmpeg') &&
              (lower.includes('no such file') ||
                lower.includes('not found') ||
                lower.includes('command not found'))) ||
            lower.includes('failed to execute ffmpeg')
          ) {
            displayMessage +=
              ' Установите FFmpeg: macOS — brew install ffmpeg; Linux — apt install ffmpeg / dnf install ffmpeg.'
          }
        }
        uploadError.value = displayMessage
        console.error('Transcoding error:', error)
      } finally {
        isTranscoding = false
      }
    }

    // Форматирование размера файла
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
    }

    // Форматирование длительности
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }

    // Инициализация при монтировании
    onMounted(() => {
      initialize()
    })

    // Очистка при размонтировании
    onBeforeUnmount(() => {
      // Отменяем транскодирование, если оно идет
      cancelTranscoding()

      // Освобождаем URL видео
      if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value)
        videoUrl.value = null
      }

      // Уничтожаем транскодер (освободит воркеры и ресурсы)
      transcoder.destroy()
    })

    // Обработка закрытия вкладки/перезагрузки страницы
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // Отменяем транскодирование
        if (isTranscoding) {
          cancelTranscoding()
        }

        // Освобождаем URL
        if (videoUrl.value) {
          URL.revokeObjectURL(videoUrl.value)
        }

        // Уничтожаем транскодер
        transcoder.destroy()
      })
    }

    return {
      // Модалка
      isModalOpen,
      openModal,
      closeModal,

      // Видео
      videos,
      isLoadingVideos,
      selectedVideo,
      videoUrl,
      playVideo,
      downloadVideo,

      // Информация
      infoVideo,
      isInfoModalOpen,
      showVideoInfo,
      closeVideoInfo,

      // Удаление
      deleteVideo,
      isDeleteModalOpen,
      confirmDelete,
      deleteVideoConfirm,
      cancelDelete,

      // Загрузка
      uploadState,
      uploadProgress,
      uploadError,
      selectedFile,
      handleFileSelect,
      startTranscodingFromReady,
      resetUploadState,
      closePlayer,

      // Информация о файле
      sourceMetadata,
      targetWidth,
      targetHeight,
      targetResolution,
      targetVideoBitrate,
      targetFps,
      targetMimeType,
      transcoderName,
      isWorker,

      // Утилиты
      formatFileSize,
      formatDuration,
    }
  },
})
