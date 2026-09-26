// Страница «Мои файлы»: что загружается при открытии и смене аккаунта,
// раздаются ли файлы сейчас, копирование ссылки, снятие с раздачи и опрос
// статусов, пока сервис копирует файлы.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

const ALICE = 'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

const h = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  auth: null as unknown as { address: string | null },
  copyText: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn() },
  confirm: vi.fn(),
  publish: vi.fn(async () => null),
}))

vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.store }))
vi.mock('@/blockchain', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: h.copyText }))
vi.mock('@/b-components/app-toast', () => ({ appToast: h.toast }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: h.confirm } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/composables/use-ipfs-share', () => ({
  useIpfsShare: () => ({ share: h.publish, sharing: { value: false } }),
}))

import { useMyFiles, type MyFiles } from './use-my-files'

const file = { cid: 'bafydir', name: 'a b.pdf', size: 10, addedAt: 1 }

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
})
