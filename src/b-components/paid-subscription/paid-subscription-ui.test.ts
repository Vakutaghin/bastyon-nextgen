// Оформление подписки глазами читателя: плашка на закрытом посте, окно со
// сроками и суммами, оплата. Сеть и транзакции подменены, сторы настоящие.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string },
  subscribed: new Set<string>(),
  subscribe: vi.fn(),
  payments: [] as unknown[],
  price: 10,
  pay: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  balance: 1000,
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@mobile/utils/platform', () => ({ getPlatform: () => 'web' }))
vi.mock('@/stores/user-relations-store', () => ({
  useUserRelationsStore: () => ({
    isSubscribed: (a: string) => mocks.subscribed.has(a),
    isSubscribePending: () => false,
    subscribe: mocks.subscribe,
  }),
}))
vi.mock('@/helpers/paid-subscription/payments-api', () => ({
  fetchSubscriptionPayments: async () => mocks.payments,
}))
vi.mock('@/helpers/api/account-settings', async (original) => ({
  ...(await original<typeof import('@/helpers/api/account-settings')>()),
  fetchAccountSettings: async () => ({ paidsubscription: mocks.price }),
}))
vi.mock('@/blockchain/core/actions/paid-subscription-action', () => ({
  payForSubscription: mocks.pay,
}))
vi.mock('@/blockchain/core/transactions/unspents-manager', () => ({
  getUnspents: async () => [{ amount: mocks.balance }],
  filterAvailableUnspents: (list: unknown[]) => list,
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: mocks.toast }))
vi.mock('@/composables/use-auth-gate', () => ({ requireAuth: (action: () => void) => action() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/user-names', () => ({
  userName: () => 'Алиса',
  userAvatar: () => null,
}))

import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import PaidPostNotice from './paid-post-notice.vue'
import PaidProfileButton from './paid-profile-button.vue'
import PaidSubscriptionModal from './paid-subscription-modal.vue'

let mounted: VueWrapper[] = []

function mountIt<T>(component: T, props: Record<string, unknown> = {}): VueWrapper {
  const w = mount(component as never, {
    props: props as never,
    global: { plugins: [i18n], provide: { theme: {} } },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

/** Модалка antd рендерится в body, а не внутри обёртки. */
const body = () => document.body
const buttons = () => [...body().querySelectorAll('button')]
const button = (text: string) => buttons().find((b) => b.textContent?.includes(text))

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  setActivePinia(createPinia())
  // Отправленный платёж стор помнит между запусками — между тестами не должен.
  localStorage.clear()
  vi.clearAllMocks()
  mocks.auth.getUserAddress = 'PMe'
  mocks.subscribed = new Set(['PAuthor'])
  mocks.payments = []
  mocks.price = 10
  mocks.balance = 1000
  mocks.pay.mockResolvedValue('tx-paid')
})

afterEach(() => {
  mounted.forEach((w) => w.unmount())
  mounted = []
  document.body.innerHTML = ''
})

describe('плашка на посте для платных подписчиков', () => {
  it('сначала проверяет, потом предлагает оформить с ценой — кнопка открывает окно', async () => {
    const w = mountIt(PaidPostNotice, { author: 'PAuthor' })
    expect(w.text()).toContain('Проверяю платную подписку')
    await flushPromises()
    expect(w.text()).toContain('Пост для платных подписчиков автора.')
    await w.get('button').trigger('click')
    expect(usePaidSubscriptionsStore().modal).toMatchObject({ open: true, author: 'PAuthor' })
    // Сумма — второй строкой кнопки.
    const label = w.get('button').findAll('span')
    expect(label.map((n) => n.text())).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Оформить/), '10 PKOIN/мес'])
    )
  })

  it('оплачено, но не подписан — «Подписаться»', async () => {
    mocks.subscribed.clear()
    mocks.payments = [
      {
        from: 'PMe',
        to: 'PAuthor',
        txid: 't',
        height: 1,
        amount: 10e8,
        time: Math.floor(Date.now() / 1000) - 60,
      },
    ]
    const w = mountIt(PaidPostNotice, { author: 'PAuthor' })
    await flushPromises()
    expect(w.text()).toContain('осталось подписаться')
    await w.get('button').trigger('click')
    expect(mocks.subscribe).toHaveBeenCalledWith('PAuthor')
  })

  it('автор цену не назначал — без кнопки', async () => {
    mocks.price = 0
    const w = mountIt(PaidPostNotice, { author: 'PAuthor' })
    await flushPromises()
    expect(w.text()).toContain('автор сейчас не принимает подписки')
    expect(w.find('button').exists()).toBe(false)
  })
})

describe('окно оформления', () => {
  async function openModal() {
    mountIt(PaidSubscriptionModal)
    usePaidSubscriptionsStore().openModal('PAuthor')
    await flushPromises()
  }

  it('три срока с суммами и датой; выбор срока меняет сумму оплаты', async () => {
    await openModal()
    const options = [...body().querySelectorAll('[role="radio"]')]
    expect(options.map((o) => o.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringMatching(/^1 месяц\s*до .+10 PKOIN$/),
      expect.stringMatching(/^6 месяцев\s*выгода 8 %\s*до .+55 PKOIN$/),
      expect.stringMatching(/^Год\s*выгода 17 %\s*до .+100 PKOIN$/),
    ])
    expect(button('Оплатить 10 PKOIN')).toBeTruthy()
    ;(options[1] as HTMLElement).click()
    await flushPromises()
    expect(button('Оплатить 55 PKOIN')).toBeTruthy()
  })

  const confirmBox = () =>
    body().querySelector<HTMLInputElement>('.ant-checkbox-input') ?? undefined

  it('без галочки подтверждения оплатить нельзя; смена срока галочку снимает', async () => {
    await openModal()
    expect(body().textContent).toContain(
      'Подтверждаю перевод 10 PKOIN автору Алиса. Отменить или вернуть платёж нельзя.'
    )
    const pay = () => button('Оплатить') as HTMLButtonElement
    expect(pay().disabled).toBe(true)
    pay().click()
    await flushPromises()
    expect(mocks.pay).not.toHaveBeenCalled()

    confirmBox()!.click()
    await flushPromises()
    expect(pay().disabled).toBe(false)
    ;(body().querySelectorAll('[role="radio"]')[1] as HTMLElement).click()
    await flushPromises()
    expect(body().textContent).toContain('Подтверждаю перевод 55 PKOIN')
    expect(pay().disabled).toBe(true)
  })

  it('оплата: перевод на сумму срока, сообщение и окно закрывается', async () => {
    await openModal()
    confirmBox()!.click()
    await flushPromises()
    button('Оплатить 10 PKOIN')!.click()
    await flushPromises()
    expect(mocks.pay).toHaveBeenCalledWith('PAuthor', 10e8)
    expect(mocks.toast.success).toHaveBeenCalled()
    expect(usePaidSubscriptionsStore().modal.open).toBe(false)
  })

  it('не хватает денег — оплатить нельзя; не подписан — предупреждает', async () => {
    mocks.balance = 5
    mocks.subscribed.clear()
    await openModal()
    expect(body().textContent).toContain('не хватает PKOIN')
    expect(body().textContent).toContain('Вы ещё не подписаны на автора')
    expect((button('Оплатить 10 PKOIN') as HTMLButtonElement).disabled).toBe(true)
  })

  it('уже оплачено — видно до какого числа', async () => {
    mocks.payments = [
      {
        from: 'PMe',
        to: 'PAuthor',
        txid: 't',
        height: 1,
        amount: 100e8,
        time: Math.floor(Date.now() / 1000) - 86400,
      },
    ]
    await openModal()
    expect(body().textContent).toContain('Оплачено до')
  })
})

describe('кнопка на странице автора', () => {
  const lines = (w: VueWrapper) =>
    w
      .get('button')
      .findAll('span')
      .map((n) => n.text())

  it('цена — второй строкой под названием', async () => {
    const w = mountIt(PaidProfileButton, { address: 'PAuthor' })
    await flushPromises()
    expect(lines(w)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Платная подписка/), '10 PKOIN/мес'])
    )
  })

  it('уже оплачено — второй строкой срок', async () => {
    mocks.payments = [
      {
        from: 'PMe',
        to: 'PAuthor',
        txid: 't',
        height: 1,
        amount: 10e8,
        time: Math.floor(Date.now() / 1000) - 60,
      },
    ]
    const w = mountIt(PaidProfileButton, { address: 'PAuthor' })
    await flushPromises()
    expect(lines(w)).toEqual(expect.arrayContaining([expect.stringMatching(/^до /)]))
  })

  it('на своём профиле кнопки нет: подписаться на себя нельзя', async () => {
    const w = mountIt(PaidProfileButton, { address: 'PMe' })
    await flushPromises()
    expect(w.find('button').exists()).toBe(false)
  })
})
