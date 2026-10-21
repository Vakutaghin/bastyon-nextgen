// Окно просмотра IPFS без своей ноды: картинка показывается из проверенных
// байт, файл без показа предлагается скачать, папка — списком с переходом
// внутрь и назад, ошибки — словами. Узел IPFS подменён: сеть здесь не нужна.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({
  openIpfs: vi.fn(),
  listDirectory: vi.fn(),
  statEntry: vi.fn(),
  loadIpfsNode: vi.fn(),
  openExternal: vi.fn(async () => true),
  openSaveSink: vi.fn(),
}))

vi.mock('@/helpers/ipfs/ipfs-node-loader', () => ({ loadIpfsNode: h.loadIpfsNode }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: h.openExternal }))
vi.mock('@/helpers/ipfs/ipfs-save-sinks', () => ({
  MAX_FILE_BYTES: 4 * 1024 ** 3,
  openSaveSink: h.openSaveSink,
}))

import { NodeUnavailableError, TransportError } from '@/helpers/ipfs/ipfs-errors'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'
import { useIpfsNodeViewerStore } from '@/stores/ipfs-node-viewer-store'
import IpfsNodeViewer from './ipfs-node-viewer.vue'

const ROOT = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

let wrapper: VueWrapper | null = null

const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const buttons = () => [...document.body.querySelectorAll('button')]
const button = (label: string) =>
  buttons().find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined

function file(...parts: Uint8Array[]) {
  return {
    entity: {
      kind: 'file' as const,
      size: parts.reduce((n, p) => n + p.length, 0),
      chunks: (async function* () {
        yield* parts
      })(),
    },
    name: null,
    source: {},
  }
}

async function open(target: IpfsTarget): Promise<void> {
  const viewer = useIpfsNodeViewerStore()
  viewer.show(target)
  if (!wrapper) {
    wrapper = mount(IpfsNodeViewer, { attachTo: document.body, global: { plugins: [i18n] } })
  }
  await flushPromises()
  await flushPromises()
}

describe('IpfsNodeViewer', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    h.loadIpfsNode.mockResolvedValue({
      openIpfs: h.openIpfs,
      listDirectory: h.listDirectory,
      statEntry: h.statEntry,
    })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
    globalThis.URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('картинка — сразу в окне, из скачанных и проверенных байт', async () => {
    h.openIpfs.mockResolvedValue(file(PNG.subarray(0, 8), PNG.subarray(8)))
    await open({ namespace: 'ipfs', root: ROOT, path: 'cat.png' })
    const img = document.body.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:preview')
    expect(img.alt).toBe('cat.png')
    expect(text()).toContain(`ipfs://${ROOT}/cat.png`)
    expect(button('Скачать')).toBeTruthy()
  })

  it('архив не показывается: имя, размер и «Скачать»; качается только по кнопке', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])
    h.openIpfs.mockResolvedValue(file(zip))
    await open({ namespace: 'ipfs', root: ROOT, path: 'build.zip' })
    expect(document.body.querySelector('img')).toBeNull()
    expect(text()).toContain('build.zip')
    expect(text()).toContain('Такие файлы здесь не показываются')
    // Узел остановлен: сигнал открытия отменён, дальше файл не качается.
    const [, opts] = h.openIpfs.mock.calls[0] as [IpfsTarget, { signal: AbortSignal }]
    expect(opts.signal.aborted).toBe(true)
    expect(button('Скачать')).toBeTruthy()
  })

  it('папка — список; запись открывается внутри окна, «Назад» возвращает', async () => {
    const cid = { code: 0x70 }
    h.openIpfs.mockResolvedValueOnce({
      entity: { kind: 'directory', cid },
      name: null,
      source: {},
    })
    h.listDirectory.mockResolvedValue({
      entries: [
        { name: 'docs', cid, size: 900 },
        { name: 'index.html', cid, size: 12 },
      ],
      truncated: false,
    })
    h.statEntry.mockImplementation(async (_s: unknown, e: { name: string }) =>
      e.name === 'docs' ? { kind: 'directory' } : { kind: 'file', size: 12 }
    )
    await open({ namespace: 'ipfs', root: ROOT, path: '' })
    expect(text()).toContain('docs')
    expect(text()).toContain('Это сайт')
    expect(button('Открыть сайт')).toBeTruthy()

    h.openIpfs.mockResolvedValueOnce(file(new TextEncoder().encode('<h1>hi</h1>')))
    button('index.html')?.click()
    await flushPromises()
    await flushPromises()
    expect(h.openIpfs).toHaveBeenLastCalledWith(
      { namespace: 'ipfs', root: ROOT, path: 'index.html' },
      expect.anything()
    )
    // HTML — текстом, не страницей.
    expect(document.body.querySelector('pre')?.textContent).toBe('<h1>hi</h1>')

    button('Назад')?.click()
    await flushPromises()
    expect(h.openIpfs).toHaveBeenLastCalledWith(
      { namespace: 'ipfs', root: ROOT, path: '' },
      expect.anything()
    )
  })

  it('сайт открывается в браузере через inbrowser.link — прямо по клику', async () => {
    h.openIpfs.mockResolvedValue({
      entity: { kind: 'directory', cid: { code: 0x70 } },
      name: null,
      source: {},
    })
    h.listDirectory.mockResolvedValue({ entries: [], truncated: false })
    await open({ namespace: 'ipns', root: 'docs.ipfs.tech', path: '' })
    button('Открыть в браузере')?.click()
    expect(h.openExternal).toHaveBeenCalledWith('https://inbrowser.link/ipns/docs.ipfs.tech')
  })

  it('в сети не нашлось — так и сказано', async () => {
    h.openIpfs.mockRejectedValue(new TransportError('timeout', 'no providers'))
    await open({ namespace: 'ipfs', root: ROOT, path: '' })
    expect(text()).toContain('В сети IPFS не нашлось')
  })

  it('узел здесь не запускается — предлагаем браузер', async () => {
    h.loadIpfsNode.mockRejectedValue(new NodeUnavailableError('no WebRTC'))
    await open({ namespace: 'ipfs', root: ROOT, path: '' })
    expect(text()).toContain('узел IPFS не запускается')
    expect(button('Открыть в браузере')).toBeTruthy()
  })

  it('имя IPNS: видно, куда ведёт', async () => {
    h.openIpfs.mockResolvedValue({
      ...file(new TextEncoder().encode('hello')),
      name: {
        kind: 'ipns',
        name: 'k51qzi5uqu5d',
        value: `/ipfs/${ROOT}`,
        validUntil: null,
      },
    })
    await open({ namespace: 'ipns', root: 'k51qzi5uqu5d', path: 'a.txt' })
    expect(text()).toContain(`Имя ведёт на /ipfs/${ROOT}`)
    expect(document.body.querySelector('pre')?.textContent).toBe('hello')
  })
})
