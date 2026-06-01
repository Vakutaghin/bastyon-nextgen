import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { UploadState, UploadDropzoneEmits } from './types'

export interface UploadDropzoneComposables {
  isUploading: ComputedRef<boolean>
  fileInput: Ref<HTMLInputElement | null>
  handleDragOver: (e: DragEvent) => void
  handleDragLeave: (e: DragEvent) => void
  handleDrop: (e: DragEvent) => void
  handleFileInputChange: (e: Event) => void
}

/**
 * Композиция для компонента UploadDropzone
 */
/** Emit-функция, выводящая типы аргументов из карты событий {@link UploadDropzoneEmits}. */
type DropzoneEmit = <E extends keyof UploadDropzoneEmits>(
  event: E,
  ...args: UploadDropzoneEmits[E]
) => void

export function useUploadDropzone(
  props: { state: UploadState },
  emit: DropzoneEmit
): UploadDropzoneComposables {
  const isUploading = computed(() => props.state === 'transcoding' || props.state === 'saving')
  const fileInput = ref<HTMLInputElement | null>(null)

  const handleDragOver = (e: DragEvent) => {
    // Игнорируем drag & drop в состоянии ready
    if (props.state === 'ready') {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const dropZone = e.currentTarget as HTMLElement
    if (dropZone) {
      dropZone.classList.add('drag-over')
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    if (props.state === 'ready') {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const dropZone = e.currentTarget as HTMLElement
    if (dropZone) {
      dropZone.classList.remove('drag-over')
    }
  }

  const handleDrop = async (e: DragEvent) => {
    // Игнорируем drop в состоянии ready
    if (props.state === 'ready') {
      return
    }
    e.preventDefault()
    e.stopPropagation()

    // Убираем drag-over состояние
    const dropZone = e.currentTarget as HTMLElement
    if (dropZone) {
      dropZone.classList.remove('drag-over')
    }

    const file = e.dataTransfer?.files?.[0]
    if (file) {
      emit('fileSelect', file)
    }
  }

  const handleFileInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      emit('fileSelect', file)
    }
  }

  return {
    isUploading,
    fileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange
  }
}
