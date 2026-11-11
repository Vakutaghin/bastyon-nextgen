// Полоса ввода чата: недописанное сообщение ждёт в своём чате, в окне на
// компьютере курсор сразу в поле, пикер эмодзи закрывается щелчком мимо и
// клавишей Esc (и Esc при этом не уводит из чата), файл можно бросить на
// ленту сообщений, а не только на полосу ввода, отправка выключает голосовой
// ввод. Matrix, стор мессенджера, лента и движок распознавания подменены;
// поле, пикер, вложения и кнопка голосового ввода — настоящие.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown> & { activeChatId: string | null },
  drafts: {} as Record<string, string>,
  scanHistory: vi.fn(),
  revealMessage: vi.fn(),
  revealDate: vi.fn(),
  messageTime: vi.fn(),
  toast: vi.fn(),
  sendImage: vi.fn(),
  sendFile: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('../../store/messenger-chat-store', () => ({
  useMessengerChatStore: () => ({
    drafts: mocks.drafts,
    scanHistory: mocks.scanHistory,
    revealMessage: mocks.revealMessage,
    revealDate: mocks.revealDate,
    messageTime: mocks.messageTime,
  }),
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { info: mocks.toast, error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))
// Участники группы — для «Сообщения участника».
vi.mock('../group-info/use-group-members', async () => {
  const { ref } = await import('vue')
  return {
    useGroupMembers: () => ({
      members: ref([
        { id: '@bob:host', name: 'Боб', membership: 'join', isMe: false },
        { id: '@eve:host', name: 'Ева', membership: 'join', isMe: false },
        { id: '@zed:host', name: 'Зед', membership: 'invite', isMe: false },
      ]),
    }),
  }
})
vi.mock('../../store/messenger-profile-cache', () => ({
  useMessengerProfileCache: () => ({ changedKeyPeers: {}, acceptChangedKeys: vi.fn() }),
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: { sendTyping: vi.fn(), sendRecording: vi.fn(), getClient: () => null },
}))
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
vi.mock('../../lib/support-account', async () => {
  const { ref } = await import('vue')
  return {
    SUPPORT_ACCOUNT_NAME: 'bastyon_nextgen_supp',
    supportAddress: ref('PSupport'),
    resolveSupportAddress: vi.fn(async () => 'PSupport'),
  }
})
// Движок распознавания: команды записываются, события шлёт тест.
const voice = vi.hoisted(() => ({
  calls: [] as string[],
  listeners: new Map<string, (payload: unknown) => void>(),
}))
vi.mock('@/helpers/voice-input/voice-backend', () => ({
  isTauriVoice: () => true,
  isAndroidVoice: () => false,
  voiceAvailable: () => true,
  voiceInvoke: async (cmd: string) => {
    voice.calls.push(cmd)
    if (cmd === 'asr_status')
      return {
        supported: true,
        gpu: true,
        installing: null,
        models: [{ id: 'small', size: 1, installed: true }],
      }
    return cmd === 'asr_start' ? 7 : null
  },
  voiceListen: async (event: string, cb: (payload: unknown) => void) => {
    voice.listeners.set(event, cb)
    return () => {}
  },
}))
const voiceEvent = (event: string, payload: Record<string, unknown>) =>
  voice.listeners.get(event)!({ session: 7, ...payload })

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

/** Кнопка голосового ввода без движка: чат зовёт у неё только `cancel`. */
const DictationStub = defineComponent({
  setup(_, { expose }) {
    expose({ cancel: () => {} })
    return () => null
  },
})

function open(
  chatId: string,
  props: Record<string, unknown> = {},
  { dictation = false } = {}
): VueWrapper {
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
        VoiceInputButton: dictation ? false : DictationStub,
        MeshRouteBar: true,
        Popconfirm: true,
        SupportReportBar: true,
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
  voice.calls.length = 0
  voice.listeners.clear()
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

  it('сообщение ушло — голосовой ввод выключен, хвост фразы в пустое поле не пишется', async () => {
    const w = open('!a:host', {}, { dictation: true })
    await flushPromises()
    const dictation = w.find('button[aria-label="Голосовой ввод"]')
    await dictation.trigger('click')
    await flushPromises()
    expect(voice.calls).toContain('asr_start')
    expect(dictation.attributes('aria-pressed')).toBe('true')

    voiceEvent('asr:partial', { seq: 0, text: 'Встретимся в субботу' })
    await flushPromises()
    expect(field(w).value).toBe('Встретимся в субботу')

    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(w.emitted('send')).toEqual([['Встретимся в субботу']])
    expect(voice.calls).toContain('asr_cancel')
    expect(dictation.attributes('aria-pressed')).toBe('false')

    voiceEvent('asr:text', { seq: 0, text: 'Встретимся в субботу?' })
    voiceEvent('asr:partial', { seq: 1, text: 'И ещё' })
    await flushPromises()
    expect(field(w).value).toBe('')
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

  it('картинка через «Фото» уходит фото, через «Файл» — файлом (оригиналом)', async () => {
    const w = open('!a:host')
    await flushPromises()
    const photo = new File(['x'], 'sea.jpg', { type: 'image/jpeg' })
    const pick = async (input: Element) => {
      Object.defineProperty(input, 'files', { value: [photo], configurable: true })
      input.dispatchEvent(new Event('change'))
      await flushPromises()
    }
    const photoInput = w.find('input[type="file"][accept="image/*"]').element
    const fileInput = w.findAll('input[type="file"]').find((i) => !i.attributes('accept'))!.element

    await pick(photoInput)
    expect(mocks.sendImage).toHaveBeenCalledWith('!a:host', photo, { name: 'sea.jpg' })
    expect(mocks.sendFile).not.toHaveBeenCalled()

    await pick(fileInput)
    expect(mocks.sendFile).toHaveBeenCalledWith('!a:host', photo, { name: 'sea.jpg' })
    expect(mocks.sendImage).toHaveBeenCalledTimes(1)
  })

  it('кнопка «Сведения о приложении» — только в чате с поддержкой', async () => {
    mocks.store.getDirectPartnerAddress = () => 'PAlice'
    let w = open('!a:host')
    expect(w.findComponent({ name: 'SupportReportBar' }).exists()).toBe(false)
    close()

    mocks.store.getDirectPartnerAddress = () => 'PSupport'
    w = open('!support:host')
    expect(w.findComponent({ name: 'SupportReportBar' }).props('chatId')).toBe('!support:host')
  })
})

describe('поиск по переписке', () => {
  const at = (id: string, text: string, timestamp: number): Message => ({
    ...MESSAGE,
    id,
    text,
    timestamp,
  })
  // Лента — с сентября 2026; прочитанное глубже неё — раньше.
  const SEPT = new Date(2026, 8, 1).getTime()
  const FEED = [
    at('$1', 'Привет, как дела?', SEPT + 1),
    at('$2', 'Пока ничего', SEPT + 2),
    at('$3', 'привет ещё раз', SEPT + 3),
  ]

  async function search(w: VueWrapper, text: string): Promise<void> {
    await w.find('[data-testid="chat-search"]').setValue(text)
    await new Promise((r) => setTimeout(r, 250))
    await flushPromises()
  }

  beforeEach(() => {
    mocks.scanHistory.mockReset()
    mocks.scanHistory.mockResolvedValue({ messages: [], exhausted: true })
    mocks.revealMessage.mockReset()
  })
  afterEach(close)

  it('лента остаётся целиком, найденное — «1 из 2», самое свежее, слова — ленте', async () => {
    const w = open('!a:host', { messages: FEED })
    await search(w, 'прив')
    const list = w.findComponent({ name: 'MessageList' })
    expect(list.props('messages')).toHaveLength(3)
    expect(list.props('focusId')).toBe('$3')
    expect(list.props('highlight')).toEqual(['прив'])
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 2')
  })

  it('Enter — старше, Shift+Enter — обратно; кнопки — то же', async () => {
    const w = open('!a:host', { messages: FEED })
    await search(w, 'прив')
    const input = w.find('[data-testid="chat-search"]')
    await input.trigger('keydown', { key: 'Enter' })
    const list = () => w.findComponent({ name: 'MessageList' })
    expect(list().props('focusId')).toBe('$1')
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('2 из 2')
    expect(w.find('[data-testid="chat-search-older"]').attributes('disabled')).toBeDefined()
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(list().props('focusId')).toBe('$3')
    await w.find('[data-testid="chat-search-older"]').trigger('click')
    expect(list().props('focusId')).toBe('$1')
  })

  it('ничего — «Не найдено», лента на месте', async () => {
    const w = open('!a:host', { messages: FEED })
    await search(w, 'самокат')
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('Не найдено')
    expect(w.findComponent({ name: 'MessageList' }).props('messages')).toHaveLength(3)
  })

  it('Esc сбрасывает поиск и не закрывает чат', async () => {
    const w = open('!a:host', { messages: FEED })
    await search(w, 'прив')
    const outer = vi.fn()
    window.addEventListener('keydown', outer)
    await w.find('[data-testid="chat-search"]').trigger('keydown', { key: 'Escape' })
    window.removeEventListener('keydown', outer)
    await new Promise((r) => setTimeout(r, 250))
    await flushPromises()
    expect(outer).not.toHaveBeenCalled()
    expect((w.find('[data-testid="chat-search"]').element as HTMLInputElement).value).toBe('')
    expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBeNull()
  })

  it('пока читается история — «1 из 2+», дата и «Стоп»; нашлось глубже — в счёте', async () => {
    let finish: (v: unknown) => void = () => {}
    mocks.scanHistory
      .mockResolvedValueOnce({
        messages: [at('$0', 'Привет из прошлого', new Date(2026, 7, 12).getTime())],
        exhausted: false,
      })
      .mockImplementationOnce(() => new Promise((r) => (finish = r)))
    const w = open('!a:host', { messages: FEED })
    await search(w, 'привет')
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 3+')
    const status = w.find('[data-testid="chat-search-status"]')
    expect(status.text()).toContain('просмотрено до 12 августа 2026')
    await w.find('[data-testid="chat-search-action"]').trigger('click')
    finish({ messages: [], exhausted: false })
    await flushPromises()
    expect(w.find('[data-testid="chat-search-status"]').text()).toContain('остановлен')
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 3')
  })

  it('найденное глубже ленты — сначала догрузить ленту до него', async () => {
    const deep = at('$0', 'давнее сообщение', 0)
    mocks.scanHistory.mockResolvedValueOnce({ messages: [deep], exhausted: true })
    mocks.revealMessage.mockResolvedValue(true)
    const w = open('!a:host', { messages: FEED })
    await search(w, 'давнее')
    await flushPromises()
    expect(mocks.revealMessage).toHaveBeenCalledWith('!a:host', deep, expect.any(Function))
    expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBe('$0')
  })

  it('выбрали сообщение в поиске по всем чатам — чат встаёт на нём, когда лента собралась', async () => {
    const ui = useMessengerUiStore()
    ui.searchJump = { chatId: '!a:host', query: 'прив', message: FEED[0]! }
    const w = open('!a:host', { messages: FEED, isLoading: true })
    await flushPromises()
    // Лента ещё грузится — ждём.
    expect(ui.searchJump).not.toBeNull()
    await w.setProps({ isLoading: false })
    await flushPromises()
    expect(ui.searchJump).toBeNull()
    expect((w.find('[data-testid="chat-search"]').element as HTMLInputElement).value).toBe('прив')
    expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBe('$1')
    expect(w.find('[data-testid="chat-search-count"]').text()).toBe('2 из 2')
  })

  it('переход к сообщению другого чата этот чат не трогает', async () => {
    const ui = useMessengerUiStore()
    ui.searchJump = { chatId: '!b:host', query: 'прив', message: FEED[0]! }
    const w = open('!a:host', { messages: FEED })
    await flushPromises()
    expect(ui.searchJump).not.toBeNull()
    expect((w.find('[data-testid="chat-search"]').element as HTMLInputElement).value).toBe('')
  })

  describe('сообщения участника группы', () => {
    const GROUP = [
      { ...at('$1', 'Привет всем', SEPT + 1), senderId: '@bob:host' },
      { ...at('$2', 'Привет, Боб', SEPT + 2), senderId: '@eve:host' },
      { ...at('$3', 'Как дела?', SEPT + 3), senderId: '@bob:host' },
    ]
    const input = (w: VueWrapper) => w.find('[data-testid="chat-search"]')

    beforeEach(() => {
      mocks.store.activeDialog = { id: '!g:host', group: { memberCount: 3 } }
    })

    it('в личном чате кнопки нет', () => {
      mocks.store.activeDialog = { id: '!a:host' }
      const w = open('!a:host', { messages: FEED })
      expect(w.find('[data-testid="chat-search-sender"]').exists()).toBe(false)
    })

    it('список по имени, Enter — выбрать: все его сообщения, «От: Боб»; Backspace — у всех', async () => {
      const w = open('!g:host', { messages: GROUP })
      await w.find('[data-testid="chat-search-sender"]').trigger('click')
      // Приглашённый ещё ничего не писал — его в списке нет.
      const options = () =>
        w.findAll('[data-testid="chat-search-sender-option"]').map((o) => o.find('.name').text())
      expect(options()).toEqual(['Боб', 'Ева'])
      expect(input(w).attributes('placeholder')).toBe('Имя участника')
      await input(w).setValue('бо')
      expect(options()).toEqual(['Боб'])
      await input(w).trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(w.find('[data-testid="chat-search-senders"]').exists()).toBe(false)
      expect(w.get('[data-testid="chat-search-sender-chip"]').text()).toContain('От: Боб')
      expect((input(w).element as HTMLInputElement).value).toBe('')
      expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 2')
      expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBe('$3')

      // Со словами — только его сообщения с ними.
      await search(w, 'привет')
      expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 1')
      expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBe('$1')

      await search(w, '')
      await input(w).trigger('keydown', { key: 'Backspace' })
      expect(w.find('[data-testid="chat-search-sender-chip"]').exists()).toBe(false)
      expect(w.find('[data-testid="chat-search-count"]').exists()).toBe(false)
    })

    it('стрелки двигают выбор в списке, Esc закрывает список, не сбрасывая поиск', async () => {
      const w = open('!g:host', { messages: GROUP })
      await search(w, 'привет')
      await w.find('[data-testid="chat-search-sender"]').trigger('click')
      await input(w).trigger('keydown', { key: 'ArrowDown' })
      expect(input(w).attributes('aria-activedescendant')).toMatch(/-1$/)
      await input(w).trigger('keydown', { key: 'Escape' })
      expect(w.find('[data-testid="chat-search-senders"]').exists()).toBe(false)
      expect((input(w).element as HTMLInputElement).value).toBe('привет')
      expect(w.find('[data-testid="chat-search-count"]').text()).toBe('1 из 2')
    })

    it('щелчок по участнику и × у него', async () => {
      const w = open('!g:host', { messages: GROUP })
      await w.find('[data-testid="chat-search-sender"]').trigger('click')
      await w.findAll('[data-testid="chat-search-sender-option"]')[1]!.trigger('click')
      expect(w.get('[data-testid="chat-search-sender-chip"]').text()).toContain('Ева')
      expect(w.findComponent({ name: 'MessageList' }).props('focusId')).toBe('$2')
      await w.find('[data-testid="chat-search-sender-clear"]').trigger('click')
      expect(w.find('[data-testid="chat-search-sender-chip"]').exists()).toBe(false)
    })
  })
})

describe('переходы по ленте', () => {
  const SEPT = new Date(2026, 8, 1).getTime()
  const FEED: Message[] = [
    { ...MESSAGE, id: '$5', text: 'Летим в июле', timestamp: SEPT + 5 },
    { ...MESSAGE, id: '$6', text: 'Отлично', timestamp: SEPT + 6, replyTo: { id: '$1' } },
  ]
  const list = (w: VueWrapper) => w.findComponent({ name: 'MessageList' })

  beforeEach(() => {
    mocks.revealMessage.mockReset()
    mocks.revealDate.mockReset()
    mocks.messageTime.mockReset()
    mocks.toast.mockReset()
  })

  it('цитата ответа ведёт ленту к исходному: время, догрузка, «Ищу исходное сообщение…» со «Стоп»', async () => {
    let found: (ok: boolean) => void = () => {}
    mocks.messageTime.mockResolvedValue(SEPT - 1000)
    mocks.revealMessage.mockImplementation(() => new Promise((r) => (found = r)))
    const w = open('!a:host', { messages: FEED })
    expect(list(w).props('quoteLinks')).toBe(true)
    list(w).vm.$emit('open-reply', FEED[1])
    await flushPromises()
    expect(mocks.messageTime).toHaveBeenCalledWith('!a:host', '$1')
    expect(mocks.revealMessage).toHaveBeenCalledWith(
      '!a:host',
      { id: '$1', timestamp: SEPT - 1000 },
      expect.any(Function)
    )
    expect(w.get('[data-testid="chat-search-status"]').text()).toContain('Ищу исходное сообщение…')
    await w.get('[data-testid="chat-search-action"]').trigger('click')
    expect(w.find('[data-testid="chat-search-status"]').exists()).toBe(false)
    found(false)
    await flushPromises()
    // Остановили — молча, без «не найдено».
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('исходного нет нигде — так и говорим', async () => {
    mocks.messageTime.mockResolvedValue(null)
    mocks.revealMessage.mockResolvedValue(false)
    const w = open('!a:host', { messages: FEED })
    list(w).vm.$emit('open-reply', FEED[1])
    await flushPromises()
    expect(mocks.toast).toHaveBeenCalledWith({
      message: 'Исходное сообщение не найдено — возможно, сервер его уже стёр',
    })
  })

  it('календарь: день раньше ленты — догрузка до него, «Перехожу к …» со «Стоп»', async () => {
    mocks.revealDate.mockImplementation(() => new Promise(() => {}))
    const w = open('!a:host', { messages: FEED })
    const day = w.get('[data-testid="chat-date-jump"]')
    expect(day.attributes('aria-label')).toBe('Перейти к дате')
    ;(day.element as HTMLInputElement).value = '2026-08-12'
    await day.trigger('change')
    await flushPromises()
    expect(mocks.revealDate).toHaveBeenCalledWith(
      '!a:host',
      new Date(2026, 7, 12).getTime(),
      expect.any(Function)
    )
    expect(w.get('[data-testid="chat-search-status"]').text()).toContain(
      'Перехожу к 12 августа 2026'
    )
    await w.get('[data-testid="chat-search-action"]').trigger('click')
    expect(w.find('[data-testid="chat-search-status"]').exists()).toBe(false)
  })

  it('день в ленте (и до него есть сообщения) — без догрузки', async () => {
    const before = { ...MESSAGE, id: '$4', timestamp: new Date(2026, 7, 30).getTime() }
    const w = open('!a:host', { messages: [before, ...FEED] })
    const day = w.get('[data-testid="chat-date-jump"]')
    ;(day.element as HTMLInputElement).value = '2026-09-01'
    await day.trigger('change')
    await flushPromises()
    expect(mocks.revealDate).not.toHaveBeenCalled()
  })
})
