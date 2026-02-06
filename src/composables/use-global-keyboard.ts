import { onMounted, onBeforeUnmount } from 'vue'
import { videoPlayerManager } from '@/b-components/content/video-player/video-player-manager'

/**
 * Composable для глобальной обработки клавиатуры
 * Обрабатывает нажатие Space, M, Shift+>, Shift+<, Shift+/ для управления видеоплеером
 */
export function useGlobalKeyboard() {
  /**
   * Проверяет, находится ли фокус на элементе ввода (input, textarea, contenteditable)
   */
  const isInputFocused = (): boolean => {
    const activeElement = document.activeElement

    if (!activeElement) {
      return false
    }

    const tagName = activeElement.tagName.toLowerCase()

    // Проверяем input и textarea
    if (tagName === 'input' || tagName === 'textarea') {
      return true
    }

    // Проверяем contenteditable элементы
    const contentEditable = activeElement.getAttribute('contenteditable')
    if (contentEditable === 'true' || contentEditable === '') {
      return true
    }

    return false
  }

  /**
   * Обработчик нажатия клавиш
   */
  const handleKeyDown = (event: KeyboardEvent): void => {
    // Игнорируем, если фокус на элементе ввода
    if (isInputFocused()) {
      return
    }

    // Проверяем, был ли запущен хотя бы один плеер
    // Горячие клавиши работают только если пользователь уже взаимодействовал с видео
    if (!videoPlayerManager.getHasUserInteracted()) {
      return
    }

    // Обрабатываем Space для play/pause
    if (event.code === 'Space' || event.key === ' ') {
      // Предотвращаем стандартное поведение (прокрутку страницы)
      event.preventDefault()
      event.stopPropagation()

      // Переключаем воспроизведение активного или последнего активного видеоплеера
      videoPlayerManager.toggleCurrentPlaying()
      return
    }

    // Обрабатываем M (латинская) для mute/unmute
    // Используем event.code для независимости от раскладки
    if (event.code === 'KeyM') {
      event.preventDefault()
      event.stopPropagation()

      // Переключаем mute/unmute активного или последнего активного видеоплеера
      videoPlayerManager.toggleMute()
      return
    }

    // Обрабатываем Shift+> (Period) для увеличения скорости
    if (event.code === 'Period' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()

      // Увеличиваем скорость воспроизведения
      videoPlayerManager.increasePlaybackRate()
      return
    }

    // Обрабатываем Shift+< (Comma) для уменьшения скорости
    if (event.code === 'Comma' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()

      // Уменьшаем скорость воспроизведения
      videoPlayerManager.decreasePlaybackRate()
      return
    }

    // Обрабатываем Shift+/ (Slash) для показа справки по горячим клавишам (символ ?)
    if (event.code === 'Slash' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()

      // Показываем/скрываем справку
      videoPlayerManager.toggleHotkeysHelp()
      return
    }
  }

  onMounted(() => {
    // Добавляем обработчик на уровне документа
    document.addEventListener('keydown', handleKeyDown, true) // useCapture = true для перехвата до других обработчиков
  })

  onBeforeUnmount(() => {
    // Удаляем обработчик при размонтировании
    document.removeEventListener('keydown', handleKeyDown, true)
  })
}
