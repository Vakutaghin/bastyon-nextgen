// Клик по IPFS-ссылке в браузере и на телефоне: что открывается сразу, что
// после первых байт, что скачивается с проверкой, и что видит пользователь при
// ошибке или отмене.

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
  openExternal: vi.fn(async () => true),
  inspectEntity: vi.fn(),
  fetchVerifiedEntity: vi.fn(),
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
vi.mock('@/helpers/common/open-external', () => ({ openExternal: h.openExternal }))
vi.mock('@/b-components/messenger/components/file-message/helpers', () => ({
  formatFileSize: (n: number) => `${n} B`,
}))
vi.mock('@/helpers/ipfs/ipfs-gateway-car', () => ({
  inspectEntity: h.inspectEntity,
  fetchVerifiedEntity: h.fetchVerifiedEntity,
}))
vi.mock('@/helpers/ipfs/ipfs-save-sinks', () => ({ openSaveSink: h.openSaveSink }))
vi.mock('@/helpers/ipfs/ipfs-secret', () => ({
  decryptSecretFile: h.decryptSecretFile,
  decryptSecretStream: h.decryptSecretStream,
  // Формат v2 узнаётся по заголовку «BSTN».
  isStreamFormat: (head: Uint8Array) => new TextDecoder().decode(head.subarray(0, 4)) === 'BSTN',
}))

import { openIpfsInBrowser, webErrorText } from './ipfs-browser-open'
import { GatewayError, SecretError, TransportError, VerifyError } from '@/helpers/ipfs/ipfs-errors'
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
    kind: 'file' as const,
    size: parts.reduce((n, p) => n + p.length, 0),
    chunks: (async function* () {
      yield* parts
    })(),
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

describe('решение без сети — прямо в обработчике клика', () => {
  it('IPNS — сразу вкладка со шлюзом: подпись имени не проверить', () => {
    openIpfsInBrowser({ namespace: 'ipns', root: 'docs.ipfs.tech', path: 'index.html' }, null)
    expect(h.openExternal).toHaveBeenCalledWith('https://dweb.link/ipns/docs.ipfs.tech/index.html')
  })

  it('картинка по имени — вкладка открывается синхронно, без запросов', () => {
    openIpfsInBrowser(at('photos/cat.jpg'), null)
    expect(h.openExternal).toHaveBeenCalledWith(`https://dweb.link/ipfs/${ROOT}/photos/cat.jpg`)
    expect(h.inspectEntity).not.toHaveBeenCalled()
  })

  it('архив по имени — сразу окно «Скачать?»', () => {
    openIpfsInBrowser(at('build/app.tar.gz'), null)
    expect(h.confirms[0]?.title).toBe('header.ipfsWebDownloadTitle')
    expect(h.openExternal).not.toHaveBeenCalled()
    expect(h.inspectEntity).not.toHaveBeenCalled()
    h.confirms[0]?.onCancel?.()
  })
})

describe('скачивание', () => {
  it('«Скачать» — место сохранения, проверенные куски в файл, сообщение об успехе', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.fetchVerifiedEntity.mockResolvedValue(fileEntity('PK', '\x03\x04rest'))

    openIpfsInBrowser(at('build/app%20v2.zip'), null)
    await (await nextConfirm()).onOk()

    expect(h.openSaveSink).toHaveBeenCalledWith('app v2.zip')
    expect(h.update).toHaveBeenCalledWith({ title: 'header.ipfsWebDownloadingTitle' })
    expect(h.fetchVerifiedEntity.mock.calls[0]?.[1]).toMatchObject({ maxBytes: sink.maxBytes })
    expect(new TextDecoder().decode(Uint8Array.from(sink.written))).toBe('PK\x03\x04rest')
    expect(sink.close).toHaveBeenCalled()
    expect(h.success).toHaveBeenCalled()
  })

  it('на телефоне итог — «Поделиться», без отдельного сообщения', async () => {
    h.openSaveSink.mockResolvedValue(makeSink('share'))
    h.fetchVerifiedEntity.mockResolvedValue(fileEntity('data'))
    openIpfsInBrowser(at('a.zip'), null)
    await (await nextConfirm()).onOk()
    expect(h.success).not.toHaveBeenCalled()
  })

  it('закрыли диалог сохранения — ничего не качаем', async () => {
    h.openSaveSink.mockResolvedValue(null)
    openIpfsInBrowser(at('a.zip'), null)
    await (await nextConfirm()).onOk()
    expect(h.fetchVerifiedEntity).not.toHaveBeenCalled()
  })

  it('ошибка шлюза — понятное сообщение, недокачанное удаляется', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.fetchVerifiedEntity.mockRejectedValue(new GatewayError(504))
    openIpfsInBrowser(at('a.zip'), null)
    await (await nextConfirm()).onOk()
    expect(sink.abort).toHaveBeenCalled()
    expect(h.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'header.ipfsDownloadFailedTitle',
        content: 'header.ipfsWebGatewayMissing',
      })
    )
  })

  it('«Отмена» посреди скачивания — запрос обрывается, без сообщения об ошибке', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.fetchVerifiedEntity.mockImplementation(
      (_t: IpfsTarget, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    )
    openIpfsInBrowser(at('a.zip'), null)
    const confirm = await nextConfirm()
    const running = confirm.onOk()
    await vi.waitFor(() => expect(h.fetchVerifiedEntity).toHaveBeenCalled())
    confirm.onCancel?.()
    await running
    expect(sink.abort).toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
  })

  it('повторный клик, пока первый не закончен, второго окна не открывает', async () => {
    openIpfsInBrowser(at('a.zip'), null)
    openIpfsInBrowser(at('a.zip'), null)
    expect(h.confirms).toHaveLength(1)
    h.confirms[0]?.onCancel?.()
    await vi.waitFor(() => {
      openIpfsInBrowser(at('a.zip'), null)
      expect(h.confirms).toHaveLength(2)
    })
  })
})

describe('тип неизвестен — смотрим первые байты', () => {
  it('голый CID с картинкой — окно «Открыть» (жест для новой вкладки)', async () => {
    h.inspectEntity.mockResolvedValue({
      kind: 'file',
      size: 10,
      head: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
    })
    openIpfsInBrowser(at(''), null)
    const offer = await nextConfirm()
    expect(offer.title).toBe('header.ipfsWebOpenTitle')
    expect(h.hide).toHaveBeenCalled()
    offer.onOk()
    expect(h.openExternal).toHaveBeenCalledWith(`https://dweb.link/ipfs/${ROOT}`)
  })

  it('голый CID с архивом — «Скачать?» с размером и именем по типу', async () => {
    h.inspectEntity.mockResolvedValue({
      kind: 'file',
      size: 2048,
      head: Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
    })
    h.openSaveSink.mockResolvedValue(null)
    openIpfsInBrowser(at(''), null)
    const confirm = await nextConfirm()
    expect(confirm.title).toBe('header.ipfsWebDownloadTitle')
    await confirm.onOk()
    expect(h.openSaveSink).toHaveBeenCalledWith(`${ROOT.slice(0, 16)}.zip`)
  })

  it('каталог (сайт) — окно «Открыть»', async () => {
    h.inspectEntity.mockResolvedValue({ kind: 'directory' })
    openIpfsInBrowser(at('site'), null)
    expect((await nextConfirm()).title).toBe('header.ipfsWebOpenTitle')
  })

  it('не нашёлся в сети — сообщение, а не вечная загрузка', async () => {
    h.inspectEntity.mockRejectedValue(new TransportError('timeout', 'silent'))
    openIpfsInBrowser(at(''), null)
    await vi.waitFor(() =>
      expect(h.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'header.ipfsDownloadFailedTitle',
          content: 'header.ipfsWebGatewayMissing',
        })
      )
    )
    expect(h.hide).toHaveBeenCalled()
  })
})

describe('приватная ссылка', () => {
  it('формат v2 расшифровывается потоком прямо в место сохранения', async () => {
    const sink = makeSink()
    h.openSaveSink.mockResolvedValue(sink)
    h.fetchVerifiedEntity.mockResolvedValue(fileEntity('BSTN-header', 'chunk1', 'chunk2'))
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
    h.fetchVerifiedEntity.mockResolvedValue(fileEntity('cipher', 'text'))
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
    h.fetchVerifiedEntity.mockResolvedValue(fileEntity('x'))
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
    expect(webErrorText(new GatewayError(429), null)).toBe('header.ipfsWebGatewayBusy')
    expect(webErrorText(new GatewayError(404), null)).toBe('header.ipfsWebNotFound')
    expect(webErrorText(new TransportError('network', 'x'), null)).toBe('header.ipfsWebNetwork')
    expect(webErrorText(new VerifyError('mismatch'), 'disk')).toBe('header.ipfsVerifyMismatch')
    expect(webErrorText(new VerifyError('missing'), 'disk')).toBe('header.ipfsWebIncomplete')
    expect(webErrorText(new VerifyError('unsupported'), 'disk')).toBe('header.ipfsWebUnsupported')
    expect(webErrorText(new VerifyError('malformed'), 'disk')).toBe('header.ipfsWebMalformed')
    expect(webErrorText(new VerifyError('directory'), 'disk')).toBe('header.ipfsWebDirectory')
  })

  it('«слишком большой»: у Blob — про браузер, у приватного — без чужого лимита', () => {
    const tooLarge = new VerifyError('too-large')
    expect(webErrorText(tooLarge, 'blob')).toBe('header.ipfsWebTooLargeForBrowser')
    expect(webErrorText(tooLarge, 'disk')).toBe('header.ipfsWebTooLarge')
    expect(webErrorText(tooLarge, 'blob', true)).toBe('header.ipfsWebTooLarge')
  })
})
