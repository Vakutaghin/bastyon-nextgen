// Клик по IPFS-ссылке там, где своей ноды нет. Обычная ссылка — окно
// просмотра (узел IPFS в приложении). Приватный файл скачивается узлом с
// проверкой и расшифровкой здесь; что видит пользователь при ошибке и отмене.

import { beforeEach, describe, expect, it, vi } from 'vitest'

type ConfirmOpts = {
  title: string
  content: unknown
  onOk: () => unknown
  onCancel?: () => void
}

const h = vi.hoisted(() => ({
  confirms: [] as ConfirmOpts[],
  update: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  hide: vi.fn(),
  showViewer: vi.fn(),
  openIpfs: vi.fn(),
  openSaveSink: vi.fn(),
  decryptSecretFile: vi.fn(),
  decryptSecretStream: vi.fn(),
}))

vi.mock('ant-design-vue', () => ({
  Modal: {
    confirm: (opts: ConfirmOpts) => {
      h.confirms.push(opts)
      return { update: h.update, destroy: vi.fn() }
    },
    error: h.error,
  },
  message: { loading: () => h.hide },
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { success: h.success } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/stores/ipfs-node-viewer-store', () => ({
  useIpfsNodeViewerStore: () => ({ show: h.showViewer }),
}))
vi.mock('@/b-components/messenger/components/file-message/helpers', () => ({
  formatFileSize: (n: number) => `${n} B`,
}))
vi.mock('@/helpers/ipfs/ipfs-node-loader', () => ({
  loadIpfsNode: async () => ({ openIpfs: h.openIpfs }),
}))
vi.mock('@/helpers/ipfs/ipfs-save-sinks', () => ({ openSaveSink: h.openSaveSink }))
vi.mock('@/helpers/ipfs/ipfs-secret', () => ({
  decryptSecretFile: h.decryptSecretFile,
  decryptSecretStream: h.decryptSecretStream,
  // Формат v2 узнаётся по заголовку «BSTN».
  isStreamFormat: (head: Uint8Array) => new TextDecoder().decode(head.subarray(0, 4)) === 'BSTN',
}))

import { openIpfsInBrowser, webErrorText } from './ipfs-browser-open'
import {
  NameError,
  NodeUnavailableError,
  SecretError,
  TransportError,
  VerifyError,
} from '@/helpers/ipfs/ipfs-errors'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'

const ROOT = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
const at = (path: string): IpfsTarget => ({ namespace: 'ipfs', root: ROOT, path })

function makeSink(kind = 'disk') {
  return {
    kind,
    maxBytes: 4 * 1024 ** 3,
    written: [] as number[],
    write: vi.fn(async function (this: { written: number[] }, c: Uint8Array) {
      this.written.push(...c)
    }),
    close: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  }
}

function fileEntity(...chunks: string[]) {
  const parts = chunks.map((c) => new TextEncoder().encode(c))
  return {
    entity: {
      kind: 'file' as const,
      size: parts.reduce((n, p) => n + p.length, 0),
      chunks: (async function* () {
        yield* parts
      })(),
    },
    name: null,
  }
}

/** Последнее окно-подтверждение: дождаться, пока оно появится. */
async function nextConfirm(count = 1): Promise<ConfirmOpts> {
  await vi.waitFor(() => expect(h.confirms.length).toBeGreaterThanOrEqual(count))
  return h.confirms[count - 1] as ConfirmOpts
}

beforeEach(() => {
  vi.clearAllMocks()
  h.confirms.length = 0
})

describe('обычная ссылка — окно просмотра', () => {
  it('файл, папка, голый CID, IPNS — в окне, без скачивания по клику', () => {
    const targets: IpfsTarget[] = [
      at('photos/cat.jpg'),
      at('site'),
      at(''),
      { namespace: 'ipns', root: 'docs.ipfs.tech', path: 'index.html' },
    ]
    for (const target of targets) {
      openIpfsInBrowser(target, null, 42)
      expect(h.showViewer).toHaveBeenLastCalledWith(target, 42)
    }
    expect(h.confirms).toHaveLength(0)
    expect(h.openIpfs).not.toHaveBeenCalled()
  })
})

describe('скачивание приватного файла', () => {
  const secret = { key: 'a2V5', name: 'a.zip' }

  it('закрыли диалог сохранения — ничего не качаем', async () => {
    h.openSaveSink.mockResolvedValue(null)
    openIpfsInBrowser(at('a.zip'), secret)
    await (await nextConfirm()).onOk()
    expect(h.openIpfs).not.toHaveBeenCalled()
  })

  it('в сети не нашлось — понятное сообщение, недокачанное удаляется', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.openIpfs.mockRejectedValue(new TransportError('timeout', 'no providers'))
    openIpfsInBrowser(at('a.zip'), secret)
    await (await nextConfirm()).onOk()
    expect(sink.abort).toHaveBeenCalled()
    expect(h.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'header.ipfsDownloadFailedTitle',
        content: 'header.ipfsNetNotFound',
      })
    )
  })

  it('«Отмена» посреди скачивания — запрос обрывается, без сообщения об ошибке', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.openIpfs.mockImplementation(
      (_t: IpfsTarget, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    )
    openIpfsInBrowser(at('a.zip'), secret)
    const confirm = await nextConfirm()
    const running = confirm.onOk()
    await vi.waitFor(() => expect(h.openIpfs).toHaveBeenCalled())
    confirm.onCancel?.()
    await running
    expect(sink.abort).toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
  })

  it('повторный клик, пока первый не закончен, второго окна не открывает', async () => {
    openIpfsInBrowser(at('a.zip'), secret)
    openIpfsInBrowser(at('a.zip'), secret)
    expect(h.confirms).toHaveLength(1)
    h.confirms[0]?.onCancel?.()
    await vi.waitFor(() => {
      openIpfsInBrowser(at('a.zip'), secret)
      expect(h.confirms).toHaveLength(2)
    })
  })
})

describe('приватная ссылка', () => {
  it('формат v2 расшифровывается потоком прямо в место сохранения', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.openIpfs.mockResolvedValue(fileEntity('BSTN-header', 'chunk1', 'chunk2'))
    h.decryptSecretStream.mockImplementation(async function* (
      key: string,
      input: AsyncIterable<Uint8Array>
    ) {
      expect(key).toBe('a2V5')
      for await (const piece of input)
        yield new TextEncoder().encode(new TextDecoder().decode(piece).toUpperCase())
    })

    openIpfsInBrowser(at(''), { key: 'a2V5', name: 'x.bin' }, 3 * 1024 ** 3)
    const confirm = await nextConfirm()
    await confirm.onOk()

    expect(h.decryptSecretFile).not.toHaveBeenCalled()
    expect(new TextDecoder().decode(Uint8Array.from(sink.written))).toBe('BSTN-HEADERCHUNK1CHUNK2')
    expect(sink.close).toHaveBeenCalled()
  })

  it('старый формат v1: шифртекст собирается целиком, расшифровывается и сохраняется под именем из ссылки', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.openIpfs.mockResolvedValue(fileEntity('cipher', 'text'))
    h.decryptSecretFile.mockResolvedValue(new TextEncoder().encode('plain'))

    openIpfsInBrowser(at(''), { key: 'a2V5', name: '../Отчёт.pdf' })
    const confirm = await nextConfirm()
    expect(confirm.title).toBe('header.ipfsWebPrivateTitle')
    await confirm.onOk()

    expect(h.openSaveSink).toHaveBeenCalledWith('Отчёт.pdf')
    const [key, blob] = h.decryptSecretFile.mock.calls[0] as [string, Uint8Array]
    expect(key).toBe('a2V5')
    expect(new TextDecoder().decode(blob)).toBe('ciphertext')
    expect(new TextDecoder().decode(Uint8Array.from(sink.written))).toBe('plain')
    expect(sink.close).toHaveBeenCalled()
  })

  it('неверный ключ — сообщение про ключ', async () => {
    h.openSaveSink.mockResolvedValue(makeSink())
    h.openIpfs.mockResolvedValue(fileEntity('x'))
    h.decryptSecretFile.mockRejectedValue(new SecretError('decrypt failed'))
    openIpfsInBrowser(at(''), { key: 'bad', name: 'a.txt' })
    await (await nextConfirm()).onOk()
    expect(h.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'header.ipfsDownloadFailedTitle',
        content: 'header.ipfsWebDecryptFailed',
      })
    )
  })
})

describe('webErrorText', () => {
  it('что случилось — по-человечески', () => {
    expect(webErrorText(new TransportError('timeout', 'x'), null)).toBe('header.ipfsNetNotFound')
    expect(webErrorText(new TransportError('network', 'x'), null)).toBe('header.ipfsNetFailed')
    expect(webErrorText(new NodeUnavailableError('x'), null)).toBe('header.ipfsNodeUnavailable')
    expect(webErrorText(new NameError('not-found', 'x'), null)).toBe('header.ipfsNameNotFound')
    expect(webErrorText(new NameError('invalid', 'x'), null)).toBe('header.ipfsNameInvalid')
    expect(webErrorText(new VerifyError('mismatch'), 'disk')).toBe('header.ipfsNetMismatch')
    expect(webErrorText(new VerifyError('missing'), 'disk')).toBe('header.ipfsNetIncomplete')
    expect(webErrorText(new VerifyError('not-found'), 'disk')).toBe('header.ipfsWebNotFound')
    expect(webErrorText(new VerifyError('unsupported'), 'disk')).toBe('header.ipfsWebUnsupported')
    expect(webErrorText(new VerifyError('malformed'), 'disk')).toBe('header.ipfsWebMalformed')
    expect(webErrorText(new VerifyError('directory'), 'disk')).toBe('header.ipfsWebDirectory')
  })

  it('«слишком большой»: у Blob — про браузер, у приватного — без чужого лимита', () => {
    const tooLarge = new VerifyError('too-large')
    expect(webErrorText(tooLarge, 'blob')).toBe('header.ipfsWebTooLargeForBrowser')
    expect(webErrorText(tooLarge, 'disk')).toBe('header.ipfsNetTooLarge')
    expect(webErrorText(tooLarge, 'blob', true)).toBe('header.ipfsNetTooLarge')
  })
})
