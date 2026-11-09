// Выделение сообщений в ленте, как в Telegram: долгое нажатие пальцем,
// протяжка мышью, щелчки в режиме выделения, Shift+щелчок. Стор мессенджера
// подменён, лента и сообщения — настоящие.

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
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
import { useMessageSelection, type MessageSelection } from './use-message-selection'

function msg(n: number, over: Partial<Message> = {}): Message {
  return {
    id: `$${n}`,
    chatId: '!room:host',
    senderId: n % 2 ? '@alice:host' : 'me',
    text: n === 2 ? `см. https://example.com/${n}` : `сообщение ${n}`,
    timestamp: Date.now(),
    read: true,
    status: 'read',
    ...over,
  }
}

let wrapper: VueWrapper | null = null
let selection: MessageSelection

function render(messages: Message[] = [1, 2, 3, 4].map((n) => msg(n))) {
  const page = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: page }],
  })
  selection = useMessageSelection()
  wrapper = mount(MessageList, {
    props: { messages, selection },
    attachTo: document.body,
    global: { plugins: [i18n, router], provide: { theme: {} }, stubs: { LinkPreview: true } },
  })
  return wrapper
}

const row = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-select-id="${id}"]`)!
const list = (): HTMLElement => document.querySelector<HTMLElement>('[data-testid="message-list"]')!

function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init })
}

function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const selectedIds = (): string[] => [...selection.ids].sort()

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
  vi.useRealTimers()
  delete (document as { elementFromPoint?: unknown }).elementFromPoint
})

describe('выделение сообщений: палец', () => {
  it('долгое нажатие выделяет сообщение и включает режим; щелчок после него не снимает', async () => {
    vi.useFakeTimers()
    render()
    row('$2').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 })
    )
    // Пока палец лежит, текст под ним не выделяется.
    await wrapper!.vm.$nextTick()
    expect(list().classList.contains('pressing')).toBe(true)

    vi.advanceTimersByTime(450)
    await wrapper!.vm.$nextTick()
    expect(selectedIds()).toEqual(['$2'])
    expect(list().classList.contains('selecting')).toBe(true)
    expect(document.querySelectorAll('[data-testid="select-check"]')).toHaveLength(4)
    expect(row('$2').classList.contains('selected')).toBe(true)

    // Отпустили — браузер может прислать щелчок: он не снимает отметку.
    window.dispatchEvent(pointer('pointerup', { pointerType: 'touch' }))
    expect(click(row('$2')).defaultPrevented).toBe(true)
    expect(selectedIds()).toEqual(['$2'])
  })

  it('палец поехал — это прокрутка, не выделение', () => {
    vi.useFakeTimers()
    render()
    row('$1').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 })
    )
    window.dispatchEvent(pointer('pointermove', { pointerType: 'touch', clientX: 10, clientY: 40 }))
    vi.advanceTimersByTime(1000)
    expect(selection.active).toBe(false)
  })

  it('системное меню долгого нажатия не открывается, сообщение выделяется', () => {
    vi.useFakeTimers()
    render()
    row('$3').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }))
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    row('$3').dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    expect(selectedIds()).toEqual(['$3'])
  })
})

describe('выделение сообщений: щелчки в режиме', () => {
  it('без режима щелчок по сообщению ничего не выделяет', () => {
    render()
    expect(click(row('$1')).defaultPrevented).toBe(false)
    expect(selection.active).toBe(false)
  })

  it('щелчок отмечает и снимает; сняли последнее — режим кончился', async () => {
    render()
    selection.toggle('$1')
    await wrapper!.vm.$nextTick()
    click(row('$3'))
    expect(selectedIds()).toEqual(['$1', '$3'])
    click(row('$1'))
    click(row('$3'))
    expect(selection.active).toBe(false)
  })

  it('ссылка в режиме не открывается — щелчок отмечает сообщение', async () => {
    render()
    selection.toggle('$1')
    await wrapper!.vm.$nextTick()
    const link = row('$2').querySelector('a')!
    expect(click(link).defaultPrevented).toBe(true)
    expect(selectedIds()).toEqual(['$1', '$2'])
  })

  it('Shift+щелчок — всё подряд от предыдущего', async () => {
    render()
    selection.toggle('$1')
    await wrapper!.vm.$nextTick()
    click(row('$4'), { shiftKey: true })
    expect(selectedIds()).toEqual(['$1', '$2', '$3', '$4'])
  })

  it('удалённое из ленты выпадает из выделения', async () => {
    const messages = reactive([1, 2, 3].map((n) => msg(n)))
    render(messages)
    selection.toggle('$1')
    selection.toggle('$2')
    messages[0]!.deleted = { by: 'me', at: Date.now() }
    await wrapper!.vm.$nextTick()
    expect(selectedIds()).toEqual(['$2'])
  })

  it('«Выбрать» в меню сообщения включает режим с этим сообщением', async () => {
    render()
    await wrapper!.find('[data-select-id="$3"] [data-testid="message-actions"]').trigger('click')
    await vi.waitFor(() => {
      if (!document.querySelector('[data-testid="message-select"]')) throw new Error('no menu')
    })
    document.querySelector<HTMLElement>('[data-testid="message-select"]')!.click()
    expect(selectedIds()).toEqual(['$3'])
    await wrapper!.vm.$nextTick()
    // В режиме у сообщений нет «⋯».
    expect(document.querySelector('[data-testid="message-actions"]')).toBeNull()
  })
})

describe('выделение сообщений: протяжка мышью', () => {
  /** Строки по 100 px сверху вниз; лента — 0…400. */
  function layout(): void {
    const rows = ['$1', '$2', '$3', '$4'].map(row)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (_x: number, y: number) => rows[Math.floor(y / 100)] ?? list(),
    })
    vi.spyOn(list(), 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 400,
      left: 0,
      right: 500,
    } as DOMRect)
  }

  it('от поля у пузыря к другим сообщениям — выделяет подряд; щелчок после — не в счёт', async () => {
    render()
    layout()
    row('$1').dispatchEvent(
      pointer('pointerdown', { pointerType: 'mouse', button: 0, clientX: 450, clientY: 50 })
    )
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'mouse', clientX: 450, clientY: 120 })
    )
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'mouse', clientX: 450, clientY: 250 })
    )
    expect(selectedIds()).toEqual(['$1', '$2', '$3'])
    await wrapper!.vm.$nextTick()
    expect(list().classList.contains('drag-selecting')).toBe(true)

    // Назад — диапазон сжимается.
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'mouse', clientX: 450, clientY: 150 })
    )
    expect(selectedIds()).toEqual(['$1', '$2'])

    window.dispatchEvent(pointer('pointerup', { pointerType: 'mouse' }))
    expect(click(list()).defaultPrevented).toBe(true)
    expect(selectedIds()).toEqual(['$1', '$2'])
  })

  it('протяжка от текста — выделение текста, как раньше', () => {
    render()
    layout()
    const text = row('$1').querySelector('.message-text')!
    text.dispatchEvent(
      pointer('pointerdown', { pointerType: 'mouse', button: 0, clientX: 100, clientY: 50 })
    )
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'mouse', clientX: 100, clientY: 350 })
    )
    expect(selection.active).toBe(false)
  })

  it('протяжка с отмеченного снимает отметки', async () => {
    render()
    layout()
    ;['$1', '$2', '$3'].forEach((id) => selection.toggle(id))
    await wrapper!.vm.$nextTick()
    row('$2').dispatchEvent(
      pointer('pointerdown', { pointerType: 'mouse', button: 0, clientX: 450, clientY: 150 })
    )
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'mouse', clientX: 450, clientY: 350 })
    )
    expect(selectedIds()).toEqual(['$1'])
  })
})
