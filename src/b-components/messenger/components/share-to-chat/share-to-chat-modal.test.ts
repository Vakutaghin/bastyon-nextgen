// Окно «Отправить в чат»: выбрать чаты, подпись, отправить по одному в порядке
// списка; ссылку с ключом файла — не в чат без шифрования; не больше десяти
// чатов; скопировать ссылку. Стор мессенджера, тосты и Modal подменены.

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  messenger: null as unknown as Record<string, unknown>,
  toast: { success: vi.fn(), error: vi.fn() },
  copy: vi.fn(async (_text: string) => true),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.messenger }))
vi.mock('../../store/messenger-screen-store', () => ({
  useMessengerScreenStore: () => ({ hiddenIds: new Set<string>() }),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: mocks.toast }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copy }))
// Окно antd рисуется в body с анимацией — здесь достаточно содержимого.
vi.mock('@/components/modal', () => ({
  default: defineComponent({
    props: { open: Boolean },
    setup(props, { slots }) {
      return () => (props.open ? h('div', { 'data-testid': 'modal' }, slots.default?.()) : null)
    },
  }),
}))

import type { Dialog } from '../../types'
import { useShareToChatStore } from '@/stores/share-to-chat-store'
import ShareToChatModal from './share-to-chat-modal.vue'

function dialog(id: string, name: string, time: number, over: Partial<Dialog> = {}): Dialog {
  return {
    id,
    partner: { id: `@${id}:host`, name } as Dialog['partner'],
    unreadCount: 0,
    lastMessage: { timestamp: time } as Dialog['lastMessage'],
    ...over,
  }
}

let wrapper: VueWrapper | null = null

async function render(dialogs: Dialog[], target = { link: 'https://bastyon.com/post?s=1' }) {
  mocks.messenger.dialogs = dialogs
  wrapper = mount(ShareToChatModal, {
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  useShareToChatStore().open({ title: 'Пост', ...target })
  await nextTick()
  return wrapper
}

const rows = () => wrapper!.findAll('[data-testid="share-to-chat-row"]')
const names = () => wrapper!.findAll('[data-testid="share-to-chat-name"]').map((n) => n.text())
const row = (name: string) => rows().find((r) => r.text().includes(name))!

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.messenger = reactive({
    dialogs: [] as Dialog[],
    isChatsLoading: false,
    syncError: null,
    sendMessage: vi.fn(async () => {}),
    openChat: vi.fn(async () => {}),
  })
  mocks.toast.success.mockClear()
  mocks.toast.error.mockClear()
  mocks.copy.mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('окно «Отправить в чат»', () => {
  it('выбрали два чата и подписали — каждому одно сообщение, в порядке списка', async () => {
    await render([dialog('!a:host', 'Алиса', 10), dialog('!b:host', 'Боб', 20)])
    expect(names()).toEqual(['Боб', 'Алиса'])

    await row('Алиса').trigger('click')
    await row('Боб').trigger('click')
    await wrapper!.get('[data-testid="share-to-chat-comment"]').setValue('Глянь')
    const send = wrapper!.get('[data-testid="share-to-chat-send"]')
    expect(send.text()).toContain('Отправить (2)')
    await send.trigger('click')
    // Окно не ждёт сервер чатов: закрыто сразу, сообщения уходят по одному в фоне.
    expect(useShareToChatStore().isOpen).toBe(false)
    expect(mocks.toast.success.mock.calls[0]![0].message).toBe('Отправлено в 2 чата')

    const text = 'Глянь\nhttps://bastyon.com/post?s=1'
    await vi.waitFor(() => expect(mocks.messenger.sendMessage).toHaveBeenCalledTimes(2))
    expect(mocks.messenger.sendMessage).toHaveBeenNthCalledWith(1, '!b:host', text)
    expect(mocks.messenger.sendMessage).toHaveBeenNthCalledWith(2, '!a:host', text)
  })

  it('сервер чатов не отвечает — окно всё равно закрылось, второй чат ждёт первого', async () => {
    let release: () => void = () => {}
    ;(mocks.messenger.sendMessage as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    await render([dialog('!a:host', 'Алиса', 10), dialog('!b:host', 'Боб', 20)])
    await row('Алиса').trigger('click')
    await row('Боб').trigger('click')
    await wrapper!.get('[data-testid="share-to-chat-send"]').trigger('click')
    expect(useShareToChatStore().isOpen).toBe(false)
    expect(mocks.messenger.sendMessage).toHaveBeenCalledTimes(1)
    release()
    await vi.waitFor(() => expect(mocks.messenger.sendMessage).toHaveBeenCalledTimes(2))
  })

  it('выбранный чат, скрытый поиском, всё равно получает сообщение', async () => {
    await render([dialog('!a:host', 'Алиса', 10), dialog('!b:host', 'Боб', 20)])
    await row('Алиса').trigger('click')
    await wrapper!.get('[data-testid="share-to-chat-search"]').setValue('боб')
    await row('Боб').trigger('click')
    await wrapper!.get('[data-testid="share-to-chat-send"]').trigger('click')
    await vi.waitFor(() => expect(mocks.messenger.sendMessage).toHaveBeenCalledTimes(2))
    const calls = (mocks.messenger.sendMessage as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.map(([id]) => id)).toEqual(['!b:host', '!a:host'])
  })

  it('один чат — тост открывает его по нажатию', async () => {
    await render([dialog('!a:host', 'Алиса', 10)])
    await row('Алиса').trigger('click')
    await wrapper!.get('[data-testid="share-to-chat-send"]').trigger('click')
    await vi.waitFor(() => expect(mocks.toast.success).toHaveBeenCalled())
    const toast = mocks.toast.success.mock.calls[0]![0]
    expect(toast.message).toBe('Отправлено: Алиса')
    toast.onClick()
    expect(mocks.messenger.openChat).toHaveBeenCalledWith('!a:host')
  })

  it('ничего не выбрано — «Отправить» недоступна; поиск по названию', async () => {
    await render([dialog('!a:host', 'Алиса', 10), dialog('!b:host', 'Боб', 20)])
    expect(wrapper!.get('[data-testid="share-to-chat-send"]').attributes('disabled')).toBeDefined()
    await wrapper!.get('[data-testid="share-to-chat-search"]').setValue('али')
    expect(names()).toEqual(['Алиса'])
    await wrapper!.get('[data-testid="share-to-chat-search"]').setValue('никого')
    expect(wrapper!.text()).toContain('Чатов с таким названием нет')
  })

  it('ссылку с ключом файла — не в чат без шифрования', async () => {
    await render(
      [
        dialog('!a:host', 'Алиса', 10),
        dialog('!g:host', 'Открытая группа', 20, {
          group: { unencrypted: 'public', memberCount: 80, previewIds: [] },
        }),
      ],
      { link: 'ipfs://cid#key=secret', secret: true } as never
    )
    const open = row('Открытая группа')
    expect(open.attributes('disabled')).toBeDefined()
    expect(open.text()).toContain('Без шифрования')
    expect(row('Алиса').attributes('disabled')).toBeUndefined()
  })

  it('больше десяти чатов за раз не выбрать', async () => {
    await render(Array.from({ length: 12 }, (_, i) => dialog(`!c${i}:host`, `Чат ${i}`, 100 - i)))
    for (const r of rows().slice(0, 10)) await r.trigger('click')
    expect(rows()[10]!.attributes('disabled')).toBeDefined()
    expect(wrapper!.text()).toContain('За раз — не больше 10 чатов')
  })

  it('«Скопировать ссылку» — та же ссылка, окно закрывается', async () => {
    await render([dialog('!a:host', 'Алиса', 10)])
    await wrapper!.get('[data-testid="share-to-chat-copy"]').trigger('click')
    await vi.waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('https://bastyon.com/post?s=1'))
    expect(useShareToChatStore().isOpen).toBe(false)
  })

  it('чатов нет — так и сказано', async () => {
    await render([])
    expect(wrapper!.text()).toContain('Чатов пока нет')
  })
})
