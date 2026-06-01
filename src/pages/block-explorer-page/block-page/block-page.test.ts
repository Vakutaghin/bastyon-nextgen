import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/i18n'
import BlockPage from './block-page.vue'

// Мокаем доменный composable — тест проверяет шаблон страницы и проводку пропсов
// в под-компоненты (block-nav / block-meta-grid / block-tx-list), а не сеть.
const mockState = vi.hoisted(() => ({ data: null as unknown as Record<string, unknown> }))
vi.mock('./use-block-data', () => ({ useBlockData: () => mockState.data }))

// ant-design Tooltip тянет ResizeObserver, которого нет в happy-dom — полифилл +
// стаб самого InfoTooltip, чтобы не разворачивать ant-internals.
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

function blockData(over: Record<string, unknown> = {}) {
  return {
    block: ref({
      hash: 'b10ckhashAAA0000',
      height: 123,
      time: 1700000000,
      nTx: 2,
      bits: '1a2b3c',
      difficulty: 1234.5,
      merkleroot: 'merkleROOT123',
      prevhash: 'prevHASH',
      nexthash: 'nextHASH',
    }),
    blockLoading: ref(false),
    blockError: ref(null as unknown),
    blockErrorMessage: ref(''),
    txList: ref([{ txid: 'txAAA111', type: 3, vin: [], vout: [{ value: 5000000000 }] }]),
    txLoading: ref(false),
    txFetching: ref(false),
    txError: ref(null as unknown),
    canLoadMoreTx: ref(false),
    loadMoreTx: () => {},
    pagerLabel: ref('PAGER_SENTINEL'),
    loadMoreLabel: ref('LOAD_MORE'),
    confirmations: ref(7),
    coinstakeInfo: ref({ staker: 'PstakerXYZ', reward: 5000000000, kind: 'pos' as const }),
    coinstakeLabel: ref('STAKER_LABEL'),
    prevHash: ref('prevHASH'),
    nextHash: ref('nextHASH'),
    heightLabel: ref('#123'),
    difficultyLabel: ref('1,234.5'),
    goTo: () => {},
    now: ref(1700000000),
    ...over,
  }
}

function mountPage() {
  return mount(BlockPage, {
    props: { hashOrHeight: '123' },
    global: {
      plugins: [i18n, router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      stubs: { InfoTooltip: true },
    },
  })
}

beforeEach(() => {
  mockState.data = blockData()
})

describe('block-page (decomposed)', () => {
  it('renders height, meta grid and tx list from the composable', () => {
    const text = mountPage().text()
    expect(text).toContain('#123') // заголовок + meta height
    expect(text).toContain('STAKER_LABEL') // лейбл стейкера из meta-grid
    expect(text).toContain('PstakerXYZ') // адрес стейкера (AddressLink)
    expect(text).toContain('PAGER_SENTINEL') // пагинатор из tx-list
    expect(text).toContain('txAAA111') // txid строки транзакции
  })

  it('renders the error component instead of the grid on block error', () => {
    mockState.data = blockData({
      block: ref(undefined),
      blockError: ref(new Error('down')),
      blockErrorMessage: ref('ERR_SENTINEL'),
    })
    const text = mountPage().text()
    expect(text).toContain('ERR_SENTINEL')
    expect(text).not.toContain('txAAA111') // tx-list не рендерится без блока
  })
})
