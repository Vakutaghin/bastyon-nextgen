import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'

/**
 * Подключает paste/drop-обработчики к ref-элементу chat-room.
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

  let dropTarget: HTMLElement | null = null

  const detach = () => {
    if (!dropTarget) return
    dropTarget.removeEventListener('dragenter', handleDragEnter)
    dropTarget.removeEventListener('dragover', handleDragOver)
    dropTarget.removeEventListener('dragleave', handleDragLeave)
    dropTarget.removeEventListener('drop', handleDrop)
    dropTarget = null
  }

  const attachTo = (el: HTMLElement) => {
    if (el === dropTarget) return
    detach()
    dropTarget = el
    el.addEventListener('dragenter', handleDragEnter)
    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)
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

  /**
   * Слушает изменения ref-элемента и переподписывается. Также вешает глобальный paste.
   */
  const bindToRef = <T>(elementRef: Ref<T>) => {
    watch(
      elementRef,
      (val) => {
        const el = unwrapEl(val)
        if (el) attachTo(el)
        else detach()
      },
      { immediate: true, flush: 'post' }
    )
    document.addEventListener('paste', handlePaste)
    onUnmounted(() => {
      detach()
      document.removeEventListener('paste', handlePaste)
    })
  }

  return {
    isDragging,
    bindToRef,
  }
}
