/**
 * Локальный Pinia store для управления видеоплеером
 * Используется только компонентом video-player
 */

import { defineStore } from 'pinia'

interface VideoPlayerInstance {
  pause: () => void
  isPlaying: () => boolean
}

export const useVideoPlayerStore = defineStore('videoPlayer', {
  state: () => ({
    instances: new Map<string, VideoPlayerInstance>(),
    currentPlayingId: null as string | null
  }),

  actions: {
    /**
     * Регистрирует новый инстанс видеоплеера
     * @param id Уникальный идентификатор инстанса
     * @param instance Объект с методами pause и isPlaying
     * @returns Функция для отмены регистрации
     */
    register(id: string, instance: VideoPlayerInstance): () => void {
      this.instances.set(id, instance)

      // Возвращаем функцию для отмены регистрации
      return () => {
        this.instances.delete(id)
        if (this.currentPlayingId === id) {
          this.currentPlayingId = null
        }
      }
    },

    /**
     * Останавливает все видеоплееры, кроме указанного
     * @param playingId ID плеера, который должен продолжать воспроизведение
     */
    pauseAllExcept(playingId: string): void {
      // Если тот же плеер уже играет, ничего не делаем
      if (this.currentPlayingId === playingId) {
        return
      }

      // Останавливаем все остальные плееры
      this.instances.forEach((instance, id) => {
        if (id !== playingId && instance.isPlaying()) {
          try {
            instance.pause()
          } catch (error) {
            console.warn(`Failed to pause video player ${id}:`, error)
          }
        }
      })

      // Обновляем текущий играющий плеер
      this.currentPlayingId = playingId
    },

    /**
     * Останавливает все видеоплееры
     */
    pauseAll(): void {
      this.instances.forEach((instance, id) => {
        if (instance.isPlaying()) {
          try {
            instance.pause()
          } catch (error) {
            console.warn(`Failed to pause video player ${id}:`, error)
          }
        }
      })
      this.currentPlayingId = null
    },

    /**
     * Уведомляет менеджер о том, что плеер остановился
     * @param id ID остановленного плеера
     */
    onPaused(id: string): void {
      if (this.currentPlayingId === id) {
        this.currentPlayingId = null
      }
    }
  }
})
