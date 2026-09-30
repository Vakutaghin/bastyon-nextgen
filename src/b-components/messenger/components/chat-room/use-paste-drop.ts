import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'

/**
 * Подключает paste/drop-обработчики к элементам chat-room.
 * Делит файлы на 'media' (image/* | video/*) и 'other' и вызывает соответствующий callback.
 * Возвращает isDragging — для подсветки drop-зоны.
 *
 * Порт логики forta.chat/src/features/messaging/model/use-paste-drop.ts, адаптировано под нашу структуру.
 */

const isMediaFile = (file: File): boolean => {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export interface UsePasteDropOptions {
  onMediaFiles: (files: File[]) => void
  onOtherFiles?: (files: File[]) => void
}

export const usePasteDrop = (options: UsePasteDropOptions) => {
  const isDragging = ref(false)
  let dragCounter = 0

  const classifyAndRoute = (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    const media = files.filter(isMediaFile)
    const other = files.filter((f) => !isMediaFile(f))
    if (media.length > 0) options.onMediaFiles(media)
    if (other.length > 0 && options.onOtherFiles) options.onOtherFiles(other)
  }

  const handlePaste = (event: ClipboardEvent) => {
    const files = event.clipboardData?.files
    if (!files || files.length === 0) return
    event.preventDefault()
    classifyAndRoute(files)
  }

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    if (!event.dataTransfer?.types.includes('Files')) return
    dragCounter++
    isDragging.value = true
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      isDragging.value = false
    }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    dragCounter = 0
    isDragging.value = false
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    classifyAndRoute(files)
  }

  /**
   * Распаковывает ref на Vue-компонент или DOM-элемент в HTMLElement.
   * Поддерживает styled-component (через `$el`).
   */
  const unwrapEl = (val: unknown): HTMLElement | null => {
    if (!val) return null
    if (val instanceof HTMLElement) return val
    const maybe = (val as { $el?: unknown }).$el
    return maybe instanceof HTMLElement ? maybe : null
  }

  type Listeners = ReadonlyArray<readonly [string, EventListener]>

  const dropListeners: Listeners = [
    ['dragenter', handleDragEnter as EventListener],
    ['dragover', handleDragOver as EventListener],
    ['dragleave', handleDragLeave as EventListener],
    ['drop', handleDrop as EventListener],
  ]
  const pasteListeners: Listeners = [['paste', handlePaste as EventListener]]

  /**
   * Слушает изменения ref-элемента и переподписывается. Обработчики живут на
   * самом элементе, а не на document (V29).
   */
  const bind = <T>(elementRef: Ref<T>, listeners: Listeners) => {
    let target: HTMLElement | null = null
    const detach = () => {
      if (!target) return
      for (const [name, handler] of listeners) target.removeEventListener(name, handler)
      target = null
    }
    watch(
      elementRef,
      (val) => {
        const el = unwrapEl(val)
        if (el === target) return
        detach()
        if (!el) return
        target = el
        for (const [name, handler] of listeners) el.addEventListener(name, handler)
      },
      { immediate: true, flush: 'post' }
    )
    onUnmounted(detach)
  }

  /** Файлы перетаскивают в любое место чата, а не только на полосу ввода. */
  const bindDropToRef = <T>(elementRef: Ref<T>) => bind(elementRef, dropListeners)

  /**
   * Вставка — только на поле чата. Глобальный слушатель на document жил, пока
   * виджет просто спрятан (он скрывается opacity, ChatRoom остаётся
   * смонтированным), и Ctrl+V скриншота в композер поста молча улетал
   * собеседнику (V29). На весь чат её тоже не вешаем: картинка, вставленная в
   * поиск по переписке, ушла бы собеседнику.
   */
  const bindPasteToRef = <T>(elementRef: Ref<T>) => bind(elementRef, pasteListeners)

  return {
    isDragging,
    bindDropToRef,
    bindPasteToRef,
  }
}
