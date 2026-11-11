// Поиск по чату в ленте: переход к сообщению выше нарисованного, рамка у
// найденного, «к последним», подсветка слов (CSS Custom Highlight API).
// Стор мессенджера подменён, лента и сообщения — настоящие.

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({ push: vi.fn() }),
}))

import type { Message } from '../../types'
import MessageList from './message-list.vue'
import { HIGHLIGHT_ALL, HIGHLIGHT_CURRENT } from './use-search-highlight'

const msg = (n: number, text = `сообщение ${n}`): Message => ({
  id: `$${n}`,
  chatId: '!room:host',
  senderId: n % 2 ? '@alice:host' : 'me',
  text,
  timestamp: 1_000_000 + n,
  read: true,
  status: 'read',
})

const many = (count: number) => Array.from({ length: count }, (_, i) => msg(i))

let wrapper: VueWrapper | null = null

function render(props: Record<string, unknown>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => null } }],
  })
  wrapper = mount(MessageList, {
    props,
    attachTo: document.body,
    global: { plugins: [i18n, router], provide: { theme: {} }, stubs: { LinkPreview: true } },
  })
  return wrapper
}

const rowOf = (id: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-message-id]')].find(
    (el) => el.dataset.messageId === id
  )
type ListApi = { scrollToMessage: (id: string) => Promise<boolean> }

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.store = reactive({
    currentUser: { id: 'me', name: 'Я' },
    userProfiles: {},
    messages: {},
    activeChatId: '!room:host',
    isFullScreen: true,
    fetchProfiles: vi.fn(),
    canDeleteOthers: vi.fn(() => false),
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  delete (globalThis as { Highlight?: unknown }).Highlight
  delete (globalThis as { CSS?: unknown }).CSS
})

describe('лента: поиск по чату', () => {
  it('сообщение выше нарисованного — лента открывается на нём, ниже — «к последним»', async () => {
    const w = render({ messages: many(200) })
    await nextTick()
    expect(rowOf('$20')).toBeUndefined()
    expect(document.querySelector('[data-testid="to-latest"]')).toBeNull()

    expect(await (w.vm as unknown as ListApi).scrollToMessage('$20')).toBe(true)
    await nextTick()
    expect(rowOf('$20')).toBeDefined()
    expect(rowOf('$199')).toBeUndefined()
    const toLatest = document.querySelector<HTMLButtonElement>('[data-testid="to-latest"]')!
    expect(toLatest.getAttribute('aria-label')).toBe('К последним сообщениям')

    toLatest.click()
    await nextTick()
    expect(rowOf('$199')).toBeDefined()
    expect(document.querySelector('[data-testid="to-latest"]')).toBeNull()
  })

  it('такого сообщения в ленте нет — false', async () => {
    const w = render({ messages: many(10) })
    expect(await (w.vm as unknown as ListApi).scrollToMessage('$nope')).toBe(false)
  })

  it('найденное — с рамкой, остальные — без', async () => {
    render({ messages: many(5), focusId: '$3' })
    await nextTick()
    expect(rowOf('$3')!.querySelector('.found')).not.toBeNull()
    expect(rowOf('$2')!.querySelector('.found')).toBeNull()
  })

  it('слова подсвечиваются; у найденного сообщения — отдельно, ярче', async () => {
    const highlights = new Map<string, { ranges: Range[] }>()
    ;(globalThis as { CSS?: unknown }).CSS = { highlights }
    ;(globalThis as { Highlight?: unknown }).Highlight = class {
      ranges: Range[]
      constructor(...ranges: Range[]) {
        this.ranges = ranges
      }
    }
    render({
      messages: [msg(1, 'Привет, Иван'), msg(2, 'Пока'), msg(3, 'привет ещё раз')],
      focusId: '$3',
      highlight: ['привет'],
    })
    await nextTick()
    await nextTick()
    expect(highlights.get(HIGHLIGHT_ALL)!.ranges.map((r) => r.toString())).toEqual(['Привет'])
    expect(highlights.get(HIGHLIGHT_CURRENT)!.ranges.map((r) => r.toString())).toEqual(['привет'])
    await wrapper!.setProps({ highlight: [] })
    await nextTick()
    await nextTick()
    expect(highlights.has(HIGHLIGHT_ALL)).toBe(false)
  })
})

describe('лента: переход по цитате', () => {
  /** Размеры ленты и строк (в jsdom их нет): экран — 300 px, строка — 40 px. */
  function sized(scrollTop: number): void {
    const list = document.querySelector<HTMLElement>('[data-testid="message-list"]')!
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: scrollTop,
    })
    for (const row of document.querySelectorAll<HTMLElement>('[data-message-id]')) {
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 40 })
    }
  }

  it('цитата ведёт к исходному: лента отдаёт нажатие наверх', async () => {
    const reply = { ...msg(2), replyTo: { id: '$1' } }
    const w = render({ messages: [msg(1), reply], quoteLinks: true })
    await nextTick()
    rowOf('$2')!.querySelector<HTMLElement>('[data-testid="reply-quote"]')!.click()
    expect((w.emitted('open-reply')![0]![0] as Message).id).toBe('$2')
  })

  it('к сообщению перешли — подсвечено только оно', async () => {
    render({ messages: many(5), flashId: '$2' })
    await nextTick()
    expect(rowOf('$2')!.querySelector('.flash')).not.toBeNull()
    expect(rowOf('$3')!.querySelector('.flash')).toBeNull()
  })

  it('стрелка внизу ведёт обратно к ответу; ответ снова на экране — стрелка не нужна', async () => {
    const w = render({ messages: many(5) })
    await nextTick()
    // Ответ ниже экрана: стрелка «Вернуться к ответу» вместо «к последним».
    sized(1000)
    await w.setProps({ returnId: '$4' })
    await nextTick()
    const back = document.querySelector<HTMLButtonElement>('[data-testid="jump-back"]')!
    expect(back.getAttribute('aria-label')).toBe('Вернуться к ответу')
    expect(document.querySelector('[data-testid="to-latest"]')).toBeNull()
    expect(w.emitted('returned')).toBeUndefined()
    back.click()
    expect(w.emitted('back')).toHaveLength(1)

    // Долистали до ответа сами.
    sized(0)
    document.querySelector('[data-testid="message-list"]')!.dispatchEvent(new Event('scroll'))
    expect(w.emitted('returned')).toHaveLength(1)
  })
})
