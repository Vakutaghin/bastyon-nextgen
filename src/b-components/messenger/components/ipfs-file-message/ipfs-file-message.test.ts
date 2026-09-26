// Карточка «файл через IPFS» в чате: что на ней написано, куда ведёт кнопка и
// как работает «Раздавать дальше».

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

const h = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  openViewer: vi.fn(),
  confirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => ({ address: 'PAlice' }) }))
vi.mock('@/composables/use-ipfs-links', () => ({ openIpfsViewer: h.openViewer }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: h.confirm } }))

import IpfsFileMessage from './ipfs-file-message.vue'
import { parseIpfsFileLink, type IpfsFileLink } from '@/helpers/ipfs/ipfs-link'

const privateLink = parseIpfsFileLink(
  'ipfs://bafyenc#key=a2V5&name=report.zip&size=2048'
) as IpfsFileLink
const imageLink = parseIpfsFileLink('ipfs://bafydir/cat.jpg') as IpfsFileLink

beforeEach(() => {
  vi.clearAllMocks()
  h.store = reactive({
    available: true,
    torActive: false,
    message: null as string | null,
    shares: [] as { cid: string }[],
    seed: vi.fn(async () => ({ cid: 'bafyenc' })),
    showTorBlocked: vi.fn(),
  })
})

describe('IpfsFileMessage', () => {
  it('приватный файл: имя, размер и «Скачать» — тот же путь, что клик по ссылке', async () => {
    const card = mount(IpfsFileMessage, { props: { link: privateLink, mine: false } })
    expect(card.text()).toContain('report.zip')
    expect(card.text()).toContain('messenger.ipfsCardPrivate')
    const [download] = card.findAll('button')
    expect(download?.text()).toBe('messenger.ipfsDownload')
    await download?.trigger('click')
    expect(h.openViewer).toHaveBeenCalledWith(privateLink.target, privateLink.secret, 2048)
  })

  it('картинка открывается, а не скачивается', () => {
    const card = mount(IpfsFileMessage, { props: { link: imageLink, mine: false } })
    expect(card.findAll('button')[0]?.text()).toBe('messenger.ipfsOpen')
  })

  it('«Раздавать дальше»: после подтверждения файл закрепляется с ключом из ссылки', async () => {
    const card = mount(IpfsFileMessage, { props: { link: privateLink, mine: false } })
    const seed = card.findAll('button')[1]
    expect(seed?.text()).toBe('messenger.ipfsSeed')
    await seed?.trigger('click')

    const [opts] = h.confirm.mock.calls[0] as [{ onOk: () => Promise<void> }]
    await opts.onOk()
    await flushPromises()

    expect(h.store.seed).toHaveBeenCalledWith('PAlice', {
      cid: 'bafyenc',
      name: 'report.zip',
      size: 2048,
      key: 'a2V5',
    })
    expect(h.toast.success).toHaveBeenCalled()
    expect(card.findAll('button')[1]?.text()).toBe('messenger.ipfsSeeding')
  })

  it('своё сообщение и веб — без «Раздавать дальше»', () => {
    expect(
      mount(IpfsFileMessage, { props: { link: privateLink, mine: true } }).findAll('button')
    ).toHaveLength(1)
    h.store.available = false
    expect(
      mount(IpfsFileMessage, { props: { link: privateLink, mine: false } }).findAll('button')
    ).toHaveLength(1)
  })
})
