/**
 * Поле ввода чата: auto-resize textarea, эмодзи-пикер, отправка по Enter
 * (Shift+Enter — перенос строки). Эмодзи вставляются по текущей позиции каретки.
 *
 * См. CODE_AUDIT.md §1.
 */
import { nextTick, ref, type Ref } from 'vue'

export interface ChatInput {
  inputValue: Ref<string>
  inputRef: Ref<{ $el?: HTMLTextAreaElement } | null>
  showEmojiPicker: Ref<boolean>
  handleSend: () => void
  handleKeydown: (e: KeyboardEvent) => void
  handleInput: () => void
  toggleEmojiPicker: () => void
  onEmojiSelect: (emoji: string) => void
  focusInput: () => void
  adjustHeight: () => void
}

export interface ChatInputOptions {
  /** Колбэк отправки. Вызывается с trimmed-текстом. */
  onSend: (text: string) => void
}

export function useChatInput(opts: ChatInputOptions): ChatInput {
  const inputValue = ref('')
  const inputRef = ref<{ $el?: HTMLTextAreaElement } | null>(null)
  const showEmojiPicker = ref(false)

  function adjustHeight(): void {
    const el = inputRef.value?.$el
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 2 + 'px'
    }
  }

  function handleSend(): void {
    if (inputValue.value.trim()) {
      opts.onSend(inputValue.value.trim())
      inputValue.value = ''
      showEmojiPicker.value = false
      nextTick(adjustHeight)
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(): void {
    adjustHeight()
  }

  function toggleEmojiPicker(): void {
    showEmojiPicker.value = !showEmojiPicker.value
  }

  function onEmojiSelect(emoji: string): void {
    // Вставляем эмодзи в позицию курсора (или в конец, если нет input ref).
    const el = inputRef.value?.$el
    if (el) {
      const start = el.selectionStart
      const end = el.selectionEnd
      const text = inputValue.value
      inputValue.value = text.substring(0, start) + emoji + text.substring(end)

      nextTick(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = start + emoji.length
        adjustHeight()
      })
    } else {
      inputValue.value += emoji
      adjustHeight()
    }
  }

  function focusInput(): void {
    nextTick(() => {
      const el = inputRef.value?.$el
      if (el) {
        el.focus()
        adjustHeight()
      }
    })
  }

  return {
    inputValue,
    inputRef,
    showEmojiPicker,
    handleSend,
    handleKeydown,
    handleInput,
    toggleEmojiPicker,
    onEmojiSelect,
    focusInput,
    adjustHeight,
  }
}
