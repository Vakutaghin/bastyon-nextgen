import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { forgetListScroll, useListScrollMemory } from './use-list-scroll-memory'

// Список чатов: зашли в чат и вернулись (окошко снимает список, узкий
// мессенджер прячет его через display: none) — прокрутка та же.

/** Высота элемента: в happy-dom раскладки нет, спрятанный — 0. */
const heights = new WeakMap<Element, number>()
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

const tag = ref('PAlice')

async function mountList(key = 'chats'): Promise<VueWrapper> {
  const w = mount(
    defineComponent({
      setup() {
        const el = ref<HTMLElement | null>(null)
        useListScrollMemory(el, key, () => tag.value)
        return () => h('div', { ref: el, 'data-list': key })
      },
    }),
    { attachTo: document.body }
  )
  // Список встаёт на учёт после отрисовки (watch с flush: 'post').
  await nextTick()
  return w
}

function listOf(w: VueWrapper): HTMLElement {
  return w.element as HTMLElement
}

function scrollTo(el: HTMLElement, top: number): void {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
}

describe('useListScrollMemory', () => {
  beforeEach(() => {
    forgetListScroll()
    tag.value = 'PAlice'
    resizeCallbacks = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return heights.get(this) ?? 400
      },
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
  })

  it('список снова на странице — на том же месте', async () => {
    const first = await mountList()
    scrollTo(listOf(first), 720)
    first.unmount()

    const again = await mountList()
    await nextTick()
    expect(listOf(again).scrollTop).toBe(720)
  })

  it('без прокрутки до того — список с начала', async () => {
    const w = await mountList()
    await nextTick()
    expect(listOf(w).scrollTop).toBe(0)
  })

  it('спрятанный через display: none и показанный снова — место возвращается', async () => {
    const w = await mountList()
    const el = listOf(w)
    scrollTo(el, 500)

    // Спрятали: браузер забыл прокрутку; прокрутка спрятанного не запоминается.
    heights.set(el, 0)
    resizeCallbacks.forEach((cb) => cb())
    scrollTo(el, 0)

    heights.set(el, 400)
    resizeCallbacks.forEach((cb) => cb())
    expect(el.scrollTop).toBe(500)
  })

  it('другой аккаунт — чужое место не применяется', async () => {
    const first = await mountList()
    scrollTo(listOf(first), 300)
    first.unmount()

    tag.value = 'PBob'
    const again = await mountList()
    await nextTick()
    expect(listOf(again).scrollTop).toBe(0)
  })

  it('список и выдача поиска помнят каждый своё', async () => {
    const chats = await mountList('chats')
    scrollTo(listOf(chats), 640)
    chats.unmount()
    const search = await mountList('search')
    scrollTo(listOf(search), 80)
    search.unmount()

    const chatsAgain = await mountList('chats')
    const searchAgain = await mountList('search')
    await nextTick()
    expect(listOf(chatsAgain).scrollTop).toBe(640)
    expect(listOf(searchAgain).scrollTop).toBe(80)
  })

  it('после снятия со страницы прокрутку не слушает', async () => {
    const w = await mountList()
    const el = listOf(w)
    scrollTo(el, 200)
    w.unmount()
    scrollTo(el, 999)

    const again = await mountList()
    expect(listOf(again).scrollTop).toBe(200)
  })
})
