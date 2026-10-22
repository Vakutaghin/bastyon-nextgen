// «Следить за обновлениями»: перевод имени на новое содержимое замечается,
// повторная запись того же значения — нет; проверенная запись переиздаётся
// раз в 12 часов; под Tor в сеть ничего не уходит.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nameKey, signRecord } from '@/helpers/ipfs/ipns-names'

const ALICE = 'PQ8AiCHJaTZAThr2TnpkQYDEYTqULsMhCT'
const OWNER_KEY = new Uint8Array(32).fill(9)
const V1 = '/ipfs/bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm/a.pdf'
const V2 = '/ipfs/bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu/a v2.pdf'
const HOUR = 3600_000

const h = vi.hoisted(() => ({
  ipfs: { available: false, status: 'off', showTorBlocked: vi.fn() },
  tor: { enabled: false },
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => ({}) }))
vi.mock('@/stores/ipfs-store', () => ({ useIpfsStore: () => h.ipfs }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => h.tor }))

import { useIpnsFollowStore } from './ipns-follow-store'
import { BlockedByTorError } from './ipns-names-store'

const owner = nameKey(OWNER_KEY, 0)
const NAME = owner.publicKey.toName()
let current: Uint8Array | null = null
const puts: Uint8Array[] = []

async function routing(_input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (init?.method === 'PUT') {
    puts.push(init.body as Uint8Array)
    return new Response(null, { status: 200 })
  }
  return current
    ? new Response(current as Uint8Array<ArrayBuffer>, {
        headers: { 'Content-Type': 'application/vnd.ipfs.ipns-record' },
      })
    : new Response('routing: not found', { headers: { 'Content-Type': 'text/plain' } })
}

async function ownerPublishes(value: string, sequence: bigint) {
  current = (await signRecord(owner, value, sequence)).bytes
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  current = null
  puts.length = 0
  h.tor.enabled = false
  vi.stubGlobal('fetch', vi.fn(routing))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function store() {
  const follow = useIpnsFollowStore()
  follow.use(ALICE)
  return follow
}

describe('следить за постоянной ссылкой', () => {
  it('перевод на новое содержимое — уведомление; та же версия — нет', async () => {
    await ownerPublishes(V1, 1n)
    const follow = store()
    await follow.follow(NAME)
    expect(follow.isFollowed(NAME)).toBe(true)
    const now = Date.now()

    await ownerPublishes(V1, 2n)
    expect(await follow.check(now + HOUR)).toEqual([])
    await ownerPublishes(V2, 3n)
    expect(await follow.check(now + 2 * HOUR)).toEqual([{ name: NAME, value: V2 }])
    expect(await follow.check(now + 3 * HOUR)).toEqual([])
    expect(JSON.parse(localStorage.getItem(`BST_IPNS_FOLLOW_${ALICE}`) ?? '[]')[0]).toMatchObject({
      value: V2,
      sequence: '3',
    })
  })

  it('записи не было — первая версия не считается переводом', async () => {
    const follow = store()
    await follow.follow(NAME)
    await ownerPublishes(V1, 1n)
    expect(await follow.check(Date.now() + HOUR)).toEqual([])
  })

  it('проверка не чаще раза в час, переиздание — раз в 12 часов', async () => {
    await ownerPublishes(V1, 1n)
    const follow = store()
    await follow.follow(NAME)
    expect(puts).toHaveLength(1)
    const now = Date.now()
    vi.mocked(fetch).mockClear()
    await follow.check(now + 10 * 60_000)
    expect(fetch).not.toHaveBeenCalled()
    await follow.check(now + HOUR)
    expect(puts).toHaveLength(1)
    await follow.check(now + 13 * HOUR)
    expect(puts).toHaveLength(2)
    expect(puts[1]).toEqual(current)
  })

  it('под Tor — не следим и в сеть не ходим', async () => {
    const follow = store()
    h.tor.enabled = true
    await expect(follow.follow(NAME)).rejects.toBeInstanceOf(BlockedByTorError)
    expect(h.ipfs.showTorBlocked).toHaveBeenCalled()
    h.tor.enabled = false
    await follow.follow(NAME)
    h.tor.enabled = true
    vi.mocked(fetch).mockClear()
    expect(await follow.check(Date.now() + HOUR)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('«Не следить» — имя пропадает из списка', async () => {
    const follow = store()
    await follow.follow(NAME)
    follow.unfollow(NAME)
    expect(follow.isFollowed(NAME)).toBe(false)
    expect(localStorage.getItem(`BST_IPNS_FOLLOW_${ALICE}`)).toBe('[]')
  })
})
