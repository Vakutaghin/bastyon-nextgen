/**
 * Назад и вперёд с клавиатуры и боковыми кнопками мыши, как в браузере:
 * Cmd+[ и Cmd+] на Mac, Alt+← и Alt+→ на остальных. Браузер делает это сам —
 * там не слушаем. В приложении для компьютера движок WebKit (macOS, Linux) по
 * истории сам не ходит, а WebView2 на Windows по Alt+← ходит, и по кнопкам
 * мыши, возможно, тоже: там шагаем, только если он не шагнул сам, иначе шаг
 * удвоился бы. В поле ввода клавиши остаются полю.
 */

import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { stepHistory, type HistoryStep } from './use-history-nav'

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
}

/** Шаг по сочетанию клавиш или null. */
export function historyShortcut(event: KeyboardEvent, apple: boolean): HistoryStep | null {
  if (event.repeat || event.shiftKey || event.ctrlKey) return null
  if (apple) {
    if (!event.metaKey || event.altKey) return null
    // По месту клавиши: в русской раскладке это «Х» и «Ъ».
    if (event.code === 'BracketLeft') return 'back'
    if (event.code === 'BracketRight') return 'forward'
    return null
  }
  if (!event.altKey || event.metaKey) return null
  if (event.key === 'ArrowLeft') return 'back'
  if (event.key === 'ArrowRight') return 'forward'
  return null
}

/** Боковые кнопки мыши (`MouseEvent.button`): 3 — назад, 4 — вперёд. */
export function mouseHistoryStep(button: number): HistoryStep | null {
  if (button === 3) return 'back'
  if (button === 4) return 'forward'
  return null
}

/** Сочетание для подсказки у кнопок шапки — оно же работает и в браузере. */
export function historyShortcutHint(step: HistoryStep, apple: boolean): string {
  if (apple) return step === 'back' ? '⌘[' : '⌘]'
  return step === 'back' ? 'Alt+←' : 'Alt+→'
}

const isTextField = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable)

/** Сколько ждать, не сделает ли шаг сам WebView2: его popstate приходит за десятки мс. */
export const NATIVE_STEP_WAIT_MS = 150

export function useHistoryHotkeys(enabled: () => boolean): void {
  const router = useRouter()
  const apple = isApplePlatform()
  const nativeMayStep = /Windows/i.test(navigator.userAgent)

  function step(to: HistoryStep): void {
    if (!nativeMayStep) {
      stepHistory(router, to)
      return
    }
    let moved = false
    const onPop = (): void => {
      moved = true
    }
    window.addEventListener('popstate', onPop, { once: true })
    window.setTimeout(() => {
      window.removeEventListener('popstate', onPop)
      if (!moved) stepHistory(router, to)
    }, NATIVE_STEP_WAIT_MS)
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || !enabled() || isTextField(event.target)) return
    const to = historyShortcut(event, apple)
    if (!to) return
    event.preventDefault()
    step(to)
  }

  function onMouseUp(event: MouseEvent): void {
    const to = mouseHistoryStep(event.button)
    if (!to || !enabled()) return
    event.preventDefault()
    step(to)
  }

  onMounted(() => {
    if (!isTauri()) return
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('mouseup', onMouseUp)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mouseup', onMouseUp)
  })
}
