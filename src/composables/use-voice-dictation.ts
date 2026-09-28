/**
 * Голосовой ввод в поле: кнопка поля зовёт `toggle`, распознанные фразы
 * вставляются туда, где стоит курсор.
 *
 * Вставка идёт через execCommand('insertText'), когда поле в фокусе: так
 * работает Ctrl+Z и срабатывает input, на который подписан v-model. Если
 * фокус ушёл в другое поле, текст всё равно встаёт в своё, на запомненное
 * полем место курсора, но уже без истории отмены.
 */

import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import { applySpokenCommands } from '@/helpers/voice-input/spoken-commands'
import { joinDictation } from '@/helpers/voice-input/join-dictation'
import { useVoiceInputStore } from '@/stores/voice-input-store'

type TextField = HTMLTextAreaElement | HTMLInputElement

export interface VoiceDictationOptions {
  getElement: () => TextField | null
  /** Язык речи в кодах интерфейса (ru, en, kr…). */
  language: () => string
}

let counter = 0

/** Вставить распознанную фразу в позицию курсора. */
export function insertDictated(el: TextField, raw: string, lang: string): void {
  const chunk = applySpokenCommands(raw, lang)
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const text = joinDictation(el.value.slice(0, start), el.value.slice(end), chunk, lang)
  if (!text) return
  if (document.activeElement === el) {
    try {
      if (document.execCommand('insertText', false, text)) return
    } catch {
      // execCommand недоступен — вставим напрямую
    }
  }
  el.setRangeText(text, start, end, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function useVoiceDictation(options: VoiceDictationOptions) {
  const store = useVoiceInputStore()
  const id = `dictation-${++counter}`

  store.register({
    id,
    language: options.language,
    context: () => {
      const el = options.getElement()
      if (!el) return ''
      const pos = el.selectionStart ?? el.value.length
      return el.value.slice(Math.max(0, pos - 300), pos)
    },
    insert: (text) => {
      const el = options.getElement()
      if (el) insertDictated(el, text, options.language())
    },
  })

  const active = computed(() => store.ownerId === id && store.phase !== 'idle')
  const phase = computed(() => (active.value ? store.phase : 'idle'))
  /** Модель скачивается, а диктовку начали из этого поля. */
  const installing = computed(() => !!store.install && store.pendingOwner === id)

  function toggle(): void {
    void store.toggle(id)
  }

  // Esc заканчивает диктовку, а не закрывает окно с полем: слушаем в фазе
  // захвата, раньше обработчика модалки.
  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !active.value) return
    e.preventDefault()
    e.stopPropagation()
    void store.stop()
  }

  watch(active, (on) => {
    if (on) window.addEventListener('keydown', onKeydown, true)
    else window.removeEventListener('keydown', onKeydown, true)
  })

  onMounted(() => {
    // Статус моделей нужен кнопке заранее: на неподходящем процессоре её нет.
    if (store.available && !store.status) void store.refresh()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown, true)
    // Поле закрыли посреди диктовки — микрофон не должен остаться открытым.
    if (active.value) void store.cancel()
    store.unregister(id)
  })

  return {
    usable: computed(() => store.usable),
    active,
    phase,
    installing,
    installPercent: computed(() => store.installPercent),
    level: computed(() => (active.value ? store.level : 0)),
    speaking: computed(() => active.value && store.speaking),
    loading: computed(() => active.value && store.loading),
    pending: computed(() => (active.value ? store.pending : 0)),
    toggle,
  }
}
