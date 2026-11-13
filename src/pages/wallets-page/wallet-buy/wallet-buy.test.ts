// Вкладка «Покупка/продажа»: свой адрес с QR и копированием, калькулятор по
// курсу из графика, биржи из конфига (внешние ссылки — через openExternal),
// PKOIN Exchange и объявления #pkoin_commerce, предупреждение о рисках,
// полезные ссылки на вкладки кошелька, обозреватель, лимиты и справку.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PBuyerAddress1111111111111111111111' as string | null },
  openTopic: vi.fn(),
  openExternal: vi.fn(async () => true),
  writeText: vi.fn(async () => {}),
  /** Курс, который «график» отдаёт при монтировании; null — курс не пришёл. */
  price: 0.139 as number | null,
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain/utils/qr-code', () => ({
  generateQRCode: vi.fn(async () => 'data:image/png;base64,QR'),
}))
vi.mock('@/stores/help-store', () => ({ useHelpStore: () => ({ openTopic: mocks.openTopic }) }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: mocks.openExternal }))
// График ходит в CoinGecko и рисует d3 — здесь он только сообщает курс.
vi.mock('../pkoin-chart/pkoin-chart.vue', async () => {
  const { defineComponent, h, onMounted } = await import('vue')
  return {
    default: defineComponent({
      emits: ['price'],
      setup(_, { emit }) {
        onMounted(() => {
          if (mocks.price !== null) emit('price', mocks.price)
        })
        return () => h('div', { 'data-testid': 'chart' })
      },
    }),
  }
})

import WalletBuy from './wallet-buy.vue'
import { PKOIN_EXCHANGES } from './pkoin-venues'

const Page = { template: '<div />' }
let router: Router
let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  wrapper = mount(WalletBuy, { global: { plugins: [i18n, router] } })
  await router.isReady()
  await flushPromises()
  return wrapper
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.auth = { getUserAddress: 'PBuyerAddress1111111111111111111111' }
  mocks.price = 0.139
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mocks.writeText },
    configurable: true,
  })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/wallets', name: 'wallets', component: Page },
      { path: '/limits', name: 'limits', component: Page },
      { path: '/explorer/address/:address', name: 'explorer-address', component: Page },
      { path: '/search', name: 'search', component: Page },
      { path: '/app/:appId/:innerPath(.*)?', name: 'mini-app', component: Page },
    ],
  })
  await router.push('/wallets?tab=buy')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('вкладка «Покупка/продажа»', () => {
  it('свой адрес — сразу, с QR-кодом и копированием', async () => {
    const w = await render()
    const card = w.get('[data-testid="buy-address"]')
    expect(card.get('[data-testid="buy-address-value"]').text()).toBe(
      'PBuyerAddress1111111111111111111111'
    )
    expect(card.get('img').attributes('src')).toBe('data:image/png;base64,QR')

    await card.get('[data-testid="buy-address-copy"]').trigger('click')
    await flushPromises()
    expect(mocks.writeText).toHaveBeenCalledWith('PBuyerAddress1111111111111111111111')
    expect(card.get('[data-testid="buy-address-copy"]').text()).toContain('Скопировано')
  })

  it('калькулятор считает по курсу в обе стороны', async () => {
    const w = await render()
    const pkoin = w.get<HTMLInputElement>('[data-testid="buy-calc-pkoin"]')
    const usd = w.get<HTMLInputElement>('[data-testid="buy-calc-usd"]')
    expect(pkoin.element.value).toBe('100')
    expect(usd.element.value).toBe('13.9')

    await usd.setValue('27,8')
    expect(pkoin.element.value).toBe('200')

    await pkoin.setValue('abc')
    expect(usd.element.value).toBe('')
    expect(w.get('[data-testid="buy-calc"]').text()).toContain('У продавцов курс свой')
  })

  it('без курса калькулятора нет, остальное на месте', async () => {
    mocks.price = null
    const w = await render()
    expect(w.find('[data-testid="buy-calc"]').exists()).toBe(false)
    expect(w.find('[data-testid="buy-address"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="buy-exchange"]')).toHaveLength(PKOIN_EXCHANGES.length)
  })

  it('биржи из конфига открываются снаружи приложения', async () => {
    const w = await render()
    const cards = w.findAll('[data-testid="buy-exchange"]')
    expect(cards.map((c) => c.text())).toEqual([
      expect.stringContaining('Tapbit'),
      expect.stringContaining('DigiFinex'),
    ])
    expect(cards[0]!.text()).toContain('PKOIN/USDT')
    expect(cards[0]!.attributes('href')).toBe(PKOIN_EXCHANGES[0]!.url)

    await cards[1]!.trigger('click')
    expect(mocks.openExternal).toHaveBeenCalledWith(PKOIN_EXCHANGES[1]!.url)
    expect(w.get('[data-testid="buy-exchanges"]').text()).toContain('Оборот на биржах маленький')
  })

  it('у продавцов: PKOIN Exchange, объявления #pkoin_commerce и предупреждение', async () => {
    const w = await render()
    const exchange = w.get('[data-testid="buy-p2p-exchange"]')
    expect(exchange.text()).toContain('PKOIN Exchange')
    expect(exchange.attributes('href')).toBe('/app/p2p.pkoin.app')

    const commerce = w.get('[data-testid="buy-p2p-commerce"]')
    expect(commerce.text()).toContain('#pkoin_commerce')
    await commerce.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({ q: '#pkoin_commerce', type: 'posts' })

    const risk = w.get('[data-testid="buy-risk"]')
    expect(risk.attributes('role')).toBe('note')
    expect(risk.text()).toContain('Сделки из рук в руки сеть не гарантирует')
    expect(risk.text()).toContain('необратимы')
  })

  it('полезное: вкладки кошелька, обозреватель, лимиты и справка', async () => {
    const w = await render()
    const hrefs = w
      .get('[data-testid="buy-tools"]')
      .findAll('a')
      .map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/wallets?tab=transfers',
      '/wallets?tab=history',
      '/explorer/address/PBuyerAddress1111111111111111111111',
      '/wallets?tab=earnings',
      '/limits',
    ])
    await w.get('[data-testid="buy-tools"] [data-help-link]').trigger('click')
    expect(mocks.openTopic).toHaveBeenCalledWith('how-to-buy-pkoin')
  })

  it('без адреса нет ни карточки адреса, ни ссылки в обозреватель', async () => {
    mocks.auth = { getUserAddress: null }
    const w = await render()
    expect(w.find('[data-testid="buy-address"]').exists()).toBe(false)
    expect(w.find('a[href^="/explorer/address/"]').exists()).toBe(false)
  })
})
