import { computed, nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useFieldValue } from '../input/input'
import type { AutoSizeRows, TextAreaEmits, TextAreaProps } from './types'

/** Свойства, от которых зависит высота текста: их копирует двойник поля. */
const SIZING = [
  'box-sizing',
  'width',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'text-indent',
  'text-transform',
  'white-space',
  'word-break',
  'overflow-wrap',
  'tab-size',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
] as const

const GHOST_CSS =
  'position:absolute;top:0;left:-9999px;height:0;min-height:0;max-height:none;' +
  'overflow:hidden;visibility:hidden;pointer-events:none;resize:none'

let ghost: HTMLTextAreaElement | null = null

/** Скрытое поле для замеров — одно на приложение, как у antd. */
function ghostArea(): HTMLTextAreaElement {
  if (!ghost || !ghost.isConnected) {
    ghost = document.createElement('textarea')
    ghost.tabIndex = -1
    ghost.setAttribute('aria-hidden', 'true')
    document.body.appendChild(ghost)
  }
  return ghost
}

export interface AreaSize {
  /** Высота поля (border-box), px. */
  height: number
  /** Текст длиннее maxRows — нужна прокрутка. */
  scroll: boolean
}

/**
 * Высота поля по тексту в пределах строк. Меряет двойник, а не само поле:
 * сброс высоты поля в auto на кадр уменьшал бы страницу, и прокрутка окна у
 * нижнего края прыгала бы при каждом наборе.
 */
export function measureArea(el: HTMLTextAreaElement, rows: AutoSizeRows): AreaSize {
  const cs = getComputedStyle(el)
  const g = ghostArea()
  g.style.cssText = SIZING.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';') + ';' + GHOST_CSS
  // Пустое поле — по подсказке, как у antd: длинная подсказка не обрезается.
  g.value = el.value || el.placeholder || ''

  const num = (k: string): number => parseFloat(cs.getPropertyValue(k)) || 0
  const line = num('line-height') || num('font-size') * 1.5
  const padding = num('padding-top') + num('padding-bottom')
  const border = num('border-top-width') + num('border-bottom-width')

  const content = g.scrollHeight
  const min = (rows.minRows ?? 1) * line + padding
  const max = rows.maxRows ? rows.maxRows * line + padding : Infinity
  const inner = Math.min(Math.max(content, min), max)
  return { height: inner + border, scroll: content > max }
}

export function autoSizeRows(autoSize: TextAreaProps['autoSize']): AutoSizeRows | null {
  if (!autoSize) return null
  return autoSize === true ? {} : autoSize
}

export function useTextArea(
  p: TextAreaProps,
  emit: TextAreaEmits,
  control: Ref<HTMLTextAreaElement | null>
) {
  const field = useFieldValue(p, (v) => emit('update:value', v), control)
  const rows = computed<AutoSizeRows | null>(() => autoSizeRows(p.autoSize))

  // Высота пишется в style из JS: она меняется с каждым набранным словом.
  function resize(): void {
    const el = control.value
    if (!el || !rows.value) return
    const size = measureArea(el, rows.value)
    el.style.height = `${size.height}px`
    el.style.overflowY = size.scroll ? 'auto' : 'hidden'
  }

  function onInput(e: Event): void {
    field.setValue((e.target as HTMLTextAreaElement).value)
  }

  // После отрисовки: в поле уже новое значение (или возвращённое родителем).
  watch([field.current, rows], () => void nextTick(resize))

  // Ширина поменялась — строки переносятся иначе. Свою же смену высоты
  // пропускаем, иначе наблюдатель звал бы сам себя.
  let observer: ResizeObserver | null = null
  let lastWidth = -1
  onMounted(() => {
    resize()
    const el = control.value
    if (!el || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return
      lastWidth = el.offsetWidth
      resize()
    })
    observer.observe(el)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { ...field, rows, onInput, resize }
}
