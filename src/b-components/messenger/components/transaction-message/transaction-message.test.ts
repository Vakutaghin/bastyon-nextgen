// «В блокчейне» у перевода в чате открывает модалку поверх переписки: чат
// остаётся на месте. Уход из модалки на страницу приложения закрывает и
// полноэкранный чат — иначе он перекрыл бы страницу.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useChainInfoStore } from '@/stores/chain-info-store'

const store = vi.hoisted(() => ({ isFullScreen: true, currentUser: { id: '@me:host' } }))
vi.mock('../../store', () => ({ useMessengerStore: () => store }))

import TransactionMessage from './transaction-message.vue'

describe('transaction-message', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store.isFullScreen = true
  })

  it('«В блокчейне» открывает перевод в модалке, чат остаётся', async () => {
    const wrapper = mount(TransactionMessage, {
      props: {
        message: {
          id: '$e',
          senderId: '@me:host',
          info: { transaction: { txid: 'abc123', amount: 1.5, from: 'PA', to: 'PB' } },
        } as never,
      },
      global: { plugins: [i18n] },
    })
    const link = wrapper.find('a')
    expect(link.text()).toBe(i18n.global.t('chainInfo.action'))
    expect(link.attributes('href')).toBe('/explorer/tx/abc123')

    await link.trigger('click')
    const chainInfo = useChainInfoStore()
    expect(chainInfo.current).toEqual({ kind: 'tx', txid: 'abc123' })
    expect(store.isFullScreen).toBe(true)

    // Из модалки ушли в эксплорер — чат закрывается.
    chainInfo.leave()
    expect(chainInfo.isOpen).toBe(false)
    expect(store.isFullScreen).toBe(false)
  })
})
