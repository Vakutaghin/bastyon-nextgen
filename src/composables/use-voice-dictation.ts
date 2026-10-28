/**
 * Голосовой ввод в поле: кнопка поля зовёт `toggle`, распознанные фразы
 * вставляются туда, где стоит курсор.
 *
 * Пока фразу говорят, в поле стоит её черновик и растёт по ходу речи, как на
 * клавиатуре телефона; распознанная целиком фраза встаёт на его место.
 * Черновик меняется напрямую (setRangeText), а текст фразы вставляется через
 * execCommand('insertText'), когда поле в фокусе: так Ctrl+Z убирает фразу
 * одним шагом, а не перебирает черновики, и срабатывает input, на который
 * подписан v-model. Если фокус ушёл в другое поле, текст всё равно встаёт в
 * своё, на запомненное полем место курсора, но уже без истории отмены.
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

/** Черновик фразы в поле: её номер, где он стоит и что вставлено. */
export interface DictationDraft {
  seq: number
  start: number
  text: string
}

let counter = 0

/**
 * WebKit на Ctrl+Z после фразы с черновиком отменяет в два шага: сначала
 * убирает фразу, потом — без изменения текста — ставит курсор в начало поля
 * (поле менялось мимо истории отмены). Запоминаем, где фраза начиналась, и
 * держим курсор там, пока идут такие отмены.
 */
let undoCaret: { el: TextField; value: string; at: number } | null = null
let watchingUndo = false

function onUndo(e: Event): void {
  const u = undoCaret
  if (!u || e.target !== u.el) return
  if ((e as InputEvent).inputType !== 'historyUndo' || u.el.value !== u.value) {
    undoCaret = null
    return
  }
  u.el.setSelectionRange(u.at, u.at)
}

/** Ctrl+Z вернёт в поле `value` — тогда курсор на `at`. */
function rememberUndoCaret(el: TextField, value: string, at: number): void {
  undoCaret = { el, value, at }
  if (watchingUndo) return
  watchingUndo = true
  document.addEventListener('input', onUndo, true)
}

/**
 * Где черновик сейчас: на своём месте или, если текст перед ним правили,
 * там, где такой же текст ближе всего. Стёрли — null.
 */
function locateDraft(el: TextField, draft: DictationDraft): number | null {
  const { value } = el
  if (value.startsWith(draft.text, draft.start)) return draft.start
  let best: number | null = null
  for (let at = value.indexOf(draft.text); at >= 0; at = value.indexOf(draft.text, at + 1)) {
    if (best === null || Math.abs(at - draft.start) < Math.abs(best - draft.start)) best = at
  }
  return best
}

/** Куда ставить фразу и в каком виде. */
function placement(el: TextField, raw: string, lang: string, draft: DictationDraft | null) {
  const caretStart = el.selectionStart ?? el.value.length
  const caretEnd = el.selectionEnd ?? caretStart
  const at = draft ? locateDraft(el, draft) : null
  const start = at ?? caretStart
  const end = at === null ? caretEnd : at + draft!.text.length
  const chunk = applySpokenCommands(raw, lang)
  const text = joinDictation(el.value.slice(0, start), el.value.slice(end), chunk, lang)
  // Курсор стоял в черновике или за ним — идёт за текстом; человек поставил
  // его в другое место — остаётся там.
  const follow = at === null || (caretStart >= start && caretEnd <= end)
  return { replacesDraft: at !== null, start, end, text, follow }
}

/** Показать черновик фразы `seq` вместо прежнего. Возвращает черновик, который теперь в поле. */
export function draftDictated(
  el: TextField,
  raw: string,
  lang: string,
  seq: number,
  draft: DictationDraft | null
): DictationDraft | null {
  if (el.disabled || el.readOnly) return draft
  const { start, end, text, follow } = placement(el, raw, lang, draft)
  if (!text) return draft
  el.setRangeText(text, start, end, follow ? 'end' : 'preserve')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return { seq, start, text }
}

/** Вставить распознанную фразу на место её черновика или в позицию курсора. */
export function insertDictated(
  el: TextField,
  raw: string,
  lang: string,
  draft: DictationDraft | null = null
): void {
  // Поле заблокировано (например, пост уже публикуется): хвост распознавания
  // туда не пишем.
  if (el.disabled || el.readOnly) return
  const { replacesDraft, start, end, text, follow } = placement(el, raw, lang, draft)
  if (!text && !replacesDraft) return
  let to = end
  if (replacesDraft) {
    // Черновик убираем мимо истории отмены: Ctrl+Z вернёт поле к тексту до фразы.
    el.setRangeText('', start, end, follow ? 'start' : 'preserve')
    to = start
  }
  if (text && follow && document.activeElement === el) {
    el.setSelectionRange(start, to)
    const before = el.value
    try {
      if (document.execCommand('insertText', false, text)) {
        if (replacesDraft) rememberUndoCaret(el, before, start)
        return
      }
    } catch {
      // execCommand недоступен — вставим напрямую
    }
  }
  if (text) el.setRangeText(text, start, to, follow ? 'end' : 'preserve')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function useVoiceDictation(options: VoiceDictationOptions) {
  const store = useVoiceInputStore()
  const id = `dictation-${++counter}`

  /** Черновик фразы, которая сейчас звучит. */
  let draft: DictationDraft | null = null

  store.register({
    id,
    language: options.language,
    context: () => {
      const el = options.getElement()
      if (!el) return ''
      const pos = el.selectionStart ?? el.value.length
      return el.value.slice(Math.max(0, pos - 300), pos)
    },
    draft: (text, seq) => {
      const el = options.getElement()
      if (!el) return
      draft = draftDictated(el, text, options.language(), seq, draft?.seq === seq ? draft : null)
    },
    insert: (text, seq) => {
      const el = options.getElement()
      const own = draft?.seq === seq ? draft : null
      draft = null
      if (el) insertDictated(el, text, options.language(), own)
    },
    settle: () => {
      draft = null
    },
  })

  const active = computed(() => store.ownerId === id && store.phase !== 'idle')
  const phase = computed(() => (active.value ? store.phase : 'idle'))
  /** Модель скачивается, а диктовку начали из этого поля. */
  const installing = computed(() => !!store.install && store.pendingOwner === id)

  function toggle(): void {
    void store.toggle(id)
  }

  /** Прервать диктовку в это поле, если она идёт; чужую не трогаем. */
  function cancel(): void {
    if (active.value) void store.cancel()
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
    cancel,
  }
}
