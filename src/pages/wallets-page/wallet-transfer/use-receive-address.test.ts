// Р2 (V6): доп. кошельки — P2SH, а подписать P2SH-вход этот клиент не умеет,
// поэтому приём предлагается только на основной адрес.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const authState = { getUserAddress: 'PMain' as string | null }

vi.mock('@/blockchain', () => ({
  useAuthStore: () => authState,
  getAdditionalWalletAddressesList: () => ['ZExtra1', 'ZExtra2'],
}))
vi.mock('@/blockchain/utils/qr-code', () => ({
  generateQRCode: vi.fn(async () => 'data:image/png;base64,qr'),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { useReceiveAddress } from './use-receive-address'

type Api = ReturnType<typeof useReceiveAddress>

function withComposable(): Api {
  let api: Api | null = null
  mount(
    defineComponent({
      setup() {
        api = useReceiveAddress()
        return () => h('div')
      },
    })
  )
  return api as unknown as Api
}

beforeEach(() => {
  authState.getUserAddress = 'PMain'
})

describe('useReceiveAddress (Р2 / V6)', () => {
  it('offers the main wallet only, even when extra wallets exist', () => {
    const api = withComposable()
    expect(api.receiveAddressOptions.value).toEqual([{ value: 'main', label: 'wallet.mainWallet' }])
    expect(api.selectedReceiveAddress.value).toBe('PMain')
  })

  it('has nothing to show for an anonymous visitor', () => {
    authState.getUserAddress = null
    const api = withComposable()
    expect(api.receiveAddressOptions.value).toEqual([])
    expect(api.selectedReceiveAddress.value).toBe('')
  })
})
