/**
 * Глобальный менеджер видеоплееров
 * Обеспечивает, что только один видеоплеер воспроизводится одновременно
 */

import type { VideoPlayerInstance } from './types'

class VideoPlayerManager {
  private instances: Map<string, VideoPlayerInstance> = new Map()
  private currentPlayingId: string | null = null
  private lastActivePlayerId: string | null = null // Последний активный плеер (даже если на паузе)
  private hasUserInteracted: boolean = false // Был ли запущен хотя бы один плеер

  /**
   * Регистрирует новый инстанс видеоплеера
   * @param id Уникальный идентификатор инстанса
   * @param instance Объект с методами pause и isPlaying
   * @returns Функция для отмены регистрации
   */
  register(id: string, instance: VideoPlayerInstance): () => void {
    this.instances.set(id, instance)

    // Если это первый плеер, делаем его последним активным
    if (this.instances.size === 1) {
      this.lastActivePlayerId = id
    }

    // Возвращаем функцию для отмены регистрации
    return () => {
      this.instances.delete(id)
      if (this.currentPlayingId === id) {
        this.currentPlayingId = null
      }
      if (this.lastActivePlayerId === id) {
        // Если удаляется последний активный плеер, ищем другой активный или первый доступный
        const playingPlayer = Array.from(this.instances.entries()).find(([_, instance]) =>
          instance.isPlaying()
        )
        if (playingPlayer) {
          this.lastActivePlayerId = playingPlayer[0]
        } else if (this.instances.size > 0) {
          // Берем первый доступный плеер
          this.lastActivePlayerId = Array.from(this.instances.keys())[0] ?? null
        } else {
          this.lastActivePlayerId = null
        }
      }
    }
  }

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

    // Обновляем текущий играющий плеер и последний активный
    this.currentPlayingId = playingId
    this.lastActivePlayerId = playingId
    this.hasUserInteracted = true
  }

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
  }

  /**
   * Уведомляет менеджер о том, что плеер остановился
   * @param id ID остановленного плеера
   */
  onPaused(id: string): void {
    if (this.currentPlayingId === id) {
      this.currentPlayingId = null
    }
    // Сохраняем последний активный плеер даже после паузы
    if (this.lastActivePlayerId === id) {
      // Оставляем lastActivePlayerId, чтобы можно было возобновить воспроизведение
    }
  }

  /**
   * Получает текущий активный (воспроизводящийся) видеоплеер
   * @returns Экземпляр активного плеера или null
   */
  getCurrentPlaying(): VideoPlayerInstance | null {
    if (!this.currentPlayingId) {
      return null
    }
    return this.instances.get(this.currentPlayingId) || null
  }

  /**
   * Получает последний активный видеоплеер (даже если на паузе)
   * @returns Экземпляр последнего активного плеера или null
   */
  getLastActivePlayer(): VideoPlayerInstance | null {
    if (!this.lastActivePlayerId) {
      return null
    }
    return this.instances.get(this.lastActivePlayerId) || null
  }

  /**
   * Проверяет, был ли запущен хотя бы один плеер
   */
  getHasUserInteracted(): boolean {
    return this.hasUserInteracted
  }

  /**
   * Проверяет, есть ли хотя бы один зарегистрированный видеоплеер
   * @returns true, если есть хотя бы один плеер
   */
  hasAnyPlayer(): boolean {
    return this.instances.size > 0
  }

  /**
   * Переключает воспроизведение текущего активного или последнего активного видеоплеера
   * @returns true, если переключение выполнено, false если нет плееров
   */
  toggleCurrentPlaying(): boolean {
    // Сначала пытаемся переключить текущий играющий плеер
    const current = this.getCurrentPlaying()
    if (current && current.togglePlay) {
      try {
        current.togglePlay()
        // Обновляем lastActivePlayerId, чтобы этот плеер оставался последним активным
        this.lastActivePlayerId = current.id
        return true
      } catch (error) {
        console.warn(`Failed to toggle video player ${current.id}:`, error)
      }
    }

    // Если нет играющего плеера, пытаемся переключить последний активный
    const lastActive = this.getLastActivePlayer()
    if (lastActive && lastActive.togglePlay) {
      try {
        lastActive.togglePlay()
        // Обновляем lastActivePlayerId при переключении
        this.lastActivePlayerId = lastActive.id
        return true
      } catch (error) {
        console.warn(`Failed to toggle video player ${lastActive.id}:`, error)
      }
    }

    return false
  }

  /**
   * Переключает mute/unmute текущего активного или последнего активного видеоплеера
   * @returns true, если переключение выполнено, false если нет плееров
   */
  toggleMute(): boolean {
    // Сначала пытаемся переключить mute текущего играющего плеера
    const current = this.getCurrentPlaying()
    if (current && current.toggleMute) {
      try {
        current.toggleMute()
        return true
      } catch (error) {
        console.warn(`Failed to toggle mute video player ${current.id}:`, error)
      }
    }

    // Если нет играющего плеера, пытаемся переключить mute последнего активного
    const lastActive = this.getLastActivePlayer()
    if (lastActive && lastActive.toggleMute) {
      try {
        lastActive.toggleMute()
        return true
      } catch (error) {
        console.warn(`Failed to toggle mute video player ${lastActive.id}:`, error)
      }
    }

    return false
  }

  /**
   * Увеличивает скорость воспроизведения текущего активного или последнего активного видеоплеера
   * @returns true, если изменение выполнено, false если нет плееров
   */
  increasePlaybackRate(): boolean {
    // Сначала пытаемся изменить скорость текущего играющего плеера
    const current = this.getCurrentPlaying()
    if (current && current.increasePlaybackRate) {
      try {
        current.increasePlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to increase playback rate video player ${current.id}:`, error)
      }
    }

    // Если нет играющего плеера, пытаемся изменить скорость последнего активного
    const lastActive = this.getLastActivePlayer()
    if (lastActive && lastActive.increasePlaybackRate) {
      try {
        lastActive.increasePlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to increase playback rate video player ${lastActive.id}:`, error)
      }
    }

    return false
  }

  /**
   * Уменьшает скорость воспроизведения текущего активного или последнего активного видеоплеера
   * @returns true, если изменение выполнено, false если нет плееров
   */
  decreasePlaybackRate(): boolean {
    // Сначала пытаемся изменить скорость текущего играющего плеера
    const current = this.getCurrentPlaying()
    if (current && current.decreasePlaybackRate) {
      try {
        current.decreasePlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to decrease playback rate video player ${current.id}:`, error)
      }
    }

    // Если нет играющего плеера, пытаемся изменить скорость последнего активного
    const lastActive = this.getLastActivePlayer()
    if (lastActive && lastActive.decreasePlaybackRate) {
      try {
        lastActive.decreasePlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to decrease playback rate video player ${lastActive.id}:`, error)
      }
    }

    return false
  }

  /**
   * Сбрасывает скорость воспроизведения до стандартной (1.0x) текущего активного или последнего активного видеоплеера
   * @returns true, если сброс выполнен, false если нет плееров
   */
  resetPlaybackRate(): boolean {
    // Сначала пытаемся сбросить скорость текущего играющего плеера
    const current = this.getCurrentPlaying()
    if (current && current.resetPlaybackRate) {
      try {
        current.resetPlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to reset playback rate video player ${current.id}:`, error)
      }
    }

    // Если нет играющего плеера, пытаемся сбросить скорость последнего активного
    const lastActive = this.getLastActivePlayer()
    if (lastActive && lastActive.resetPlaybackRate) {
      try {
        lastActive.resetPlaybackRate()
        return true
      } catch (error) {
        console.warn(`Failed to reset playback rate video player ${lastActive.id}:`, error)
      }
    }

    return false
  }

  /**
   * Переключает отображение справки по горячим клавишам
   * @returns true, если переключение выполнено
   */
  toggleHotkeysHelp(): boolean {
    const player = this.getLastActivePlayer()
    if (player && player.toggleHotkeysHelp) {
      player.toggleHotkeysHelp()
      return true
    }
    return false
  }
}

// Экспортируем singleton экземпляр
export const videoPlayerManager = new VideoPlayerManager()
