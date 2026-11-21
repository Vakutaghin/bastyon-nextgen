import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Прокрутка списка чатов переживает заход в чат. Окошко на время чата снимает
 * список со страницы, а полноэкранный мессенджер на узком экране прячет его
 * (`display: none` — браузер при этом забывает прокрутку). Без памяти после
 * «Назад» или Esc список вставал в начало, и заглядывать в чаты по очереди
 * было неудобно.
 *
 * Место помнится, пока приложение открыто, и общее у окошка и полноэкранного
 * мессенджера — как и фильтр над списком. Другой `tag` (другой аккаунт, другой
 * запрос поиска) — другой список: старое место к нему не применяется.
 */

interface Place {
  top: number
  tag: string
}

const places = new Map<string, Place>()

/** Забыть все места (для тестов). */
export function forgetListScroll(): void {
  places.clear()
}

type ElementRef = HTMLElement | { $el?: unknown } | null | undefined

function resolve(value: ElementRef): HTMLElement | null {
  if (!value) return null
  if (value instanceof HTMLElement) return value
  const el = (value as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}

/** Спрятанный список (`display: none`) — без высоты: его прокрутку не запоминаем. */
const isShown = (el: HTMLElement): boolean => el.clientHeight > 0

export function useListScrollMemory(target: Ref<ElementRef>, key: string, tag: () => string): void {
  let el: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let wasShown = false

  const save = (): void => {
    if (el && isShown(el)) places.set(key, { top: el.scrollTop, tag: tag() })
  }

  const restore = (): void => {
    const place = places.get(key)
    if (el && place && place.tag === tag() && el.scrollTop !== place.top) el.scrollTop = place.top
  }

  // Список снова показали после `display: none` — вернуть место.
  const onResize = (): void => {
    if (!el) return
    const shown = isShown(el)
    if (shown && !wasShown) restore()
    wasShown = shown
  }

  const detach = (): void => {
    el?.removeEventListener('scroll', save)
    resizeObserver?.disconnect()
    resizeObserver = null
    el = null
  }

  const attach = (next: HTMLElement): void => {
    el = next
    el.addEventListener('scroll', save, { passive: true })
    wasShown = isShown(el)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(el)
    }
    restore()
  }

  // Элемент появляется после отрисовки строк (flush: 'post') — место ставится
  // сразу, без мигания с начала списка.
  watch(
    () => resolve(target.value),
    (next) => {
      if (next === el) return
      detach()
      if (next) attach(next)
    },
    { immediate: true, flush: 'post' }
  )

  onBeforeUnmount(detach)
}
