/**
 * @-меншены для простого композера: детект токена `@query` у курсора, поиск
 * пользователей (`useSearchUsers`) и вставка `@<имя>` в позицию токена.
 *
 * Детектор {@link detectMentionToken} — чистая функция (юнит-тест без DOM).
 */

import { computed, nextTick, ref } from 'vue'
import { useSearchUsers } from '@/composables/use-search-query'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'

export interface MentionToken {
  /** Текст после `@` до курсора. */
  query: string
  /** Индекс символа `@`. */
  start: number
  /** Индекс курсора (конец токена). */
  end: number
}

const MENTION_CHAR = /[A-Za-z0-9_]/

/**
 * Находит активный `@`-токен, заканчивающийся на позиции курсора.
 * `@` должен стоять в начале строки или после пробела (чтобы не ловить e-mail).
 */
export function detectMentionToken(text: string, caret: number): MentionToken | null {
  if (caret < 0 || caret > text.length) return null
  let i = caret - 1
  while (i >= 0 && MENTION_CHAR.test(text[i])) i--
  if (i < 0 || text[i] !== '@') return null
  if (i > 0 && !/\s/.test(text[i - 1])) return null
  return { query: text.slice(i + 1, caret), start: i, end: caret }
}

interface Options {
  /** Текущий текст композера. */
  getText: () => string
  /** DOM <textarea> для чтения курсора и фокуса. */
  getEl: () => HTMLTextAreaElement | null
  /** Записать новый текст в модель композера. */
  setText: (value: string) => void
}

export function useComposerMentions(opts: Options) {
  const token = ref<MentionToken | null>(null)
  const query = ref('')
  const highlight = ref(0)

  const { data } = useSearchUsers(query, 6)
  const results = computed<SearchUserResult[]>(() => (token.value ? (data.value ?? []) : []))
  const show = computed<boolean>(() => !!token.value && results.value.length > 0)

  /** Пересчитать токен по текущему тексту и позиции курсора. */
  function update(): void {
    const el = opts.getEl()
    const text = opts.getText()
    const caret = el ? (el.selectionStart ?? text.length) : text.length
    token.value = detectMentionToken(text, caret)
    query.value = token.value?.query ?? ''
    highlight.value = 0
  }

  function close(): void {
    token.value = null
  }

  function move(dir: 1 | -1): void {
    const n = results.value.length
    if (n === 0) return
    highlight.value = (highlight.value + dir + n) % n
  }

  function select(user: SearchUserResult): void {
    const tk = token.value
    if (!tk) return
    const handle = String(user.name || user.address || '').trim()
    if (!handle) {
      close()
      return
    }
    const text = opts.getText()
    const insert = `@${handle} `
    opts.setText(text.slice(0, tk.start) + insert + text.slice(tk.end))
    const pos = tk.start + insert.length
    close()
    void nextTick(() => {
      const el = opts.getEl()
      if (!el) return
      el.focus()
      try {
        el.setSelectionRange(pos, pos)
      } catch {
        /* noop */
      }
    })
  }

  /** Обработчик keydown textarea. Возвращает true, если событие перехвачено. */
  function onKeydown(e: KeyboardEvent): boolean {
    if (!show.value) return false
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        return true
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        return true
      case 'Enter':
      case 'Tab': {
        const user = results.value[highlight.value]
        if (user) {
          e.preventDefault()
          select(user)
          return true
        }
        return false
      }
      case 'Escape':
        e.preventDefault()
        close()
        return true
      default:
        return false
    }
  }

  return { show, results, highlight, update, close, select, onKeydown }
}
