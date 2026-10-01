// Окно продвижения: сумма от 2,5 PKOIN и не больше доступного, прогноз по
// бустам ленты языка поста, подстановка суммы до 100 %, отправка и ошибки
// сети. Окно настоящее; баланс, лента бустов и отправка подменены.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  fetchBoostFeed: vi.fn(),
  boostPost: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  triggerCoins: vi.fn(),
}))

vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getUserAddress: 'PMe' }),
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: async () => [{ txid: 'aa', vout: 0, amount: 12 }],
  filterAvailableUnspents: (list: unknown[]) => list,
}))
vi.mock('@/services/boost-feed', () => ({ fetchBoostFeed: mocks.fetchBoostFeed }))
vi.mock('@/blockchain/core/actions/boost-action', () => ({ boostPost: mocks.boostPost }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock('@/stores/effects-store', () => ({
  useEffectsStore: () => ({ triggerCoins: mocks.triggerCoins }),
}))

import BoostModal from './boost-modal.vue'
import { useBoostStore } from '@/stores/boost-store'

const POST = 'p'.repeat(64)
const PKOIN = 100_000_000
/** Лента языка: у двух других постов 30 PKOIN — 2,5 PKOIN дают 25 %. */
const FEED = [
  { txid: 'a'.repeat(64), boost: 20 * PKOIN },
  { txid: 'b'.repeat(64), boost: 10 * PKOIN },
]

let wrapper: VueWrapper | null = null

const body = (): string => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const buttons = (): HTMLButtonElement[] => [...document.body.querySelectorAll('button')]
const button = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === text)
const amountInput = (): HTMLInputElement =>
  document.body.querySelector('input[type="number"]') as HTMLInputElement

async function open(language = 'ru'): Promise<void> {
  wrapper = mount(BoostModal, { attachTo: document.body, global: { plugins: [i18n] } })
  useBoostStore().open({ postId: POST, language, preview: 'Вчера съездили на море' })
  await flushPromises()
  await flushPromises()
}

async function typeAmount(value: string): Promise<void> {
  const input = amountInput()
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('BoostModal', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchBoostFeed.mockResolvedValue(FEED)
    mocks.boostPost.mockResolvedValue('t'.repeat(64))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('показывает пост, доступные монеты и прогноз по ленте языка поста', async () => {
    await open()
    expect(mocks.fetchBoostFeed).toHaveBeenCalledWith('ru')
    expect(body()).toContain('Продвинуть пост')
    expect(body()).toContain('«Вчера съездили на море»')
    expect(body()).toContain('Доступно: 12 PKOIN')

    await button('2.5')!.click()
    await flushPromises()
    expect(body()).toMatch(/первые 30 постов ленты «Русский» примерно на сутки: 25\s?%/)

    // Подсказка до 100 % подставляет сумму.
    await button('Для 100 %: 10 PKOIN')!.click()
    await flushPromises()
    expect(amountInput().value).toBe('10')
    expect(body()).toMatch(/примерно на сутки: 100\s?%/)
    // Сумма уже даёт 100 % — подсказка больше не нужна.
    expect(button('Для 100 %: 10 PKOIN')).toBeUndefined()
  })

  it('уже набранный буст поста видно и он входит в прогноз', async () => {
    mocks.fetchBoostFeed.mockResolvedValue([...FEED, { txid: POST, boost: 4 * PKOIN }])
    await open()
    expect(body()).toContain('Сейчас у поста буст 4 PKOIN.')
    expect(body()).toContain('Для 100 %: 6 PKOIN')
  })

  it('меньше минимума и больше доступного — ошибка, кнопка не нажимается', async () => {
    await open()
    await typeAmount('1')
    expect(body()).toContain('Минимум 2.5 PKOIN')
    expect(button('Продвинуть')!.disabled).toBe(true)

    await typeAmount('20')
    expect(body()).toContain('Недостаточно средств')
    expect(body()).toContain('Как получить PKOIN')
    expect(button('Продвинуть')!.disabled).toBe(true)
  })

  it('продвигает пост на введённую сумму и закрывается', async () => {
    await open()
    await typeAmount('5')
    await button('Продвинуть')!.click()
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(mocks.boostPost).toHaveBeenCalledWith(POST, 5, 'Вчера съездили на море')
    expect(mocks.toastSuccess).toHaveBeenCalledWith({
      message: expect.stringContaining('Пост продвинут'),
    })
    expect(useBoostStore().isOpen).toBe(false)
  })

  it('отказ сети — причина в сообщении, окно остаётся', async () => {
    mocks.boostPost.mockRejectedValue(
      new Error('Нельзя: вы заблокировали этого человека или он вас.')
    )
    await open()
    await typeAmount('5')
    await button('Продвинуть')!.click()
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(mocks.toastError).toHaveBeenCalledWith({
      message: 'Нельзя: вы заблокировали этого человека или он вас.',
    })
    expect(useBoostStore().isOpen).toBe(true)
  })

  it('язык поста не из языков приложения — прогноза нет, ленту не спрашиваем', async () => {
    await open('uk')
    expect(mocks.fetchBoostFeed).not.toHaveBeenCalled()
    expect(body()).toContain('Для языка этого поста вероятность не посчитать.')
  })
})
