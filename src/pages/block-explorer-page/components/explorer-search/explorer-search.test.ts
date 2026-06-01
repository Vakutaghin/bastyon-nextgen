import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '@/i18n'
import ExplorerSearch from './explorer-search.vue'
import { recordVisit, clearHistory } from '../../components/shared/use-search-history'

const blank = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/explorer', name: 'explorer', component: blank },
    { path: '/explorer/block/:hashOrHeight', name: 'explorer-block', component: blank },
    { path: '/explorer/tx/:txid', name: 'explorer-tx', component: blank },
    { path: '/explorer/address/:address', name: 'explorer-address', component: blank },
  ],
})

function mountSearch() {
  return mount(ExplorerSearch, { global: { plugins: [i18n, router] } })
}

beforeEach(() => {
  // История — общий module-level ref; чистим между тестами для изоляции.
  clearHistory()
  vi.restoreAllMocks()
})

describe('explorer-search', () => {
  it('renders the localized placeholder', () => {
    const wrapper = mountSearch()
    expect(wrapper.find('input').attributes('placeholder')).toBe(
      i18n.global.t('explorerPage.searchPlaceholder')
    )
  })

  it('navigates to the block route on submit of a numeric height', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('12345')
    await wrapper.find('form').trigger('submit')

    expect(pushSpy).toHaveBeenCalledWith({
      name: 'explorer-block',
      params: { hashOrHeight: '12345' },
    })
  })

  it('shows the history dropdown on focus and navigates on pick', async () => {
    recordVisit('888', 'block')
    recordVisit('999', 'block')
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mountSearch()

    await wrapper.find('input').trigger('focus')

    const text = wrapper.text()
    expect(text).toContain('888')
    expect(text).toContain('999')

    const pick = wrapper.findAll('button').find((b) => b.text().includes('999'))
    expect(pick).toBeTruthy()
    await pick!.trigger('click')

    expect(pushSpy).toHaveBeenCalledWith({
      name: 'explorer-block',
      params: { hashOrHeight: '999' },
    })
  })
})
