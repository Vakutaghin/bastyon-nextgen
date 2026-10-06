// Кнопка «Сведения о приложении» в чате с поддержкой: окно показывает ровно
// то, что уйдёт, а «Отправить» шлёт это в чат — частями по порядку, если в
// одно сообщение не влезло. Сбор сведений и отправка подменены, окно настоящее.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  collect: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => ({ sendMessage: mocks.sendMessage }) }))
vi.mock('../../lib/support-report-data', () => ({
  collectSupportReport: mocks.collect,
  reportJson: (data: unknown) => JSON.stringify(data, null, 2),
}))

import { MAX_REPORT_MESSAGE_BYTES, parseSupportReport } from '../../lib/support-report'
import SupportReportBar from './support-report-bar.vue'

let wrapper: VueWrapper | null = null

const body = (): string => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const button = (text: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.replace(/\s+/g, ' ').trim() === text
  )

async function openConsent(): Promise<void> {
  wrapper = mount(SupportReportBar, {
    props: { chatId: '!support:host' },
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  await wrapper.find('button').trigger('click')
  await flushPromises()
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mocks.sendMessage.mockResolvedValue(undefined)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('сведения о приложении для поддержки', () => {
  it('окно говорит, что уйдёт и чего не будет, и показывает сами сведения', async () => {
    mocks.collect.mockResolvedValue({ app: { version: '0.9.5' } })
    await openConsent()
    expect(body()).toContain('Отправить сведения о приложении?')
    expect(body()).toContain('фраза восстановления')
    expect(body()).toContain('"version": "0.9.5"')
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('«Отправить» шлёт в этот чат то, что было показано', async () => {
    mocks.collect.mockResolvedValue({ app: { version: '0.9.5' } })
    await openConsent()
    button('Отправить')!.click()
    await flushPromises()

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text] = mocks.sendMessage.mock.calls[0] as [string, string]
    expect(chatId).toBe('!support:host')
    expect(text.split('\n')[0]).toBe('Сведения о приложении для поддержки')
    expect(JSON.parse(parseSupportReport(text)!.body)).toEqual({ app: { version: '0.9.5' } })
  })

  it('не влезло в одно сообщение — уходит частями, по порядку', async () => {
    const errors = Array.from({ length: 60 }, (_, i) => ({ message: `ошибка ${i} `.repeat(20) }))
    mocks.collect.mockResolvedValue({ errors })
    await openConsent()
    expect(body()).toContain('Что именно уйдёт (сообщений: 3)')
    button('Отправить')!.click()
    await flushPromises()

    const texts = mocks.sendMessage.mock.calls.map((c) => c[1] as string)
    expect(texts).toHaveLength(3)
    const parts = texts.map((t) => parseSupportReport(t)!)
    expect(parts.map((p) => `${p.part}/${p.total}`)).toEqual(['1/3', '2/3', '3/3'])
    expect(new Set(parts.map((p) => p.id)).size).toBe(1)
    for (const t of texts)
      expect(new TextEncoder().encode(t).length).toBeLessThanOrEqual(MAX_REPORT_MESSAGE_BYTES)
    expect(JSON.parse(parts.map((p) => p.body).join('\n'))).toEqual({ errors })
  })

  it('«Отмена» ничего не отправляет', async () => {
    mocks.collect.mockResolvedValue({ app: {} })
    await openConsent()
    button('Отмена')!.click()
    await flushPromises()
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })
})
