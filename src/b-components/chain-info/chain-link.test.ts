import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/i18n'
import HashLink from '@/pages/block-explorer-page/components/shared/hash-link.vue'
import { CHAIN_LINK_KEY, chainTargetForRoute, explorerRouteFor, isTxid } from './chain-link'

const TX = 'ab'.repeat(32)

describe('chain-link', () => {
  it('ссылки эксплорера на транзакцию и адрес — записи модалки, блок — нет', () => {
    expect(chainTargetForRoute({ name: 'explorer-tx', params: { txid: TX } })).toEqual({
      kind: 'tx',
      txid: TX,
    })
    expect(chainTargetForRoute({ name: 'explorer-address', params: { address: 'PA' } })).toEqual({
      kind: 'account',
      address: 'PA',
    })
    expect(chainTargetForRoute({ name: 'explorer-block', params: { hashOrHeight: '1' } })).toBe(
      null
    )
    expect(chainTargetForRoute('/explorer/tx/x')).toBe(null)
    expect(chainTargetForRoute(undefined)).toBe(null)
  })

  it('«Открыть в эксплорере»: пост и комментарий — их транзакции', () => {
    expect(explorerRouteFor({ kind: 'post', txid: TX })).toEqual({
      name: 'explorer-tx',
      params: { txid: TX },
    })
    expect(explorerRouteFor({ kind: 'comment', id: TX, postId: 'p' })).toEqual({
      name: 'explorer-tx',
      params: { txid: TX },
    })
    expect(explorerRouteFor({ kind: 'account', address: 'PA' })).toEqual({
      name: 'explorer-address',
      params: { address: 'PA' },
    })
  })

  it('isTxid: 64 hex, а не числовой id поста', () => {
    expect(isTxid(TX)).toBe(true)
    expect(isTxid('37708305')).toBe(false)
    expect(isTxid(undefined)).toBe(false)
  })
})

describe('hash-link в модалке', () => {
  async function setup(provide: Record<symbol, unknown>) {
    const blank = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: blank },
        { path: '/explorer/tx/:txid', name: 'explorer-tx', component: blank },
        { path: '/explorer/block/:hashOrHeight', name: 'explorer-block', component: blank },
      ],
    })
    await router.push('/')
    await router.isReady()
    const mountWith = (to: unknown) =>
      mount(HashLink, {
        props: { hash: TX, to: to as never, copyable: false },
        global: { plugins: [router, i18n, VueQueryPlugin], provide },
      })
    return { router, mountWith }
  }

  it('транзакция открывается в модалке, страница не меняется', async () => {
    const open = vi.fn()
    const { router, mountWith } = await setup({ [CHAIN_LINK_KEY as symbol]: open })
    await mountWith({ name: 'explorer-tx', params: { txid: TX } })
      .find('a')
      .trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(open).toHaveBeenCalledWith({ kind: 'tx', txid: TX })
    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('блок — обычный переход', async () => {
    const open = vi.fn()
    const { router, mountWith } = await setup({ [CHAIN_LINK_KEY as symbol]: open })
    await mountWith({ name: 'explorer-block', params: { hashOrHeight: '5' } })
      .find('a')
      .trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(open).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/explorer/block/5')
  })

  it('вне модалки — переход в эксплорер, как раньше', async () => {
    const { router, mountWith } = await setup({})
    await mountWith({ name: 'explorer-tx', params: { txid: TX } })
      .find('a')
      .trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.fullPath).toBe(`/explorer/tx/${TX}`)
  })
})
