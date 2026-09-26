/**
 * Глобальный менеджер видеоплееров
 * Обеспечивает, что только один видеоплеер воспроизводится одновременно,
 * и раздаёт горячие клавиши: слушатель один на все плееры, клавиша достаётся
 * ровно одному (правила — в video-hotkeys.ts).
 */

import type { VideoPlayerInstance } from './types'
import {
  HeldHotkeys,
  hotkeyAction,
  hotkeyCode,
  isHotkeyBlockedBy,
  isOnScreen,
} from './video-hotkeys'

export class VideoPlayerManager {
  private instances: Map<string, VideoPlayerInstance> = new Map()
  private currentPlayingId: string | null = null
  private lastActivePlayerId: string | null = null // Последний активный плеер (даже если на паузе)
  private hasUserInteracted: boolean = false // Был ли запущен хотя бы один плеер
  private readonly held = new HeldHotkeys()

  /**
   * Регистрирует новый инстанс видеоплеера
   * @param id Уникальный идентификатор инстанса
   * @param instance Плеер: пауза, состояние и обработка горячих клавиш
   * @returns Функция для отмены регистрации
   */
  register(id: string, instance: VideoPlayerInstance): () => void {
    this.instances.set(id, instance)

    // Если это первый плеер, делаем его последним активным
    if (this.instances.size === 1) {
      this.lastActivePlayerId = id
      this.listenKeys(true)
    }

    // Возвращаем функцию для отмены регистрации
    return () => {
      this.instances.delete(id)
      if (this.instances.size === 0) this.listenKeys(false)
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

  // === Горячие клавиши ===

  /** Слушаем, пока на странице есть хоть один плеер. */
  private listenKeys(on: boolean): void {
    if (typeof window === 'undefined') return
    if (on) {
      window.addEventListener('keydown', this.onKeydown)
      window.addEventListener('keyup', this.onKeyup)
      window.addEventListener('blur', this.onBlur)
    } else {
      window.removeEventListener('keydown', this.onKeydown)
      window.removeEventListener('keyup', this.onKeyup)
      window.removeEventListener('blur', this.onBlur)
      this.held.clear()
    }
  }

  /**
   * На window — после всех обработчиков страницы: кто обработал клавишу сам
   * (поле ввода, модалка), тот её и забрал.
   */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return
    const action = hotkeyAction(event)
    if (!action) return
    const code = hotkeyCode(event)
    const now = performance.now()

    // Клавишу держат: пробел не щёлкает паузой 30 раз в секунду, а перемотка
    // не сыплет запросами сегментов. Страница при этом тоже не прокручивается.
    if (event.repeat) {
      const decision = this.held.repeat(code, action, now)
      if (decision === 'pass') return
      event.preventDefault()
      if (decision === 'run') this.hotkeyTarget(event)?.handleHotkey(action)
      return
    }

    const player = this.hotkeyTarget(event)
    if (!player?.handleHotkey(action)) return
    event.preventDefault()
    this.held.press(code, now)
  }

  /** Отпустили нашу клавишу. Firefox нажимает кнопку в фокусе на keyup пробела — не даём. */
  private readonly onKeyup = (event: KeyboardEvent): void => {
    if (this.held.release(hotkeyCode(event))) event.preventDefault()
  }

  private readonly onBlur = (): void => {
    this.held.clear()
  }

  /**
   * Плеер, которому достаётся клавиша, или null — тогда она работает как обычно.
   * Во весь экран → с фокусом внутри → играющий → последний запущенный, если
   * виден → под мышью. Без полного экрана и фокуса — только после первого
   * запуска видео: до этого пробел листает страницу.
   */
  private hotkeyTarget(event: KeyboardEvent): VideoPlayerInstance | null {
    const origin = event.target instanceof Element ? event.target : null
    const players = [...this.instances.values()]
    const lastActive = this.getLastActivePlayer()
    const player =
      players.find((p) => p.isFullscreen()) ??
      (origin ? players.find((p) => p.element()?.contains(origin)) : undefined) ??
      (this.hasUserInteracted
        ? (players.find((p) => p.isPlaying()) ??
          (lastActive?.isStarted() && isOnScreen(lastActive.element()) ? lastActive : undefined) ??
          players.find((p) => p.isHovered()))
        : undefined)
    if (!player) return null
    return isHotkeyBlockedBy(origin, player.element(), player.isPointerMode()) ? null : player
  }
}

// Экспортируем singleton экземпляр
export const videoPlayerManager = new VideoPlayerManager()
