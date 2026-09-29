// «В эксплорере» у перевода в чате открывает страницу приложения, а не
// новое окно, которого в десктопе и на телефоне нет.

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '@/i18n'

const store = vi.hoisted(() => ({ isFullScreen: true, currentUser: { id: '@me:host' } }))
vi.mock('../../store', () => ({ useMessengerStore: () => store }))

import TransactionMessage from './transaction-message.vue'

const blank = { template: '<div />' }

describe('transaction-message', () => {
  it('«В эксплорере» закрывает полноэкранный чат и открывает транзакцию', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: blank },
        { path: '/explorer/tx/:txid', name: 'explorer-tx', component: blank },
      ],
    })
    await router.push('/')
    const wrapper = mount(TransactionMessage, {
      props: {
        message: {
          id: '$e',
          senderId: '@me:host',
          info: { transaction: { txid: 'abc123', amount: 1.5, from: 'PA', to: 'PB' } },
        } as never,
      },
      global: { plugins: [router, i18n] },
    })
    await wrapper.find('a').trigger('click')
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(store.isFullScreen).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/explorer/tx/abc123')
  })
})
