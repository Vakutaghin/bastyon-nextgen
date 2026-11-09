import { onBeforeUnmount, ref } from 'vue'

import { haptic } from '@/helpers/common/haptics'

/** Палец ушёл влево на столько — это смахивание, а не касание. */
const START = 12
/** Смахивание — почти горизонтально: по горизонтали вдвое больше, чем по вертикали. */
const SLOPE = 2
/** Отпустили дальше — ответ (как в Telegram, около пятой части экрана телефона). */
export const SWIPE_REPLY_DISTANCE = 64
/** Дальше порога сообщение идёт за пальцем туже и не дальше этого. */
const OVERSHOOT = 32
/** Возврат на место — `--transition-fast` (0,2 с) у строки. */
const SETTLE_MS = 200

/**
 * Касание на них — их собственное действие: ползунки, плеер со своей
 * перемоткой, поля ввода.
 */
const OWN_TOUCH = [
  'input',
  'textarea',
  'select',
  'video',
  'audio',
  '[role="slider"]',
  '[contenteditable]',
].join(', ')

interface Options {
  list: () => HTMLElement | null
  /** Смахивание выключено: режим выделения сообщений. */
  disabled: () => boolean
  /** Ответить на сообщение с этим id. */
  reply: (id: string) => void
}

interface Swipe {
  row: HTMLElement
  id: string
  pointer: number
  x: number
  y: number
  /** Решили, что это смахивание: сообщение едет за пальцем. */
  active: boolean
  /** Дальше порога: отпустить — ответ. */
  armed: boolean
}

/** Блок внутри сообщения, который сам листается вбок (код, таблица), — смахивание его. */
function scrollsSideways(from: Element, row: Element): boolean {
  for (let el: Element | null = from; el && el !== row; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX
      if (overflow === 'auto' || overflow === 'scroll') return true
    }
  }
  return false
}

/**
 * Ответ смахиванием, как в Telegram: палец ведёт сообщение влево, справа
 * проступает стрелка; дальше порога — лёгкая отдача, отпустили — ответ на это
 * сообщение. Только палец: мышью отвечают из меню сообщения. Строка, на
 * которую можно ответить, помечена `data-reply-id`; одни слушатели на всю
 * ленту.
 *
 * Сообщение двигают CSS-переменные на строке (`--swipe-x`, `--swipe-progress`)
 * и классы `swiping`, `swipe-armed`, `swipe-settle` — стили в message-item.
 */
export function useSwipeReply(opts: Options) {
  /** Сообщение сейчас едет за пальцем. */
  const swiping = ref(false)
  let swipe: Swipe | null = null
  /** Щелчок, который браузер шлёт после смахивания, — не нажатие. */
  let swallowClick = false
  const settling = new Set<HTMLElement>()

  function onPointerDown(e: PointerEvent): void {
    swallowClick = false
    if (e.pointerType === 'mouse' || !e.isPrimary || opts.disabled()) return
    const target = e.target instanceof Element ? e.target : null
    const row = target?.closest<HTMLElement>('[data-reply-id]')
    if (!target || !row || !opts.list()?.contains(row)) return
    if (target.closest(OWN_TOUCH) || scrollsSideways(target, row)) return
    end(false)
    swipe = {
      row,
      id: row.dataset.replyId ?? '',
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      active: false,
      armed: false,
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function onMove(e: PointerEvent): void {
    const s = swipe
    if (!s || e.pointerId !== s.pointer) return
    // Пока палец лежал, включился режим выделения (долгое нажатие).
    if (opts.disabled()) return end(false)
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.active) {
      // Вправо или скорее вниз-вверх — не наше: прокрутка ленты.
      if (dx > START || Math.abs(dy) > START) {
        if (Math.abs(dy) >= Math.abs(dx) / SLOPE || dx > 0) return end(false)
      }
      if (-dx < START || Math.abs(dy) * SLOPE > -dx) return
      s.active = true
      swiping.value = true
      s.row.classList.remove('swipe-settle')
      s.row.classList.add('swiping')
      settling.delete(s.row)
    }
    const pull = Math.max(-dx, 0)
    const offset =
      pull <= SWIPE_REPLY_DISTANCE
        ? pull
        : SWIPE_REPLY_DISTANCE + Math.min(OVERSHOOT, (pull - SWIPE_REPLY_DISTANCE) * 0.3)
    s.row.style.setProperty('--swipe-x', `${-offset}px`)
    s.row.style.setProperty('--swipe-progress', String(Math.min(offset / SWIPE_REPLY_DISTANCE, 1)))
    const armed = pull >= SWIPE_REPLY_DISTANCE
    if (armed !== s.armed) {
      s.armed = armed
      s.row.classList.toggle('swipe-armed', armed)
      if (armed) haptic('small')
    }
  }

  function onUp(e: PointerEvent): void {
    if (swipe && e.pointerId === swipe.pointer) end(true)
  }

  function onCancel(e: PointerEvent): void {
    if (swipe && e.pointerId === swipe.pointer) end(false)
  }

  /** Палец отпустили или жест не наш: сообщение возвращается на место. */
  function end(commit: boolean): void {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    const s = swipe
    swipe = null
    if (!s?.active) return
    swiping.value = false
    swallowClick = true
    settle(s.row)
    if (commit && s.armed && s.id) opts.reply(s.id)
  }

  function settle(row: HTMLElement): void {
    row.classList.remove('swipe-armed')
    row.classList.add('swipe-settle')
    row.style.setProperty('--swipe-x', '0px')
    row.style.setProperty('--swipe-progress', '0')
    settling.add(row)
    setTimeout(() => {
      if (!settling.delete(row)) return
      row.classList.remove('swiping', 'swipe-settle')
      row.style.removeProperty('--swipe-x')
      row.style.removeProperty('--swipe-progress')
    }, SETTLE_MS)
  }

  /** Щелчок после смахивания не открывает ссылку и картинку. */
  function onClickCapture(e: MouseEvent): void {
    if (!swallowClick) return
    swallowClick = false
    e.preventDefault()
    e.stopPropagation()
  }

  onBeforeUnmount(() => end(false))

  return { swiping, onPointerDown, onClickCapture }
}
