// Панель над выделенными сообщениями: «Ответить» (одно), «Копировать» в
// формате Telegram, «Удалить» (когда можно все), Esc, Ctrl+C и Delete.
// Стор мессенджера, буфер обмена, тосты и окно подтверждения подменены.

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  copy: vi.fn(async (_text: string) => true),
  toast: { success: vi.fn(), error: vi.fn() },
  confirm: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copy }))
vi.mock('@/b-components/app-toast', () => ({ appToast: mocks.toast }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))

import type { Message } from '../../types'
import { useMessageSelection, type MessageSelection } from '../message-list/use-message-selection'
import MessageSelectionBar from './message-selection-bar.vue'

const AT = new Date(2026, 10, 9, 14, 30).getTime()

function msg(id: string, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: '!room:host',
    senderId: 'me',
    text: `текст ${id}`,
    timestamp: AT,
    read: true,
    status: 'read',
    ...over,
  }
}

let wrapper: VueWrapper | null = null
let selection: MessageSelection

function render(messages: Message[], selected: string[]) {
  selection = useMessageSelection()
  selected.forEach((id) => selection.toggle(id))
  wrapper = mount(MessageSelectionBar, {
    props: { selection, messages },
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  return wrapper
}

const has = (testId: string): boolean => !!wrapper!.find(`[data-testid="${testId}"]`).exists()

function key(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  document.body.dispatchEvent(event)
  return event
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  mocks.store = reactive({
    currentUser: { id: 'me', name: 'Я' },
    userProfiles: {},
    canDeleteOthers: vi.fn(() => false),
    deleteMessage: vi.fn(async () => {}),
  })
  mocks.copy.mockClear()
  mocks.copy.mockResolvedValue(true)
  mocks.toast.success.mockClear()
  mocks.toast.error.mockClear()
  mocks.confirm.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('панель выделенных сообщений', () => {
  it('сколько выделено и «Ответить» — только у одного сообщения', async () => {
    render([msg('$1'), msg('$2')], ['$1', '$2'])
    expect(wrapper!.text()).toContain('2 сообщения')
    expect(has('selection-reply')).toBe(false)

    selection.toggle('$2')
    await wrapper!.vm.$nextTick()
    expect(wrapper!.text()).toContain('1 сообщение')
    await wrapper!.get('[data-testid="selection-reply"]').trigger('click')
    expect(wrapper!.emitted('reply')?.[0]?.[0]).toMatchObject({ id: '$1' })
    expect(selection.active).toBe(false)
  })

  it('«Копировать»: по порядку ленты, с именем и временем; выделение снимается', async () => {
    render(
      [
        msg('$1', { senderId: '@alice:host', senderName: 'Алиса', text: 'Привет' }),
        msg('$2', { text: 'Как дела?' }),
        msg('$3', { type: 'file', text: 'x', info: { name: 'отчёт.pdf' } }),
      ],
      ['$3', '$1', '$2']
    )
    await wrapper!.get('[data-testid="selection-copy"]').trigger('click')
    await vi.waitFor(() => expect(mocks.toast.success).toHaveBeenCalled())
    const text = mocks.copy.mock.calls[0]![0]
    expect(text).toMatch(
      /^Алиса, \[09\.11\.2026, 14:30\]\nПривет\n\nЯ, \[09\.11\.2026, 14:30\]\nКак дела\?\n\n/
    )
    expect(text).toMatch(/\[Файл\] отчёт\.pdf$/)
    expect(selection.active).toBe(false)
  })

  it('одно сообщение копируется одним текстом', async () => {
    render([msg('$1', { text: 'Только текст' })], ['$1'])
    await wrapper!.get('[data-testid="selection-copy"]').trigger('click')
    expect(mocks.copy).toHaveBeenCalledWith('Только текст')
  })

  it('не скопировалось — выделение остаётся, ошибка в тосте', async () => {
    mocks.copy.mockResolvedValue(false)
    render([msg('$1')], ['$1'])
    await wrapper!.get('[data-testid="selection-copy"]').trigger('click')
    await vi.waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    expect(selection.active).toBe(true)
  })

  it('«Удалить»: нет, если среди выделенных чужое без прав; свои — удаляются по одному', async () => {
    render([msg('$1'), msg('$2', { senderId: '@alice:host' })], ['$1', '$2'])
    expect(has('selection-delete')).toBe(false)
    wrapper!.unmount()

    render([msg('$1'), msg('$2')], ['$1', '$2'])
    await wrapper!.get('[data-testid="selection-delete"]').trigger('click')
    const options = mocks.confirm.mock.calls[0]![0]
    expect(options.title).toBe('Удалить 2 сообщения?')
    options.onOk()
    expect(selection.active).toBe(false)
    await vi.waitFor(() => expect(mocks.store.deleteMessage).toHaveBeenCalledTimes(2))
    expect(mocks.store.deleteMessage).toHaveBeenNthCalledWith(1, '!room:host', '$1')
    expect(mocks.store.deleteMessage).toHaveBeenNthCalledWith(2, '!room:host', '$2')
  })

  it('не удалилось — сколько, в тосте', async () => {
    ;(mocks.store.deleteMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'))
    render([msg('$1'), msg('$2')], ['$1', '$2'])
    await wrapper!.get('[data-testid="selection-delete"]').trigger('click')
    mocks.confirm.mock.calls[0]![0].onOk()
    await vi.waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    expect(mocks.toast.error.mock.calls[0]![0].message).toBe('Не удалось удалить 1 сообщение')
  })

  it('неотправленное удалить нельзя — кнопки нет', () => {
    render([msg('$1'), msg('temp-2')], ['$1', 'temp-2'])
    expect(has('selection-delete')).toBe(false)
  })

  it('Esc снимает выделение и не доходит до мессенджера', () => {
    render([msg('$1')], ['$1'])
    const outer = vi.fn()
    window.addEventListener('keydown', outer)
    const event = key({ key: 'Escape' })
    window.removeEventListener('keydown', outer)
    expect(event.defaultPrevented).toBe(true)
    expect(outer).not.toHaveBeenCalled()
    expect(selection.active).toBe(false)
  })

  it('Ctrl+C копирует, Delete спрашивает «Удалить?»; пока окно открыто, Esc — его', async () => {
    render([msg('$1')], ['$1'])
    key({ key: 'c', code: 'KeyC', ctrlKey: true })
    await vi.waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('текст $1'))

    wrapper!.unmount()
    render([msg('$1')], ['$1'])
    key({ key: 'Delete' })
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    key({ key: 'Escape' })
    expect(selection.active).toBe(true)
  })

  it('в поле ввода Ctrl+C и Delete — его', () => {
    render([msg('$1')], ['$1'])
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()
    key({ key: 'Delete' })
    key({ key: 'c', code: 'KeyC', ctrlKey: true })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.copy).not.toHaveBeenCalled()
  })
})
