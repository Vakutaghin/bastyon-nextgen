// Постоянные ссылки аккаунта на настоящих записях IPNS: delegated routing
// подменён словарём в памяти, который, как DHT, не берёт запись со старым
// номером. Проверяется, что номер имени не занимает чужое, имена с других
// устройств находятся, перевод с другого устройства не откатывается, а без
// своих имён и под Tor в сеть ничего не уходит.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nameKey, parseRecord, signRecord } from '@/helpers/ipfs/ipns-names'

const ALICE = 'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT'
const ACCOUNT_KEY = new Uint8Array(32).fill(7)
const CID_A = 'bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm'
const CID_B = 'bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu'
const DAY = 86_400_000

const h = vi.hoisted(() => ({
  auth: { getUserAddress: '' as string | null, getKeyPair: null as unknown },
  ipfs: { available: false, status: 'off', showTorBlocked: vi.fn() },
  tor: { enabled: false },
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.ipfs }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => h.tor }))

import { BlockedByTorError, RENEW_EVERY_MS, useIpnsNamesStore } from './ipns-names-store'

/** delegated routing: имя → байты записи. */
const network = new Map<string, Uint8Array>()
const puts: string[] = []
let offline = false

async function routing(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (offline) throw new TypeError('Failed to fetch')
  const name = String(input).split('/routing/v1/ipns/')[1]?.split('?')[0] ?? ''
  if (init?.method === 'PUT') {
    const bytes = init.body as Uint8Array
    const incoming = await parseRecord(name, bytes)
    const stored = network.get(name)
    if (stored && (await parseRecord(name, stored)).sequence > incoming.sequence) {
      return new Response('older record', { status: 400 })
    }
    network.set(name, bytes)
    puts.push(name)
    return new Response(null, { status: 200 })
  }
  const bytes = network.get(name)
  return bytes
    ? new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: { 'Content-Type': 'application/vnd.ipfs.ipns-record' },
      })
    : new Response('routing: not found', { headers: { 'Content-Type': 'text/plain' } })
}

const nameOf = (index: number) => nameKey(ACCOUNT_KEY, index).publicKey.toName()
/** Запись, опубликованная «с другого устройства». */
async function publishedElsewhere(index: number, value: string, sequence: bigint, now?: number) {
  const record = await signRecord(nameKey(ACCOUNT_KEY, index), value, sequence, now)
  network.set(record.name, record.bytes)
  return record
}
const networkValue = async (index: number) =>
  parseRecord(nameOf(index), network.get(nameOf(index)) as Uint8Array)

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  network.clear()
  puts.length = 0
  offline = false
  h.tor.enabled = false
  h.ipfs.showTorBlocked.mockClear()
  h.auth.getUserAddress = ALICE
  h.auth.getKeyPair = { privateKey: Buffer.from(ACCOUNT_KEY) }
  vi.stubGlobal('fetch', vi.fn(routing))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function store() {
  const names = useIpnsNamesStore()
  names.use(ALICE)
  return names
}

describe('постоянные ссылки', () => {
  it('новое имя — номер 0, запись в сети, список на устройстве', async () => {
    const names = store()
    const entry = await names.create(`/ipfs/${CID_A}/a.pdf`)
    expect(entry).toMatchObject({ index: 0, name: nameOf(0), sequence: '1' })
    expect((await networkValue(0)).value).toBe(`/ipfs/${CID_A}/a.pdf`)
    const saved = JSON.parse(localStorage.getItem(`BST_IPNS_NAMES_${ALICE}`) ?? '{}')
    expect(saved.names).toEqual([expect.objectContaining({ index: 0, name: nameOf(0) })])
  })

  it('номер, занятый на другом устройстве, не перезаписывается', async () => {
    await publishedElsewhere(0, `/ipfs/${CID_B}/other.zip`, 3n)
    const names = store()
    const entry = await names.create(`/ipfs/${CID_A}/a.pdf`)
    expect(entry.index).toBe(1)
    expect((await networkValue(0)).value).toBe(`/ipfs/${CID_B}/other.zip`)
    expect(names.names.map((n) => n.index)).toEqual([0, 1])
  })

  it('сверка находит имена с других устройств и свежие значения своих', async () => {
    const names = store()
    await names.create(`/ipfs/${CID_A}/a.pdf`)
    await publishedElsewhere(0, `/ipfs/${CID_B}/a v2.pdf`, 4n)
    await publishedElsewhere(1, `/ipfs/${CID_A}/b.pdf`, 1n)
    await publishedElsewhere(3, `/ipfs/${CID_A}/far.pdf`, 1n)
    await names.sync()
    expect(names.names.map((n) => [n.index, n.value])).toEqual([
      [0, `/ipfs/${CID_B}/a v2.pdf`],
      [1, `/ipfs/${CID_A}/b.pdf`],
    ])
  })

  it('перевод на новую версию — номер выше, чем у записи в сети', async () => {
    const names = store()
    await names.create(`/ipfs/${CID_A}/a.pdf`)
    await publishedElsewhere(0, `/ipfs/${CID_A}/a.pdf`, 5n)
    const entry = await names.point(0, `/ipfs/${CID_B}/a v2.pdf`)
    expect(entry.sequence).toBe('6')
    expect(await networkValue(0)).toMatchObject({ value: `/ipfs/${CID_B}/a v2.pdf`, sequence: 6n })
  })

  it('переиздание: свежая запись — как есть, старая — с новой подписью, не чаще 12 часов', async () => {
    const now = Date.now()
    const names = store()
    await names.create(`/ipfs/${CID_A}/a.pdf`)
    const fresh = network.get(nameOf(0))
    puts.length = 0

    await names.renew(now + DAY)
    expect(puts).toEqual([nameOf(0)])
    expect(network.get(nameOf(0))).toEqual(fresh)

    await names.renew(now + DAY + RENEW_EVERY_MS - 1)
    expect(puts).toHaveLength(1)

    await names.renew(now + 20 * DAY)
    expect(await networkValue(0)).toMatchObject({ value: `/ipfs/${CID_A}/a.pdf`, sequence: 2n })
  })

  it('переиздание не откатывает имя, переведённое с другого устройства', async () => {
    const now = Date.now()
    const names = store()
    await names.create(`/ipfs/${CID_A}/a.pdf`)
    await publishedElsewhere(0, `/ipfs/${CID_B}/v3.pdf`, 9n, now - 20 * DAY)
    await names.renew(now)
    expect(await networkValue(0)).toMatchObject({ value: `/ipfs/${CID_B}/v3.pdf`, sequence: 10n })
    expect(names.names[0]).toMatchObject({ value: `/ipfs/${CID_B}/v3.pdf`, sequence: '10' })
  })

  it('без сети имя ждёт следующей проверки, а не 12 часов', async () => {
    const now = Date.now()
    const names = store()
    await names.create(`/ipfs/${CID_A}/a.pdf`)
    offline = true
    await names.renew(now + DAY)
    expect(names.renewedAt).toBe(0)
    offline = false
    puts.length = 0
    await names.renew(now + DAY + 3600_000)
    expect(puts).toEqual([nameOf(0)])
  })

  it('без своих имён, под Tor и с чужим аккаунтом в сеть ничего не уходит', async () => {
    const names = store()
    await names.renew()
    await names.sync()
    expect(fetch).toHaveBeenCalledTimes(1) // sync: номер 0 пуст

    vi.mocked(fetch).mockClear()
    h.tor.enabled = true
    await expect(names.create(`/ipfs/${CID_A}/a.pdf`)).rejects.toBeInstanceOf(BlockedByTorError)
    expect(h.ipfs.showTorBlocked).toHaveBeenCalled()
    await names.sync()
    expect(fetch).not.toHaveBeenCalled()

    h.tor.enabled = false
    h.auth.getUserAddress = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
    await names.sync()
    await expect(names.create(`/ipfs/${CID_A}/a.pdf`)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
