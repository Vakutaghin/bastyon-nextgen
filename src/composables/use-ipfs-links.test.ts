// Открытие IPFS-ссылки на компьютере: окно просмотра появляется сразу и ждёт,
// пока своя нода ищет содержимое; не нашлось — так и говорит. Своей ноды нет —
// ссылку открывает браузер через inbrowser.link: публичные шлюзы приложениям
// больше не отвечают.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  probe: vi.fn(),
  openInBrowser: vi.fn(),
  openExternal: vi.fn(),
  modal: { success: vi.fn(), error: vi.fn(), info: vi.fn(), confirm: vi.fn() },
  progressModal: { update: vi.fn(), destroy: vi.fn() },
  store: {
    available: true,
    torActive: false,
    message: null as string | null,
    resolveGateway: vi.fn(),
    saveFile: vi.fn(),
    saveEncrypted: vi.fn(),
    openViewer: vi.fn(),
    viewerStatus: vi.fn(),
    closeViewer: vi.fn(),
    enable: vi.fn(),
    showDesktopOnly: vi.fn(),
    showTorBlocked: vi.fn(),
  },
}))

vi.mock('@/helpers/ipfs/ipfs-download', () => ({ probeContent: h.probe }))
vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('ant-design-vue', () => ({ Modal: h.modal }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('./ipfs-browser-open', () => ({ openIpfsInBrowser: h.openInBrowser }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: h.openExternal }))

import { openIpfsViewer, saveErrorText } from './use-ipfs-links'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'

const LOCAL = 'http://127.0.0.1:8080'
const target: IpfsTarget = { namespace: 'ipfs', root: 'bafybeigdyrzt5sfp7', path: 'docs/a.zip' }
const zip = { contentType: 'application/zip', contentDisposition: null }
const png = { contentType: 'image/png', contentDisposition: null }

beforeEach(() => {
  vi.clearAllMocks()
  h.modal.info.mockReturnValue(h.progressModal)
  h.store.available = true
  h.store.message = null
  h.store.saveFile.mockResolvedValue('saved')
  h.store.viewerStatus.mockResolvedValue(true)
})

/** Что показало окно ожидания (`n`-й вызов). */
function statusAt(n: number): { kind: string; heading: string; detail: string } {
  return h.store.viewerStatus.mock.calls[n]?.[2]
}

describe('openIpfsViewer: файл со своей ноды', () => {
  it('нода отдала файл — окно ожидания закрывается, файл сохраняется с неё', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(zip)

    await openIpfsViewer(target, null)

    expect(h.store.closeViewer).toHaveBeenCalled()
    expect(h.store.saveFile).toHaveBeenCalledWith(
      'local',
      target,
      'a.zip',
      expect.objectContaining({ sizeHint: null })
    )
    expect(h.modal.success).toHaveBeenCalled()
    expect(h.store.openViewer).not.toHaveBeenCalled()
  })

  it('сохранение не удалось — понятное сообщение', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
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
  const pic: IpfsTarget = { ...target, path: 'pic.png' }

  it('окно — сразу, пока нода ищет; потом в нём же содержимое', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    let found: (v: typeof png) => void = () => {}
    h.probe.mockReturnValue(new Promise((resolve) => (found = resolve)))

    const opening = openIpfsViewer(pic, null)
    await vi.waitFor(() => expect(h.probe).toHaveBeenCalled())

    const [label, title, , start] = h.store.viewerStatus.mock.calls[0] as [
      string,
      string,
      unknown,
      boolean,
    ]
    expect(start).toBe(true)
    expect(statusAt(0)).toEqual({
      kind: 'loading',
      heading: 'header.ipfsViewerSearching',
      detail: 'ipfs://bafybeigdyrzt5sfp7/pic.png',
    })
    expect(h.store.openViewer).not.toHaveBeenCalled()

    found(png)
    await opening
    expect(h.store.openViewer).toHaveBeenCalledWith(
      label,
      `${LOCAL}/ipfs/bafybeigdyrzt5sfp7/pic.png`,
      title,
      true
    )
  })

  it('не нашлось — окно говорит об этом, а не уходит на публичный шлюз', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(null)

    await openIpfsViewer(pic, null)

    expect(h.probe).toHaveBeenCalledTimes(1)
    expect(h.probe.mock.calls[0]?.[0]).toBe(`${LOCAL}/ipfs/bafybeigdyrzt5sfp7/pic.png`)
    expect(statusAt(1)).toMatchObject({ kind: 'error', heading: 'header.ipfsViewerNotFound' })
    expect(h.store.openViewer).not.toHaveBeenCalled()
  })

  it('окно с этим содержимым уже открыто — без поиска', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.store.viewerStatus.mockResolvedValue(false)

    await openIpfsViewer(pic, null)

    expect(h.probe).not.toHaveBeenCalled()
    expect(h.store.openViewer).not.toHaveBeenCalled()
  })

  it('долго — окно объясняет; закрыли окно — поиск бросаем', async () => {
    vi.useFakeTimers()
    try {
      h.store.resolveGateway.mockResolvedValue(LOCAL)
      h.store.viewerStatus.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      h.probe.mockImplementation(
        (_url: string, _timeout: number, signal: AbortSignal) =>
          new Promise((resolve) => signal.addEventListener('abort', () => resolve(null)))
      )

      const opening = openIpfsViewer(pic, null)
      await vi.advanceTimersByTimeAsync(8_000)
      await opening

      expect(statusAt(1)).toMatchObject({ kind: 'loading', detail: 'header.ipfsViewerSlow' })
      expect(h.store.viewerStatus).toHaveBeenCalledTimes(2)
      expect(h.store.openViewer).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('openIpfsViewer: своей ноды нет', () => {
  it('как в вебе: узел в приложении, без окна-просмотрщика и проб', async () => {
    h.store.resolveGateway.mockResolvedValue('https://dweb.link')
    const secret = { key: 'a2V5', name: 'a.txt' }

    await openIpfsViewer(target, null, 7)
    await openIpfsViewer(target, secret)

    expect(h.openInBrowser).toHaveBeenNthCalledWith(1, target, null, 7)
    expect(h.openInBrowser).toHaveBeenNthCalledWith(2, target, secret, null)
    expect(h.probe).not.toHaveBeenCalled()
    expect(h.store.viewerStatus).not.toHaveBeenCalled()
  })
})

describe('openIpfsViewer: браузер и телефон', () => {
  it('без Tauri ссылка уходит в браузерный сценарий — синхронно, пока идёт клик', () => {
    h.store.available = false
    const secret = { key: 'a2V5', name: 'a.txt' }
    void openIpfsViewer(target, secret)
    expect(h.openInBrowser).toHaveBeenCalledWith(target, secret, null)
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

describe('openIpfsViewer: прогресс сохранения на десктопе', () => {
  it('окно появляется после выбора места, обновляется и закрывается; «Отменить» отменяет', async () => {
    h.store.resolveGateway.mockResolvedValue(LOCAL)
    h.probe.mockResolvedValue(zip)
    const cancel = vi.fn()
    h.store.saveFile.mockImplementation(
      async (
        _s: string,
        _t: IpfsTarget,
        _n: string,
        opts: { onProgress: (p: unknown) => void }
      ) => {
        opts.onProgress({ received: 0, total: 2048, cancel })
        opts.onProgress({ received: 1024, total: 2048, cancel })
        return 'saved'
      }
    )

    await openIpfsViewer(target, null, 2048)

    expect(h.modal.info).toHaveBeenCalledTimes(1)
    const [opts] = h.modal.info.mock.calls[0] as [{ content: string; onOk: () => void }]
    expect(opts.content).toBe('header.ipfsSaveWaiting')
    expect(h.progressModal.update).toHaveBeenCalledWith({ content: 'header.ipfsWebProgress' })
    expect(h.progressModal.destroy).toHaveBeenCalled()
    expect(h.store.saveFile.mock.calls[0]?.[3]).toMatchObject({ sizeHint: 2048 })
    opts.onOk()
    expect(cancel).toHaveBeenCalled()
  })
})
