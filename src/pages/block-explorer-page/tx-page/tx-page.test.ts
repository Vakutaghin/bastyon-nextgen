import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/i18n'
import TxPage from './tx-page.vue'

// Мокаем доменный composable — проверяем шаблон + проводку пропсов в
// tx-summary-card / tx-io-table, не трогая сеть.
const mockState = vi.hoisted(() => ({ data: null as unknown as Record<string, unknown> }))
vi.mock('./use-tx-data', () => ({ useTxData: () => mockState.data }))

globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

const blank = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/explorer', name: 'explorer', component: blank },
    { path: '/explorer/block/:hashOrHeight', name: 'explorer-block', component: blank },
    { path: '/explorer/tx/:txid', name: 'explorer-tx', component: blank },
    { path: '/explorer/address/:address', name: 'explorer-address', component: blank },
    { path: '/:userName', name: 'profile', component: blank },
  ],
})

function txData(over: Record<string, unknown> = {}) {
  return {
    tx: ref({
      txid: 'txMAIN_SENTINEL',
      type: 204,
      blockHash: 'blockHASH',
      height: 456,
      nTime: 1700000000,
      vin: [{ address: 'PvinAddr', value: 1000000000, txid: 'prevtx', vout: 0 }],
      vout: [{ value: 900000000, n: 0, scriptPubKey: { addresses: ['PvoutAddr'] } }],
    }),
    txLoading: ref(false),
    txError: ref(null as unknown),
    confirmations: ref(12),
    typeLabel: ref('TYPE_SENTINEL'),
    totalIn: ref(1000000000),
    totalOut: ref(900000000),
    feeLabel: ref('0.001'),
    pocketPayload: ref(null),
    payloadKindLabel: ref(''),
    errorMessage: ref(''),
    rawJson: ref('{"raw":true}'),
    showRaw: ref(false),
    now: ref(1700000000),
    firstAddress: () => '',
    ...over,
  }
}

function mountPage() {
  return mount(TxPage, {
    props: { txid: 'txMAIN_SENTINEL' },
    global: {
      plugins: [i18n, router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      stubs: { InfoTooltip: true },
    },
  })
}

beforeEach(() => {
  mockState.data = txData()
})

describe('tx-page (decomposed)', () => {
  it('renders summary card and IO table from the composable', () => {
    const text = mountPage().text()
    expect(text).toContain('txMAIN_SENTINEL') // txid (HashLink full)
    expect(text).toContain('TYPE_SENTINEL') // тип транзакции
    expect(text).toContain('#456') // высота блока в summary
    expect(text).toContain('PvinAddr') // адрес входа (io-table)
    expect(text).toContain('PvoutAddr') // адрес выхода (io-table)
  })

  it('renders the error component when tx is missing', () => {
    mockState.data = txData({ tx: ref(undefined), errorMessage: ref('TXERR_SENTINEL') })
    const text = mountPage().text()
    expect(text).toContain('TXERR_SENTINEL')
    expect(text).not.toContain('PvinAddr') // io-table не рендерится без tx
  })
})
