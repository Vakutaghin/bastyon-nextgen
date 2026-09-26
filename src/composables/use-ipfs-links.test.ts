// Открытие IPFS-ссылки: откуда брать файл (локальная нода или публичный
// шлюз) решается до сохранения — от этого зависит, проверит ли Rust файл по
// CID. И что пользователь видит, если проверка не прошла.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  probe: vi.fn(),
  openInBrowser: vi.fn(),
  modal: { success: vi.fn(), error: vi.fn() },
  store: {
    available: true,
    torActive: false,
    message: null as string | null,
    resolveGateway: vi.fn(),
    saveFile: vi.fn(),
    saveEncrypted: vi.fn(),
    openViewer: vi.fn(),
    showDesktopOnly: vi.fn(),
    showTorBlocked: vi.fn(),
  },
}))

vi.mock('@/helpers/ipfs/ipfs-download', () => ({ probeContent: h.probe }))
vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('ant-design-vue', () => ({ Modal: h.modal }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('./ipfs-browser-open', () => ({ openIpfsInBrowser: h.openInBrowser }))

import { openIpfsViewer, saveErrorText } from './use-ipfs-links'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'

const LOCAL = 'http://127.0.0.1:8080'
const target: IpfsTarget = { namespace: 'ipfs', root: 'bafybeigdyrzt5sfp7', path: 'docs/a.zip' }
const zip = { contentType: 'application/zip', contentDisposition: null }
const png = { contentType: 'image/png', contentDisposition: null }

beforeEach(() => {
  vi.clearAllMocks()
  h.store.available = true
  h.store.message = null
  h.store.saveFile.mockResolvedValue('saved')
})

describe('openIpfsViewer: откуда сохраняется файл', () => {
  it('локальная нода отдала файл — сохраняем с неё', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(zip)

    await openIpfsViewer(target, null)

    expect(h.store.saveFile).toHaveBeenCalledWith('local', target, 'a.zip')
    expect(h.modal.success).toHaveBeenCalled()
  })

  it('локальная нода не ответила — файл идёт с публичного шлюза, то есть с проверкой по CID', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValueOnce(null).mockResolvedValueOnce(zip)

    await openIpfsViewer(target, null)

    expect(h.probe).toHaveBeenLastCalledWith('https://dweb.link/ipfs/bafybeigdyrzt5sfp7/docs/a.zip')
    expect(h.store.saveFile).toHaveBeenCalledWith('public', target, 'a.zip')
  })

  it('файл не совпал с CID — пользователь видит, что шлюз подменил данные', async () => {
    h.store.resolveGateway.mockResolvedValue('https://dweb.link')
    h.probe.mockResolvedValue(zip)
    h.store.saveFile.mockImplementation(async () => {
      h.store.message = 'verify-mismatch: block 0a1b does not match its CID'
      return 'failed'
    })

    await openIpfsViewer(target, null)

    expect(h.modal.error).toHaveBeenCalledWith({
      title: 'header.ipfsDownloadFailedTitle',
      content: 'header.ipfsVerifyMismatch',
    })
  })

  it('отмена диалога сохранения — без сообщений', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(zip)
    h.store.saveFile.mockResolvedValue('cancelled')

    await openIpfsViewer(target, null)

    expect(h.modal.success).not.toHaveBeenCalled()
    expect(h.modal.error).not.toHaveBeenCalled()
  })
})

describe('openIpfsViewer: окно просмотра', () => {
  it('через публичный шлюз заголовок окна называет шлюз', async () => {
    h.store.resolveGateway.mockResolvedValue('https://dweb.link')
    h.probe.mockResolvedValue(png)

    await openIpfsViewer({ ...target, path: 'pic.png' }, null)

    const [, url, title] = h.store.openViewer.mock.calls[0] as [string, string, string]
    expect(url).toBe('https://dweb.link/ipfs/bafybeigdyrzt5sfp7/pic.png')
    expect(title).toContain('dweb.link')
    expect(h.store.saveFile).not.toHaveBeenCalled()
  })

  it('с локальной ноды — без шлюза в заголовке', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(png)

    await openIpfsViewer({ ...target, path: 'pic.png' }, null)

    const [, url, title] = h.store.openViewer.mock.calls[0] as [string, string, string]
    expect(url).toBe(`${LOCAL}/ipfs/bafybeigdyrzt5sfp7/pic.png`)
    expect(title).not.toContain('dweb.link')
  })
})

describe('openIpfsViewer: браузер и телефон', () => {
  it('без Tauri ссылка уходит в браузерный сценарий — синхронно, пока идёт клик', () => {
    h.store.available = false
    const secret = { key: 'a2V5', name: 'a.txt' }
    void openIpfsViewer(target, secret)
    expect(h.openInBrowser).toHaveBeenCalledWith(target, secret)
    expect(h.store.showDesktopOnly).not.toHaveBeenCalled()
    expect(h.store.resolveGateway).not.toHaveBeenCalled()
  })
})

describe('saveErrorText', () => {
  it('коды проверки по CID — по-человечески, остальное как есть', () => {
    expect(saveErrorText('verify-unsupported: hash function 0x1e')).toBe(
      'header.ipfsVerifyUnsupported'
    )
    expect(saveErrorText('verify-too-large')).toBe('header.ipfsVerifyTooLarge')
    expect(saveErrorText('verify-missing: the gateway did not send block ab')).toBe(
      'header.ipfsVerifyIncomplete'
    )
    expect(saveErrorText('gateway responded 504 Gateway Timeout')).toBe(
      'gateway responded 504 Gateway Timeout'
    )
    expect(saveErrorText(null)).toBe('')
  })
})
