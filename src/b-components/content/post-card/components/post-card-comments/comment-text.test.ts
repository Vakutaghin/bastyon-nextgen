import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ru from '@/locales/ru'
import CommentText from './comment-text.vue'
import { COLLAPSE_AFTER_LINES, exceedsLines } from './composables/use-text-overflow'

// Длинный комментарий под постом свёрнут, кнопка разворачивает и сворачивает.
// В happy-dom раскладки нет: высота текста — из числа строк в html, строка 20px.

const LINE = 20
let resizeCallbacks: Array<() => void> = []

class FakeResizeObserver {
  private readonly cb: () => void
  constructor(cb: () => void) {
    this.cb = cb
    resizeCallbacks.push(cb)
  }
  observe(): void {}
  disconnect(): void {
    resizeCallbacks = resizeCallbacks.filter((c) => c !== this.cb)
  }
}

/** Видимых строк у элемента: задаёт тест (переносы по ширине), иначе — по <br>. */
const forcedLines = new WeakMap<Element, number>()

function linesOf(el: HTMLElement): number {
  return forcedLines.get(el) ?? el.innerHTML.split('<br>').length
}

const lines = (n: number): string =>
  Array.from({ length: n }, (_, i) => `строка ${i + 1}`).join('<br>')

const i18n = createI18n({ legacy: false, locale: 'ru', messages: { ru } })

function mountText(html: string, props: Record<string, unknown> = {}): VueWrapper {
  return mount(CommentText, {
    props: { html, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

const text = (w: VueWrapper) => w.get('[data-testid="comment-text"]')
const toggle = (w: VueWrapper) => w.find('[data-testid="comment-text-toggle"]')

describe('CommentText', () => {
  beforeEach(() => {
    resizeCallbacks = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return linesOf(this) * LINE
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return Math.min(linesOf(this), this.classList.contains('is-clamped') ? 6 : 1e6) * LINE
      },
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ lineHeight: `${LINE}px`, fontSize: '14px' }) as CSSStyleDeclaration
    )
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
  })

  it(`${COLLAPSE_AFTER_LINES} строк — целиком, без кнопки`, async () => {
    const w = mountText(lines(COLLAPSE_AFTER_LINES))
    await nextTick()
    expect(text(w).classes()).not.toContain('is-clamped')
    expect(toggle(w).exists()).toBe(false)
  })

  it('длиннее — свёрнут, «Показать полностью» разворачивает, «Свернуть» сворачивает', async () => {
    const w = mountText(lines(COLLAPSE_AFTER_LINES + 1))
    await nextTick()
    expect(text(w).classes()).toContain('is-clamped')
    expect(toggle(w).text()).toBe('Показать полностью')
    expect(toggle(w).attributes('aria-expanded')).toBe('false')

    await toggle(w).trigger('click')
    expect(text(w).classes()).not.toContain('is-clamped')
    expect(toggle(w).text()).toBe('Свернуть')
    expect(toggle(w).attributes('aria-expanded')).toBe('true')

    await toggle(w).trigger('click')
    expect(text(w).classes()).toContain('is-clamped')
  })

  it('один длинный абзац без переносов тоже сворачивается', async () => {
    const w = mountText('очень длинный абзац '.repeat(80))
    forcedLines.set(text(w).element, 14)
    await w.setProps({ html: 'очень длинный абзац '.repeat(81) })
    await nextTick()
    expect(text(w).classes()).toContain('is-clamped')
  })

  it('окно стало шире и текст влез — кнопка пропадает', async () => {
    const w = mountText('абзац '.repeat(100))
    const el = text(w).element
    forcedLines.set(el, 12)
    resizeCallbacks.forEach((cb) => cb())
    await nextTick()
    expect(toggle(w).exists()).toBe(true)

    forcedLines.set(el, 8)
    resizeCallbacks.forEach((cb) => cb())
    await nextTick()
    expect(toggle(w).exists()).toBe(false)
    expect(text(w).classes()).not.toContain('is-clamped')
  })

  it('переход к комментарию по ссылке — развёрнут сразу', async () => {
    const w = mountText(lines(30), { forceExpanded: true })
    await nextTick()
    expect(text(w).classes()).not.toContain('is-clamped')
    expect(toggle(w).text()).toBe('Свернуть')
  })

  it('щелчок по кнопке не доходит до карточки поста', async () => {
    const onParentClick = vi.fn()
    document.body.addEventListener('click', onParentClick)
    const w = mountText(lines(20))
    await nextTick()
    await toggle(w).trigger('click')
    expect(onParentClick).not.toHaveBeenCalled()
    document.body.removeEventListener('click', onParentClick)
  })
})

describe('exceedsLines', () => {
  it('полстроки запаса на округление высоты строки', () => {
    const el = document.createElement('div')
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '21px',
      fontSize: '14px',
    } as CSSStyleDeclaration)
    Object.defineProperty(el, 'scrollHeight', { value: 21 * 10 + 5, configurable: true })
    expect(exceedsLines(el, 10)).toBe(false)
    Object.defineProperty(el, 'scrollHeight', { value: 21 * 11, configurable: true })
    expect(exceedsLines(el, 10)).toBe(true)
    vi.restoreAllMocks()
  })

  it('line-height: normal — 1,5 размера шрифта', () => {
    const el = document.createElement('div')
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: 'normal',
      fontSize: '14px',
    } as CSSStyleDeclaration)
    Object.defineProperty(el, 'scrollHeight', { value: 21 * 11, configurable: true })
    expect(exceedsLines(el, 10)).toBe(true)
    vi.restoreAllMocks()
  })
})
