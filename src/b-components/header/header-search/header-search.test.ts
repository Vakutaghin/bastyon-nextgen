// Строка поиска в шапке: вставленная ссылка IPFS (или голый CID) сразу
// открывается — без Enter и раньше, чем поле обрежет длинную приватную
// ссылку; набранная — по Enter. Обычный текст ищется как раньше. Крестик
// стирает поле и не открывает выпадашку.

import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  openIpfsViewer: vi.fn(async () => {}),
  push: vi.fn(),
  store: null as null | {
    query: string
    recentHistory: unknown[]
    setQuery: (v: string) => void
    commit: (v: string) => string
    ensureLoaded: () => Promise<void>
  },
}))

vi.mock('@/composables/use-ipfs-links', () => ({ openIpfsViewer: mocks.openIpfsViewer }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push, currentRoute: { value: { fullPath: '/' } } }),
}))
vi.mock('@/stores/search-store', () => ({ useSearchStore: () => mocks.store }))
vi.mock('@/services/user-resolver', () => ({
  ensureUserResolverLoaded: async () => {},
  resolveNameLocal: () => null,
  resolveNameRemote: async () => null,
}))

vi.mock('./header-search-dropdown.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: { query: { type: String, default: '' } },
      setup: (props) => () => h('div', { class: 'search-dropdown' }, props.query),
    }),
  }
})

import HeaderSearch from './header-search.vue'

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
let wrapper: VueWrapper | null = null

function paste(text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } })
  wrapper!.find('input').element.dispatchEvent(event)
  return event
}

describe('HeaderSearch', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.store = reactive({
      query: '',
      recentHistory: [],
      setQuery(v: string) {
        this.query = v
      },
      commit: (v: string) => v,
      ensureLoaded: async () => {},
    })
    wrapper = mount(HeaderSearch, { attachTo: document.body, global: { plugins: [i18n] } })
  })
  afterEach(() => {
    vi.useRealTimers()
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('вставили приватную ссылку IPFS — открывается целиком, с ключом, без поиска', () => {
    const link = `ipfs://${CID}/report.pdf#key=${'A'.repeat(44)}&name=report.pdf&size=2048`
    expect(link.length).toBeGreaterThan(100)
    const event = paste(link)
    expect(event.defaultPrevented).toBe(true)
    expect(mocks.openIpfsViewer).toHaveBeenCalledWith(
      { namespace: 'ipfs', root: CID, path: 'report.pdf' },
      { key: 'A'.repeat(44), name: 'report.pdf' },
      2048
    )
    expect(mocks.store!.query).toBe('')
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('вставили голый CID — тоже открывается', () => {
    paste(CID)
    expect(mocks.openIpfsViewer).toHaveBeenCalledWith(
      { namespace: 'ipfs', root: CID, path: '' },
      null,
      null
    )
  })

  it('обычный текст вставляется как есть', () => {
    const event = paste('котики')
    expect(event.defaultPrevented).toBe(false)
    expect(mocks.openIpfsViewer).not.toHaveBeenCalled()
  })

  it('набрали ссылку и нажали Enter — открывается; текст — поиск', async () => {
    const input = wrapper!.findComponent({ name: 'InputSearch' })
    input.vm.$emit('search', `https://ipfs.io/ipfs/${CID}`)
    await Promise.resolve()
    expect(mocks.openIpfsViewer).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()

    input.vm.$emit('search', 'котики')
    await Promise.resolve()
    expect(mocks.push).toHaveBeenCalledWith({ path: '/search', query: { q: 'котики' } })
    expect(mocks.openIpfsViewer).toHaveBeenCalledTimes(1)
  })

  it('стёрли крестиком — выпадашка не открывается, пока не начнут печатать снова', async () => {
    vi.useFakeTimers()
    mocks.store!.recentHistory = [{ kind: 'query', value: 'биткоин' }]
    const input = wrapper!.find('input')
    input.element.focus()
    await input.setValue('эфир')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper!.find('.search-dropdown').text()).toBe('эфир')

    // Ушли с поля: выпадашка закрылась.
    input.element.blur()
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(wrapper!.find('.search-dropdown').exists()).toBe(false)

    // Крестик сам ставит фокус в поле — ни стёртый запрос, ни «Недавние» не всплывают.
    await wrapper!.find('.ant-input-clear-icon').trigger('click')
    await nextTick()
    expect(mocks.store!.query).toBe('')
    expect(document.activeElement).toBe(input.element)
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper!.find('.search-dropdown').exists()).toBe(false)

    await input.setValue('б')
    await nextTick()
    expect(wrapper!.find('.search-dropdown').exists()).toBe(true)
  })
})
