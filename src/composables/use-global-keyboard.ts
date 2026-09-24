import { onMounted, onBeforeUnmount } from 'vue'
import { videoPlayerManager } from '@/b-components/content/video-player/video-player-manager'

/**
 * Глобальные горячие клавиши видеоплеера: Space, M, Shift+>, Shift+<, Shift+/.
 *
 * Почему так аккуратно (S23): обработчик висел в capture-фазе и звал
 * `stopPropagation`, то есть съедал Space и M у ЛЮБОГО сфокусированного
 * элемента — кнопки не нажимались пробелом, select не открывался, модалки не
 * получали клавиши, а собственные хоткеи плеера (`use-video-hotkeys`) вообще
 * не доходили. Теперь: слушаем на `window` (после всех обработчиков документа),
 * уважаем `defaultPrevented` и не трогаем интерактивные элементы и диалоги.
 */

/** Элементы, для которых клавиша — их собственное действие. */
const INTERACTIVE_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'OPTION',
  'SUMMARY',
  'AUDIO',
  'VIDEO',
])

/** Роли ARIA, которые реагируют на Space/Enter сами. */
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'radio',
  'switch',
  'menuitem',
  'option',
  'tab',
  'combobox',
  'textbox',
  'slider',
])

/**
 * `true`, если элемент (или его предок) сам обрабатывает клавиши: поле ввода,
 * кнопка, ссылка, элемент с ролью, открытый диалог.
 */
export function isHotkeyBlockedBy(element: Element | null): boolean {
  if (!element) return false

  const tagName = element.tagName?.toUpperCase?.() ?? ''
  if (INTERACTIVE_TAGS.has(tagName)) return true
  if (tagName === 'A' && element.hasAttribute('href')) return true

  const contentEditable = element.getAttribute('contenteditable')
  if (contentEditable === 'true' || contentEditable === '') return true

  const role = element.getAttribute('role')
  if (role && INTERACTIVE_ROLES.has(role)) return true

  // Внутри модалки/диалога клавиши принадлежат ей, а не фоновому видео.
  if (element.closest?.('[role="dialog"], .ant-modal-wrap, .ant-drawer')) return true

  // Элемент в фокусной ловушке (tabindex) — тоже чужая территория.
  if (element.closest?.('[contenteditable="true"], [contenteditable=""]')) return true

  return false
}

export function useGlobalKeyboard() {
  const handleKeyDown = (event: KeyboardEvent): void => {
    // Кто-то уже обработал (например хоткеи самого плеера) — не дублируем.
    if (event.defaultPrevented) return

    const target = event.target instanceof Element ? event.target : null
    if (isHotkeyBlockedBy(target) || isHotkeyBlockedBy(document.activeElement)) return

    // Горячие клавиши работают только если пользователь уже взаимодействовал с видео.
    if (!videoPlayerManager.getHasUserInteracted()) return

    // Space — play/pause (и не даём странице прокрутиться).
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault()
      videoPlayerManager.toggleCurrentPlaying()
      return
    }

    // M (по коду — независимо от раскладки) — mute/unmute.
    if (event.code === 'KeyM') {
      event.preventDefault()
      videoPlayerManager.toggleMute()
      return
    }

    if (event.code === 'Period' && event.shiftKey) {
      event.preventDefault()
      videoPlayerManager.increasePlaybackRate()
      return
    }

    if (event.code === 'Comma' && event.shiftKey) {
      event.preventDefault()
      videoPlayerManager.decreasePlaybackRate()
      return
    }

    if (event.code === 'Slash' && event.shiftKey) {
      event.preventDefault()
      videoPlayerManager.toggleHotkeysHelp()
    }
  }

  onMounted(() => {
    // window, а не document: событие доходит сюда ПОСЛЕ обработчиков документа,
    // поэтому хоткеи плеера успевают пометить его обработанным.
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
