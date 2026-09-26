// «Файл через IPFS» в чате: что публикуется, когда спрашиваем, и что уходит в чат.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  store: {
    available: true,
    torActive: false,
    message: null as string | null,
    pickFile: vi.fn(),
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

import { PRIVATE_MAX_BYTES, useIpfsSend } from './use-ipfs-send'

const MB = 1024 * 1024
const share = { cid: 'bafyenc', name: 'Фото.zip', size: 10 * MB, addedAt: 1, key: 'a2V5' }

beforeEach(() => {
  vi.clearAllMocks()
  h.store.torActive = false
  h.store.message = null
})

describe('useIpfsSend', () => {
  it('до 512 МБ — приватно, в чат уходит ссылка с ключом, именем и размером', async () => {
    const send = vi.fn()
    h.store.pickFile.mockResolvedValue({ token: 't', name: 'Фото.zip', size: 10 * MB })
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

  it('больше 512 МБ — спрашиваем; согласие — по ссылке, отказ — ничего', async () => {
    const send = vi.fn()
    h.store.pickFile.mockResolvedValue({ token: 't', name: 'big.iso', size: PRIVATE_MAX_BYTES + 1 })
    h.store.publish.mockResolvedValue({ cid: 'bafydir', name: 'big.iso', size: 1, addedAt: 1 })

    h.confirm.mockImplementationOnce((opts: { onOk: () => void }) => opts.onOk())
    await useIpfsSend(send).sendViaIpfs()
    expect(h.store.publish.mock.calls[0]?.[2]).toBe('public')
    expect(send).toHaveBeenCalledWith('ipfs://bafydir/big.iso#size=1')

    h.store.publish.mockClear()
    h.confirm.mockImplementationOnce((opts: { onCancel: () => void }) => opts.onCancel())
    await useIpfsSend(send).sendViaIpfs()
    expect(h.store.publish).not.toHaveBeenCalled()
  })

  it('отмена выбора — тишина; ошибка публикации — окно, в чат ничего', async () => {
    const send = vi.fn()
    h.store.pickFile.mockResolvedValueOnce(null)
    await useIpfsSend(send).sendViaIpfs()
    expect(h.error).not.toHaveBeenCalled()

    h.store.pickFile.mockResolvedValueOnce({ token: 't', name: 'a', size: 1 })
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
    expect(h.store.pickFile).not.toHaveBeenCalled()
  })
})
