import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '@/i18n'

// vi.mock поднимается выше импортов, поэтому фикстуры — через vi.hoisted с
// собственным импортом vue внутри.
const balances = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    loading: ref(false),
    error: ref<string | null>(null),
    addingWallet: ref(false),
    currentAddress: ref('PMAIN'),
    allAddresses: ref(['PMAIN', 'PEXTRA']),
    canAddWallet: ref(true),
    accountBalance: ref(12.5),
    sumWalletsBalance: ref(1),
    totalBalance: ref(13.5),
    hasAddresses: ref(true),
    mainTableRows: ref([{ address: 'PMAIN', balance: 12.5 }]),
    additionalTableRows: ref([{ address: 'PEXTRA', balance: 1, label: 'Fund' }]),
    formatBalance: (b: number | null) => (b == null ? '—' : `${b} PKOIN`),
    loadBalances: vi.fn(),
    onAddWallet: vi.fn(),
    initBalances: vi.fn(),
    renameOpen: ref(false),
    renameLabel: ref(''),
    openRename: vi.fn(),
    closeRename: vi.fn(),
    saveRename: vi.fn(),
  }
})
const auth = vi.hoisted(() => ({ isUserAuthenticated: true }))

vi.mock('./use-wallet-balances', () => ({ useWalletBalances: () => balances }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => auth }))

import WalletBalances from './wallet-balances.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/explorer/address/:address',
      name: 'explorer-address',
      component: { template: '<div />' },
    },
  ],
})

// Все смонтированные экземпляры делят одну фикстуру — размонтируем после
// каждого теста, иначе их watch'и срабатывают в чужих проверках.
const mounted: Array<{ unmount: () => void }> = []
const mountTab = () => {
  const w = mount(WalletBalances, { global: { plugins: [i18n, router] } })
  mounted.push(w)
  return w
}
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.clearAllMocks()
})

describe('wallet-balances.vue', () => {
  it('рендерит суммы и обе таблицы, на mount запускает initBalances', () => {
    const w = mountTab()
    expect(balances.initBalances).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('12.5 PKOIN')
    expect(w.text()).toContain('13.5 PKOIN')
    expect(w.text()).toContain('PMAIN')
    expect(w.text()).toContain('PEXTRA')
    expect(w.text()).toContain('Fund')
    expect(w.findAll('a[href="/explorer/address/PMAIN"]').length).toBe(1)
  })

  it('кнопка переименования открывает rename с адресом и ярлыком', async () => {
    const w = mountTab()
    await w.find(`button[title="${i18n.global.t('wallet.renameWallet')}"]`).trigger('click')
    expect(balances.openRename).toHaveBeenCalledWith('PEXTRA', 'Fund')
  })

  it('перезагружает балансы при смене адреса только для авторизованного', async () => {
    mountTab()
    balances.loadBalances.mockClear()
    balances.currentAddress.value = 'POTHER'
    await Promise.resolve()
    expect(balances.loadBalances).toHaveBeenCalledTimes(1)

    auth.isUserAuthenticated = false
    balances.currentAddress.value = 'PAGAIN'
    await Promise.resolve()
    expect(balances.loadBalances).toHaveBeenCalledTimes(1)
  })

  it('состояния загрузки и ошибки заменяют таблицы', async () => {
    const w = mountTab()
    balances.error.value = 'boom'
    await w.vm.$nextTick()
    expect(w.text()).toContain('boom')
    expect(w.text()).not.toContain('PEXTRA')
    balances.error.value = null
    balances.loading.value = true
    balances.hasAddresses.value = false
    await w.vm.$nextTick()
    expect(w.text()).toContain(i18n.global.t('wallet.loading'))
  })
})
