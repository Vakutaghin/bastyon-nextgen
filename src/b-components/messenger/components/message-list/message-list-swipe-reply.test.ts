// Ответ смахиванием, как в Telegram: палец ведёт сообщение влево, дальше
// порога — отдача, отпустили — ответ. Прокрутка, смахивание вправо, мышь,
// неотправленное, режим выделения, ползунки — не ответ. Стор мессенджера
// подменён, лента и сообщения — настоящие.

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  haptic: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('@/helpers/common/haptics', () => ({ haptic: mocks.haptic }))
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({ push: vi.fn() }),
}))

import type { Message } from '../../types'
import MessageList from './message-list.vue'
import { useMessageSelection, type MessageSelection } from './use-message-selection'
import { SWIPE_REPLY_DISTANCE } from './use-swipe-reply'

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

function render(messages: Message[] = [1, 2, 3].map((n) => msg(n))) {
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

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'touch',
      ...init,
    })
  )
}

/** Палец от (200, 100) до (200 + dx, 100 + dy) — шагами, как ведёт рука. */
function drag(target: Element, dx: number, dy = 0, init: PointerEventInit = {}): void {
  pointer(target, 'pointerdown', { clientX: 200, clientY: 100, ...init })
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    pointer(window, 'pointermove', {
      clientX: 200 + (dx * i) / steps,
      clientY: 100 + (dy * i) / steps,
      ...init,
    })
  }
}

const replies = (): string[] => (wrapper!.emitted('reply') ?? []).map(([m]) => (m as Message).id)

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.haptic.mockClear()
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
})

describe('ответ смахиванием', () => {
  it('дальше порога и отпустили — ответ на это сообщение; щелчок после него не открывает ссылку', () => {
    vi.useFakeTimers()
    render()
    const target = row('$2').querySelector('.message-text')!
    drag(target, -(SWIPE_REPLY_DISTANCE + 20))
    const swiped = row('$2')
    // Сообщение едет за пальцем, стрелка «готово», телефон отзывается.
    expect(swiped.classList.contains('swiping')).toBe(true)
    expect(swiped.classList.contains('swipe-armed')).toBe(true)
    expect(swiped.style.getPropertyValue('--swipe-x')).toMatch(/^-\d/)
    expect(mocks.haptic).toHaveBeenCalledTimes(1)

    pointer(window, 'pointerup', { clientX: 100, clientY: 100 })
    expect(replies()).toEqual(['$2'])

    const link = target.querySelector('a') ?? target
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)

    // Возвращается на место и снимает пометки.
    expect(swiped.classList.contains('swipe-settle')).toBe(true)
    vi.advanceTimersByTime(250)
    expect(swiped.classList.contains('swiping')).toBe(false)
    expect(swiped.style.getPropertyValue('--swipe-x')).toBe('')
  })

  it('не дотянули до порога — сообщение вернулось, ответа нет', () => {
    render()
    drag(row('$1'), -(SWIPE_REPLY_DISTANCE - 20))
    expect(row('$1').classList.contains('swiping')).toBe(true)
    expect(row('$1').classList.contains('swipe-armed')).toBe(false)
    pointer(window, 'pointerup')
    expect(replies()).toEqual([])
    expect(mocks.haptic).not.toHaveBeenCalled()
  })

  it('дотянули и вернули палец назад — передумали', () => {
    render()
    drag(row('$1'), -(SWIPE_REPLY_DISTANCE + 20))
    pointer(window, 'pointermove', { clientX: 190, clientY: 100 })
    expect(row('$1').classList.contains('swipe-armed')).toBe(false)
    pointer(window, 'pointerup')
    expect(replies()).toEqual([])
  })

  it('вверх-вниз — прокрутка, вправо — не ответ', () => {
    render()
    drag(row('$1'), -40, 60)
    expect(row('$1').classList.contains('swiping')).toBe(false)
    pointer(window, 'pointerup')

    drag(row('$1'), SWIPE_REPLY_DISTANCE + 20)
    expect(row('$1').classList.contains('swiping')).toBe(false)
    pointer(window, 'pointerup')
    expect(replies()).toEqual([])
  })

  it('браузер забрал жест (прокрутка) — ответа нет', () => {
    render()
    drag(row('$1'), -(SWIPE_REPLY_DISTANCE + 20))
    pointer(window, 'pointercancel')
    expect(replies()).toEqual([])
  })

  it('мышью не смахивают — для неё «Ответить» в меню', () => {
    render()
    drag(row('$1'), -(SWIPE_REPLY_DISTANCE + 20), 0, { pointerType: 'mouse' })
    pointer(window, 'pointerup', { pointerType: 'mouse' })
    expect(row('$1').classList.contains('swiping')).toBe(false)
    expect(replies()).toEqual([])
  })

  it('на неотправленное ответить нельзя — оно не смахивается', () => {
    render([msg(1), msg(2, { id: 'temp-2', status: 'sending' })])
    const pending = document.querySelector<HTMLElement>('[data-select-id="temp-2"]')!
    expect(pending.dataset.replyId).toBeUndefined()
    drag(pending, -(SWIPE_REPLY_DISTANCE + 20))
    pointer(window, 'pointerup')
    expect(replies()).toEqual([])
  })

  it('в режиме выделения смахивания нет', () => {
    render()
    selection.toggle('$3')
    drag(row('$1'), -(SWIPE_REPLY_DISTANCE + 20))
    pointer(window, 'pointerup')
    expect(row('$1').classList.contains('swiping')).toBe(false)
    expect(replies()).toEqual([])
  })

  it('по ползунку и плееру палец ведёт их, а не сообщение', () => {
    render()
    const slider = row('$1').appendChild(document.createElement('div'))
    slider.setAttribute('role', 'slider')
    drag(slider, -(SWIPE_REPLY_DISTANCE + 20))
    pointer(window, 'pointerup')
    expect(replies()).toEqual([])
  })
})
