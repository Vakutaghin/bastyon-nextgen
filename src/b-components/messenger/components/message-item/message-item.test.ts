// Сведения о приложении для поддержки в переписке: с первой же отрисовки —
// окошко с JSON, а не длинный текст, который потом превращается в окошко.
// Стор мессенджера и роутер подменены.

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ store: null as unknown as Record<string, unknown> }))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { buildReportMessages } from '../../lib/support-report'
import type { Message } from '../../types'
import MessageItem from './message-item.vue'

const JSON_TEXT = JSON.stringify({ app: { version: '0.9.5', platform: 'desktop' } }, null, 2)

function message(text: string): Message {
  return {
    id: '$1',
    chatId: '!support:host',
    senderId: '@alice:host',
    text,
    timestamp: Date.now(),
    read: true,
    status: 'read',
  }
}

function render(text: string) {
  return mount(MessageItem, {
    props: { message: message(text) },
    global: { plugins: [i18n], provide: { theme: {} }, stubs: { LinkPreview: true } },
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
