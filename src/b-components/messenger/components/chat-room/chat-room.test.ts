// Полоса ввода чата: недописанное сообщение ждёт в своём чате, в окне на
// компьютере курсор сразу в поле, пикер эмодзи закрывается щелчком мимо и
// клавишей Esc (и Esc при этом не уводит из чата), файл можно бросить на
// ленту сообщений, а не только на полосу ввода. Matrix, стор мессенджера и
// лента подменены; поле, пикер и вложения — настоящие.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown> & { activeChatId: string | null },
  drafts: {} as Record<string, string>,
  sendImage: vi.fn(),
  sendFile: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('../../store/messenger-chat-store', () => ({
  useMessengerChatStore: () => ({ drafts: mocks.drafts }),
}))
vi.mock('../../store/messenger-profile-cache', () => ({
  useMessengerProfileCache: () => ({ changedKeyPeers: {}, acceptChangedKeys: vi.fn() }),
}))
vi.mock('../../services/matrix-service', () => ({ matrixService: { sendTyping: vi.fn() } }))
vi.mock('./use-typing-indicator', async () => {
  const { ref } = await import('vue')
  return { useTypingIndicator: () => ({ isTyping: ref(false), typingName: ref('') }) }
})
vi.mock('./use-read-receipts', async () => {
  const { ref } = await import('vue')
  return { useReadReceipts: () => ({ seenIds: ref(new Set<string>()) }) }
})
vi.mock('./use-block-user', async () => {
  const { ref } = await import('vue')
  return { useBlockUser: () => ({ isBlocked: ref(false), busy: ref(false), toggleBlock: vi.fn() }) }
})
vi.mock('./use-ipfs-send', async () => {
  const { ref } = await import('vue')
  return { useIpfsSend: () => ({ available: ref(false), sendViaIpfs: vi.fn() }) }
})
vi.mock('./use-mesh-share', async () => {
  const { ref } = await import('vue')
  return { useMeshShare: () => ({ available: ref(false), shareAddress: vi.fn() }) }
})

import { useMessengerUiStore } from '../../store/messenger-ui-store'
import type { Message } from '../../types'
import ChatRoom from './chat-room.vue'

const MESSAGE: Message = {
  id: '$1',
  chatId: '!a:host',
  senderId: '@alice:host',
  text: 'Привет!',
  timestamp: Date.now(),
  read: true,
  status: 'read',
}

let mounted: VueWrapper | null = null

function open(chatId: string, props: Record<string, unknown> = {}): VueWrapper {
  mocks.store.activeChatId = chatId
  useMessengerUiStore().activeChatId = chatId
  mounted = mount(ChatRoom, {
    props: { messages: [MESSAGE], ...props },
    global: {
      plugins: [i18n],
      provide: { theme: {} },
      stubs: {
        MessageList: true,
        PkoinTransferModal: true,
        VoiceInputButton: true,
        MeshRouteBar: true,
        Popconfirm: true,
      },
    },
    attachTo: document.body,
  })
  return mounted
}

function close(): void {
  mounted?.unmount()
  mounted = null
}

const field = (w: VueWrapper) => w.find('textarea').element as HTMLTextAreaElement

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(mocks.drafts)) delete mocks.drafts[key]
  mocks.sendImage.mockReset()
  mocks.sendFile.mockReset()
  mocks.store = reactive({
    activeChatId: null,
    currentUser: { id: 'me', name: 'Я' },
    userProfiles: {},
    lastTargetAddress: null,
    activeMeshRoute: null,
    toggleMeshRoute: vi.fn(),
    shareMeshBinding: vi.fn(),
    replyToMessage: vi.fn(),
    sendImage: mocks.sendImage,
    sendFile: mocks.sendFile,
    sendAudio: vi.fn(),
    getDirectPartnerAddress: () => null,
    startChatWithAddress: vi.fn(),
  }) as typeof mocks.store
})

afterEach(close)

describe('полоса ввода чата', () => {
  it('недописанное сообщение ждёт в своём чате; отправленное — стирается', async () => {
    let w = open('!a:host')
    await w.find('textarea').setValue('Встретимся в\nсубботу?')
    close()

    w = open('!b:host')
    expect(field(w).value).toBe('')
    await w.find('textarea').setValue('Ок')
    close()

    w = open('!a:host')
    expect(field(w).value).toBe('Встретимся в\nсубботу?')
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toEqual([['Встретимся в\nсубботу?']])
    expect(field(w).value).toBe('')
    expect(mocks.drafts).toEqual({ '!b:host': 'Ок' })
  })

  it('в окне на компьютере курсор сразу в поле, на телефоне — нет', async () => {
    useMessengerUiStore().isOpen = true
    let w = open('!a:host')
    await flushPromises()
    expect(document.activeElement).not.toBe(field(w))
    close()

    w = open('!a:host', { focusOnOpen: true })
    await flushPromises()
    expect(document.activeElement).toBe(field(w))
  })

  it('у кнопки отправки — подсказка про Enter и Shift+Enter, клавиша на телефоне — «Отправить»', async () => {
    const w = open('!a:host')
    expect(w.find('textarea').attributes('enterkeyhint')).toBe('send')
    await w.find('textarea').setValue('Привет')
    expect(w.find('button[aria-label="Отправить сообщение"]').attributes('title')).toBe(
      'Enter — отправить, Shift+Enter — новая строка'
    )
  })

  it('пикер эмодзи закрывается щелчком мимо полосы ввода и клавишей Esc', async () => {
    const leaveChat = vi.fn()
    window.addEventListener('keydown', leaveChat)
    const w = open('!a:host')
    const toggle = w.find('button[aria-label="Открыть выбор эмодзи"]')

    await toggle.trigger('click')
    expect(w.text()).toContain('Эмодзи')
    // Щелчок по самому полю пикер не закрывает: эмодзи ставят по одному.
    w.find('textarea').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(w.text()).toContain('Эмодзи')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(w.text()).not.toContain('Эмодзи')

    await toggle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(w.text()).not.toContain('Эмодзи')
    expect(leaveChat).not.toHaveBeenCalled()
    window.removeEventListener('keydown', leaveChat)
  })

  it('файл можно бросить на ленту сообщений; картинка, вставленная в поиск, не уходит', async () => {
    const w = open('!a:host')
    await flushPromises()
    const photo = new File(['x'], 'sea.jpg', { type: 'image/jpeg' })
    const withFiles = (type: string, key: 'dataTransfer' | 'clipboardData') => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, key, { value: { files: [photo], types: ['Files'] } })
      return event
    }

    // Мимо полосы ввода — на строку поиска над лентой.
    w.find('input[type="search"]').element.dispatchEvent(withFiles('drop', 'dataTransfer'))
    await flushPromises()
    expect(mocks.sendImage).toHaveBeenCalledWith('!a:host', photo, { name: 'sea.jpg' })

    w.find('input[type="search"]').element.dispatchEvent(withFiles('paste', 'clipboardData'))
    await flushPromises()
    expect(mocks.sendImage).toHaveBeenCalledTimes(1)

    w.find('textarea').element.dispatchEvent(withFiles('paste', 'clipboardData'))
    await flushPromises()
    expect(mocks.sendImage).toHaveBeenCalledTimes(2)
  })
})
