// Публикация файла: от чьего имени, какая ссылка уходит в буфер и что видно
// при отказе.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  store: {
    torActive: false,
    message: null as string | null,
    pickFile: vi.fn(),
    publish: vi.fn(),
    showTorBlocked: vi.fn(),
  },
  auth: { address: 'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT' as string | null },
  copyText: vi.fn(async () => true),
  modal: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: h.copyText }))
vi.mock('ant-design-vue', () => ({ Modal: h.modal }))
vi.mock('@/i18n', () => ({
  t: (key: string, named?: Record<string, unknown>) => (named ? `${key} ${named.link}` : key),
}))

import { useIpfsShare } from './use-ipfs-share'

const picked = { token: 't0', name: 'a b.pdf', size: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  h.store.torActive = false
  h.store.message = null
  h.store.pickFile.mockResolvedValue(picked)
})

describe('useIpfsShare', () => {
  it('публичный файл: ссылка с именем файла в буфере и в окне', async () => {
    h.store.publish.mockResolvedValue({ cid: 'bafydir', name: 'a b.pdf', size: 1, addedAt: 1 })
    const { share, sharing } = useIpfsShare()

    const shared = await share('public')

    expect(h.store.publish).toHaveBeenCalledWith(
      'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT',
      picked,
      'public'
    )
    expect(shared?.cid).toBe('bafydir')
    expect(h.copyText).toHaveBeenCalledWith('ipfs://bafydir/a%20b.pdf#size=1')
    expect(h.modal.success).toHaveBeenCalledWith({
      title: 'header.ipfsShareDoneTitle',
      content: 'header.ipfsShareDoneCopied ipfs://bafydir/a%20b.pdf#size=1',
    })
    expect(sharing.value).toBe(false)
  })

  it('приватный файл: ключ во фрагменте; буфер недоступен — ссылка просто показана', async () => {
    h.store.publish.mockResolvedValue({
      cid: 'bafyenc',
      name: 'x.txt',
      size: 1,
      addedAt: 1,
      key: 'a2V5',
    })
    h.copyText.mockResolvedValueOnce(false)

    await useIpfsShare().share('private')

    expect(h.store.publish.mock.calls[0]?.[2]).toBe('private')
    const link = 'ipfs://bafyenc#key=a2V5&name=x.txt&size=1'
    expect(h.copyText).toHaveBeenCalledWith(link)
    expect(h.modal.success).toHaveBeenCalledWith({
      title: 'header.ipfsShareEncryptedDoneTitle',
      content: `header.ipfsShareEncryptedDone ${link}`,
    })
  })

  it('ошибка публикации — окно с ошибкой; отмена диалога — тишина', async () => {
    h.store.publish.mockImplementationOnce(async () => {
      h.store.message = 'no space left on device'
      return null
    })
    await useIpfsShare().share('public')
    expect(h.modal.error).toHaveBeenCalledWith({
      title: 'header.ipfsShareFailedTitle',
      content: 'no space left on device',
    })

    h.modal.error.mockClear()
    h.store.pickFile.mockResolvedValueOnce(null)
    await useIpfsShare().share('public')
    expect(h.store.publish).toHaveBeenCalledTimes(1)
    expect(h.modal.error).not.toHaveBeenCalled()
  })

  it('под Tor публикации нет: раздача светила бы IP', async () => {
    h.store.torActive = true
    await useIpfsShare().share('public')
    expect(h.store.showTorBlocked).toHaveBeenCalled()
    expect(h.store.pickFile).not.toHaveBeenCalled()
  })
})
