// «Файл через IPFS» в чате: что публикуется, когда спрашиваем, и что уходит в чат.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  store: {
    available: true,
    torActive: false,
    message: null as string | null,
    pickFiles: vi.fn(),
    publish: vi.fn(),
    showTorBlocked: vi.fn(),
  },
  confirm: vi.fn(),
  error: vi.fn(),
  hide: vi.fn(),
}))

vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => ({ address: 'PAlice' }) }))
vi.mock('ant-design-vue', () => ({
  Modal: { confirm: h.confirm, error: h.error },
  message: { loading: () => h.hide },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { useIpfsSend } from './use-ipfs-send'

const MB = 1024 * 1024
const share = { cid: 'bafyenc', name: 'Фото.zip', size: 10 * MB, addedAt: 1, key: 'a2V5' }

beforeEach(() => {
  vi.clearAllMocks()
  h.store.torActive = false
  h.store.message = null
})

describe('useIpfsSend', () => {
  it('в чат уходит приватная ссылка с ключом, именем и размером', async () => {
    const send = vi.fn()
    h.store.pickFiles.mockResolvedValue([{ token: 't', name: 'Фото.zip', size: 10 * MB }])
    h.store.publish.mockResolvedValue(share)

    await useIpfsSend(send).sendViaIpfs()

    expect(h.store.publish).toHaveBeenCalledWith(
      'PAlice',
      expect.objectContaining({ token: 't' }),
      'private'
    )
    expect(send).toHaveBeenCalledWith(
      `ipfs://bafyenc#key=a2V5&name=${encodeURIComponent('Фото.zip')}&size=${10 * MB}`
    )
    expect(h.hide).toHaveBeenCalled()
  })

  it('любой размер — приватно: шифр кусками, без вопроса про ссылку', async () => {
    const send = vi.fn()
    h.store.pickFiles.mockResolvedValue([{ token: 't', name: 'big.iso', size: 3 * 1024 * MB }])
    h.store.publish.mockResolvedValue({ ...share, name: 'big.iso' })
    await useIpfsSend(send).sendViaIpfs()
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.store.publish.mock.calls[0]?.[2]).toBe('private')
  })

  it('несколько файлов — по сообщению на каждый', async () => {
    const send = vi.fn()
    h.store.pickFiles.mockResolvedValue([
      { token: 'a', name: 'a.zip', size: 1 },
      { token: 'b', name: 'b.zip', size: 2 },
    ])
    h.store.publish
      .mockResolvedValueOnce({ ...share, cid: 'bafya', name: 'a.zip', size: 1 })
      .mockResolvedValueOnce({ ...share, cid: 'bafyb', name: 'b.zip', size: 2 })
    await useIpfsSend(send).sendViaIpfs()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]?.[0]).toContain('ipfs://bafyb#key=')
  })

  it('отмена выбора — тишина; ошибка публикации — окно, в чат ничего', async () => {
    const send = vi.fn()
    h.store.pickFiles.mockResolvedValueOnce([])
    await useIpfsSend(send).sendViaIpfs()
    expect(h.error).not.toHaveBeenCalled()

    h.store.pickFiles.mockResolvedValueOnce([{ token: 't', name: 'a', size: 1 }])
    h.store.publish.mockImplementationOnce(async () => {
      h.store.message = 'no space left on device'
      return null
    })
    await useIpfsSend(send).sendViaIpfs()
    expect(h.error).toHaveBeenCalledWith({
      title: 'messenger.ipfsSendFailed',
      content: 'no space left on device',
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('под Tor не публикуем: раздача светила бы IP', async () => {
    h.store.torActive = true
    await useIpfsSend(vi.fn()).sendViaIpfs()
    expect(h.store.showTorBlocked).toHaveBeenCalled()
    expect(h.store.pickFiles).not.toHaveBeenCalled()
  })
})
