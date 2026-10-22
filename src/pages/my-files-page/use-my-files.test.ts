// Страница «Мои файлы»: что загружается при открытии и смене аккаунта,
// раздаются ли файлы сейчас, копирование ссылки, снятие с раздачи, опрос
// статусов, пока сервис копирует файлы, и постоянные ссылки.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

const ALICE = 'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

const h = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  names: null as unknown as Record<string, unknown>,
  auth: null as unknown as { address: string | null },
  copyText: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn() },
  confirm: vi.fn(),
  publish: vi.fn(async () => []),
}))

vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('@/stores/ipns-names-store', () => ({
  useIpnsNamesStore: () => h.names,
  BlockedByTorError: class BlockedByTorError extends Error {},
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: h.copyText }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: h.confirm } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/composables/use-ipfs-share', () => ({
  useIpfsShare: () => ({ share: h.publish, sharing: { value: false } }),
}))

import { BlockedByTorError } from '@/stores/ipns-names-store'
import { useMyFiles, type MyFiles } from './use-my-files'

const file = { cid: 'bafydir', name: 'a b.pdf', size: 10, addedAt: 1 }
const v2 = { cid: 'bafydir2', name: 'a b v2.pdf', size: 12, addedAt: 2 }
const secret = { cid: 'bafysecret', name: 's.pdf', size: 5, addedAt: 3, key: 'k' }
const NAME = 'k51qzi5uqu5dkxmzvkhc42poz8bqi5t742v6qda52xv7c4ff115356d77amfwc'
const own = (value: string, index = 0) => ({
  index,
  name: NAME,
  value,
  sequence: '1',
  updatedAt: 5,
})

function makeNames() {
  const names = reactive({
    account: '',
    names: [] as ReturnType<typeof own>[],
    use: vi.fn((account: string) => {
      names.account = account
    }),
    sync: vi.fn(async () => undefined),
    create: vi.fn(async (value: string) => {
      const entry = own(value)
      names.names = [entry]
      return entry
    }),
    point: vi.fn(async (index: number, value: string) => own(value, index)),
  })
  return names
}

function makeStore() {
  const store = reactive({
    available: true,
    status: 'running',
    busy: false,
    installed: true,
    pinServiceConfigured: false,
    shares: [] as (typeof file)[],
    sharesAccount: '',
    remoteStatus: {} as Record<string, string>,
    hydrate: vi.fn(async () => undefined),
    refreshPinService: vi.fn(async () => undefined),
    loadShares: vi.fn(async (account: string) => {
      store.shares = account === ALICE ? [file] : []
      store.sharesAccount = account
    }),
    refreshShareStatus: vi.fn(async () => undefined),
    unshare: vi.fn(async () => undefined),
    pinRemote: vi.fn(async () => undefined),
    enable: vi.fn(async () => undefined),
    openPinConfig: vi.fn(),
  })
  return store
}

let files: MyFiles
function mountPage() {
  return mount(
    defineComponent({
      setup() {
        files = useMyFiles()
        return () => null
      },
    })
  )
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  h.store = makeStore()
  h.names = makeNames()
  h.auth = reactive({ address: ALICE })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMyFiles', () => {
  it('при открытии — список аккаунта; при смене аккаунта — список нового', async () => {
    mountPage()
    await flush()
    expect(h.store.loadShares).toHaveBeenCalledWith(ALICE)
    expect(files.files.value).toEqual([file])
    expect(files.loading.value).toBe(false)

    h.auth.address = BOB
    await flush()
    expect(h.store.loadShares).toHaveBeenLastCalledWith(BOB)
    expect(files.files.value).toEqual([])
  })

  it('раздаётся ли сейчас: нода работает, запускается, остановлена, не установлена', async () => {
    mountPage()
    const store = h.store as ReturnType<typeof makeStore>
    expect(files.node.value).toBe('running')
    store.status = 'starting'
    store.busy = true
    expect(files.node.value).toBe('starting')
    store.status = 'off'
    store.busy = false
    expect(files.node.value).toBe('stopped')
    store.installed = false
    expect(files.node.value).toBe('missing')
  })

  it('«Скопировать ссылку» — ссылка с именем файла, тост', async () => {
    mountPage()
    await files.copyLink(file)
    expect(h.copyText).toHaveBeenCalledWith('ipfs://bafydir/a%20b.pdf#size=10')
    expect(h.toast.success).toHaveBeenCalledWith({ message: 'myFiles.linkCopied' })
  })

  it('«Перестать раздавать» — после подтверждения, от имени текущего аккаунта', async () => {
    mountPage()
    files.confirmUnshare(file)
    const [opts] = h.confirm.mock.calls[0] as [{ content: string; onOk: () => Promise<void> }]
    expect(opts.content).toBe('myFiles.unshareContent')
    expect(h.store.unshare).not.toHaveBeenCalled()
    await opts.onOk()
    expect(h.store.unshare).toHaveBeenCalledWith(ALICE, 'bafydir')
  })

  it('на сервис можно отправить новый файл и тот, что сервис не сохранил', async () => {
    const store = h.store as ReturnType<typeof makeStore>
    mountPage()
    await flush()
    expect(files.canSendToService(file)).toBe(false)

    store.pinServiceConfigured = true
    expect(files.canSendToService(file)).toBe(true)
    for (const [status, can] of [
      ['queued', false],
      ['pinning', false],
      ['pinned', false],
      ['failed', true],
    ] as const) {
      store.remoteStatus = { bafydir: status }
      expect(files.canSendToService(file)).toBe(can)
    }
  })

  it('пока сервис копирует файлы, статусы опрашиваются; дальше — нет', async () => {
    vi.useFakeTimers()
    const store = h.store as ReturnType<typeof makeStore>
    store.pinServiceConfigured = true
    mountPage()
    await flush()
    store.refreshShareStatus.mockClear()

    store.remoteStatus = { bafydir: 'pinning' }
    await flush()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.refreshShareStatus).toHaveBeenCalledWith(ALICE)

    store.remoteStatus = { bafydir: 'pinned' }
    await flush()
    store.refreshShareStatus.mockClear()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.refreshShareStatus).not.toHaveBeenCalled()
    expect(files.remoteStatus(file)).toBe('pinned')
  })

  describe('постоянные ссылки', () => {
    it('при открытии — имена аккаунта с устройства и сверка с сетью фоном', async () => {
      mountPage()
      await flush()
      expect(h.names.use).toHaveBeenCalledWith(ALICE)
      expect(h.names.sync).toHaveBeenCalled()
    })

    it('«Постоянная ссылка» у файла: имя ведёт прямо на файл, потом — тот же диалог', async () => {
      const store = h.store as ReturnType<typeof makeStore>
      mountPage()
      await flush()
      store.shares = [file, v2, secret]
      expect(files.publicFiles.value).toEqual([file, v2])

      await files.openPermanent(file)
      expect(h.names.create).toHaveBeenCalledWith('/ipfs/bafydir/a b.pdf')
      expect(files.dialog.value?.value).toBe('/ipfs/bafydir/a b.pdf')
      expect(files.permanentOf(file)?.name).toBe(NAME)
      expect(files.targetOf(own('/ipfs/bafydir/a b.pdf'))).toBe('a b.pdf')

      files.dialog.value = null
      await files.openPermanent(file)
      expect(h.names.create).toHaveBeenCalledTimes(1)
      expect(files.dialog.value).toMatchObject({ name: NAME })
    })

    it('«Обновить на новую версию» — имя ведёт на другой файл, тост', async () => {
      mountPage()
      await flush()
      await files.pointPermanent(own('/ipfs/bafydir/a b.pdf', 3), v2)
      expect(h.names.point).toHaveBeenCalledWith(3, '/ipfs/bafydir2/a b v2.pdf')
      expect(files.dialog.value?.value).toBe('/ipfs/bafydir2/a b v2.pdf')
      expect(h.toast.success).toHaveBeenCalledWith({ message: 'myFiles.permanent.updated' })
    })

    it('файла, на который ведёт имя, уже нет — видно имя из пути', async () => {
      mountPage()
      await flush()
      const gone = own('/ipfs/bafygone/old.zip')
      expect(files.targetOf(gone)).toBe('old.zip')
      expect(files.targetShared(gone)).toBe(false)
      expect(files.targetOf(own('/ipfs/bafygone'))).toBe('bafygone')
    })

    it('не вышло — тост с ошибкой; под Tor тоста нет: показано окно про Tor', async () => {
      mountPage()
      await flush()
      const names = h.names as ReturnType<typeof makeNames>
      names.create.mockRejectedValueOnce(new Error('offline'))
      await files.openPermanent(file)
      expect(h.toast.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'myFiles.permanent.createFailed' })
      )
      h.toast.error.mockClear()
      names.create.mockRejectedValueOnce(new BlockedByTorError())
      await files.openPermanent(file)
      expect(h.toast.error).not.toHaveBeenCalled()
      expect(files.naming.value).toBe(false)
    })
  })
})
