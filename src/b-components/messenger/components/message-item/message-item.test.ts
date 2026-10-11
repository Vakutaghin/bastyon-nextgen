// Сведения о приложении для поддержки в переписке: с первой же отрисовки —
// окошко с JSON, а не длинный текст, который потом превращается в окошко.
// Аватар отправителя ведёт в его профиль. Стор мессенджера подменён.

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ store: null as unknown as Record<string, unknown> }))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => ({ push: vi.fn() }),
}))

import { buildReportMessages } from '../../lib/support-report'
import { addressToHex } from '../../services/matrix-service/address-codec'
import type { Message } from '../../types'
import MessageItem from './message-item.vue'

const JSON_TEXT = JSON.stringify({ app: { version: '0.9.5', platform: 'desktop' } }, null, 2)

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'

function message(text: string, senderId = '@alice:host'): Message {
  return {
    id: '$1',
    chatId: '!support:host',
    senderId,
    text,
    timestamp: Date.now(),
    read: true,
    status: 'read',
  }
}

function render(text: string, senderId?: string) {
  const page = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page },
      { path: '/:userName', name: 'profile', component: page },
    ],
  })
  return mount(MessageItem, {
    props: { message: message(text, senderId) },
    global: { plugins: [i18n, router], provide: { theme: {} }, stubs: { LinkPreview: true } },
  })
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.store = reactive({
    currentUser: { id: 'me', name: 'Я' },
    userProfiles: {},
    messages: {},
    activeChatId: '!support:host',
    isFullScreen: true,
    fetchProfiles: vi.fn(),
  })
})

describe('сведения для поддержки в переписке', () => {
  it('сразу окошко: моноширинный JSON, кнопка копирования, подписи-текста нет', () => {
    const [text] = buildReportMessages(JSON_TEXT, () => 'Сведения о приложении для поддержки')
    const w = render(text!)
    // Без ожиданий: так выглядит самый первый кадр.
    expect(w.find('.message-text').exists()).toBe(false)
    expect(w.find('pre').text()).toBe(JSON_TEXT)
    expect(w.find('button[aria-label="Скопировать"]').exists()).toBe(true)
    expect(w.text()).not.toContain('bastyon-report')
  })

  it('часть отчёта подписана номером', () => {
    const [, second] = buildReportMessages(
      Array.from({ length: 400 }, (_, i) => `"line ${i}": "${'x'.repeat(40)}"`).join('\n'),
      (part, total) => `Сведения (${part}/${total})`
    )
    expect(render(second!).text()).toContain('часть 2 из')
  })

  it('обычный текст остаётся текстом', () => {
    const w = render('Привет, у меня не работает голосовой ввод')
    expect(w.find('.message-text').text()).toContain('голосовой ввод')
    expect(w.find('pre').exists()).toBe(false)
  })
})

describe('аватар отправителя', () => {
  it('ведёт в профиль собеседника', () => {
    const w = render('Привет', `@${addressToHex(ALICE)}:matrix.pocketnet.app`)
    const link = w.get(`a[href="/${ALICE}"]`)
    expect(link.attributes('aria-label')).toMatch(/^Открыть профиль: /)
  })

  it('не из Bastyon — аватар без ссылки', () => {
    expect(render('Привет').find('a[aria-label^="Открыть профиль"]').exists()).toBe(false)
  })
})
