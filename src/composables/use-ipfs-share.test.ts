// Публикация файла: от чьего имени, какая ссылка уходит в буфер и что видно
// при отказе.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  store: {
    torActive: false,
    message: null as string | null,
    addFile: vi.fn(),
    addFileEncrypted: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
  h.store.torActive = false
  h.store.message = null
})

describe('useIpfsShare', () => {
  it('публичный файл: ссылка с именем файла в буфере и в окне', async () => {
    h.store.addFile.mockResolvedValue({ cid: 'bafydir', name: 'a b.pdf', size: 1, addedAt: 1 })
    const { share, sharing } = useIpfsShare()

    const shared = await share('public')

    expect(h.store.addFile).toHaveBeenCalledWith('PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT')
    expect(shared?.cid).toBe('bafydir')
    expect(h.copyText).toHaveBeenCalledWith('ipfs://bafydir/a%20b.pdf')
    expect(h.modal.success).toHaveBeenCalledWith({
      title: 'header.ipfsShareDoneTitle',
      content: 'header.ipfsShareDoneCopied ipfs://bafydir/a%20b.pdf',
    })
    expect(sharing.value).toBe(false)
  })

  it('приватный файл: ключ во фрагменте; буфер недоступен — ссылка просто показана', async () => {
    h.store.addFileEncrypted.mockResolvedValue({
      cid: 'bafyenc',
      name: 'x.txt',
      size: 1,
      addedAt: 1,
      key: 'a2V5',
    })
    h.copyText.mockResolvedValueOnce(false)

    await useIpfsShare().share('private')

    const link = 'ipfs://bafyenc#key=a2V5&name=x.txt'
    expect(h.copyText).toHaveBeenCalledWith(link)
    expect(h.modal.success).toHaveBeenCalledWith({
      title: 'header.ipfsShareEncryptedDoneTitle',
      content: `header.ipfsShareEncryptedDone ${link}`,
    })
  })

  it('ошибка публикации — окно с ошибкой; отмена диалога — тишина', async () => {
    h.store.addFile.mockImplementationOnce(async () => {
      h.store.message = 'no space left on device'
      return null
    })
    await useIpfsShare().share('public')
    expect(h.modal.error).toHaveBeenCalledWith({
      title: 'header.ipfsShareFailedTitle',
      content: 'no space left on device',
    })

    h.modal.error.mockClear()
    h.store.addFile.mockResolvedValueOnce(null)
    await useIpfsShare().share('public')
    expect(h.modal.error).not.toHaveBeenCalled()
  })

  it('под Tor публикации нет: раздача светила бы IP', async () => {
    h.store.torActive = true
    await useIpfsShare().share('public')
    expect(h.store.showTorBlocked).toHaveBeenCalled()
    expect(h.store.addFile).not.toHaveBeenCalled()
  })
})
