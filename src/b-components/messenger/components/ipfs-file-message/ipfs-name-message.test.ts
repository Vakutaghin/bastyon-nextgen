// Карточка постоянной ссылки в чате: без запросов в сеть при показе,
// «Открыть» — окно просмотра по имени, «Следить за обновлениями» — в стор.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

const h = vi.hoisted(() => ({
  follow: null as unknown as Record<string, unknown>,
  openViewer: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => ({ address: 'PAlice' }) }))
vi.mock('@/composables/use-ipfs-links', () => ({ openIpfsViewer: h.openViewer }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('@/stores/ipns-follow-store', () => ({ useIpnsFollowStore: () => h.follow }))
vi.mock('@/stores/ipns-names-store', () => ({
  BlockedByTorError: class BlockedByTorError extends Error {},
}))

import IpfsNameMessage from './ipfs-name-message.vue'
import { BlockedByTorError } from '@/stores/ipns-names-store'

const NAME = 'k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff115356d77amfwc'

beforeEach(() => {
  vi.clearAllMocks()
  const follow = reactive({
    names: [] as string[],
    use: vi.fn(),
    isFollowed: (name: string) => follow.names.includes(name),
    follow: vi.fn(async (name: string) => {
      follow.names.push(name)
    }),
    unfollow: vi.fn((name: string) => {
      follow.names = follow.names.filter((n) => n !== name)
    }),
  })
  h.follow = follow
  vi.stubGlobal('fetch', vi.fn())
})

describe('IpfsNameMessage', () => {
  it('показ — без сети; «Открыть» — окно просмотра по имени', async () => {
    const card = mount(IpfsNameMessage, { props: { name: NAME, mine: false } })
    expect(card.text()).toContain('messenger.ipnsCardTitle')
    expect(card.find('[title]').attributes('title')).toBe(`ipns://${NAME}`)
    expect(fetch).not.toHaveBeenCalled()
    expect(h.follow.use).toHaveBeenCalledWith('PAlice')
    await card.findAll('button')[0]?.trigger('click')
    expect(h.openViewer).toHaveBeenCalledWith(
      { namespace: 'ipns', root: NAME, path: '' },
      null,
      null
    )
  })

  it('«Следить за обновлениями» и обратно', async () => {
    const card = mount(IpfsNameMessage, { props: { name: NAME, mine: false } })
    const toggle = () => card.findAll('button')[1]
    expect(toggle()?.text()).toBe('messenger.ipnsFollow')
    await toggle()?.trigger('click')
    await flushPromises()
    expect(h.follow.follow).toHaveBeenCalledWith(NAME)
    expect(h.toast.success).toHaveBeenCalledWith({ message: 'messenger.ipnsFollowing' })
    expect(toggle()?.text()).toBe('messenger.ipnsUnfollow')
    await toggle()?.trigger('click')
    expect(h.follow.unfollow).toHaveBeenCalledWith(NAME)
    expect(toggle()?.text()).toBe('messenger.ipnsFollow')
  })

  it('своя ссылка — следить незачем; под Tor — без тоста об ошибке', async () => {
    expect(
      mount(IpfsNameMessage, { props: { name: NAME, mine: true } }).findAll('button')
    ).toHaveLength(1)
    ;(h.follow.follow as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new BlockedByTorError())
    const card = mount(IpfsNameMessage, { props: { name: NAME, mine: false } })
    await card.findAll('button')[1]?.trigger('click')
    await flushPromises()
    expect(h.toast.error).not.toHaveBeenCalled()
  })
})
