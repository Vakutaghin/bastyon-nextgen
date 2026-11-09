// Порядок списков подписчиков и подписок и запрос поиска: нода отдаёт в
// строках репутацию ×10 и высоту блока подписки, по ним и сортируем. Плюс сам
// список: какой RPC уходит, скрытые и дубли, видимый срез и «показать ещё»,
// профили только для среза, поиск по адресу и догруженным никам, смена профиля.

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'

interface RpcParams {
  method: string
  parameters: unknown[]
  options?: Record<string, unknown>
}

const node = vi.hoisted(() => ({
  subscribers: {} as Record<string, unknown[]>,
  subscribes: {} as Record<string, unknown[]>,
  profiles: {} as Record<string, Record<string, unknown>>,
  /** Все запросы к ноде — по ним проверяем, что и с какими параметрами ушло. */
  calls: [] as RpcParams[],
  /** Подмена ответа на конкретный запрос (задержка, ошибка). */
  override: null as null | ((p: RpcParams) => Promise<unknown> | undefined),
}))

function answer(p: RpcParams): Promise<unknown> {
  node.calls.push(p)
  const custom = node.override?.(p)
  if (custom) return custom
  const [first] = p.parameters
  switch (p.method) {
    case 'getusersubscribers':
      return Promise.resolve(node.subscribers[first as string] ?? [])
    case 'getusersubscribes':
      return Promise.resolve(node.subscribes[first as string] ?? [])
    case 'getuserprofile':
      return Promise.resolve(
        (first as string[]).map((a) => node.profiles[a]).filter((x) => x !== undefined)
      )
    default:
      return Promise.reject(new Error(`unexpected ${p.method}`))
  }
}

vi.mock('@/helpers/api/request', () => ({
  rpcCall: (p: RpcParams) => answer(p),
  getByPRC: (p: RpcParams) => answer(p),
}))

import { __resetUserNamesForTests } from '@/services/user-names'
import {
  normalizeRelationQuery,
  sortRelations,
  useFollowersList,
  type RelationListType,
  type RelationSort,
} from './use-followers-list'

const row = (address: string, reputation: number | null, height: number) => ({
  address,
  reputation,
  height,
})

describe('sortRelations', () => {
  const list = [row('A', 5, 100), row('B', 300, 50), row('C', null, 200), row('D', 300, 70)]

  it('сначала новые — по высоте блока подписки', () => {
    expect(sortRelations(list, 'new').map((r) => r.address)).toEqual(['C', 'A', 'D', 'B'])
  })

  it('по репутации; при равной — кто подписался позже; без репутации — в конце', () => {
    expect(sortRelations(list, 'reputation').map((r) => r.address)).toEqual(['D', 'B', 'A', 'C'])
  })

  it('без высот порядок ноды сохраняется', () => {
    const flat = [row('X', 1, 0), row('Y', 1, 0), row('Z', 1, 0)]
    expect(sortRelations(flat, 'new').map((r) => r.address)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('normalizeRelationQuery', () => {
  it('без пробелов по краям, @ и регистра', () => {
    expect(normalizeRelationQuery('  @@Anna_NG ')).toBe('anna_ng')
    expect(normalizeRelationQuery('   ')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// useFollowersList
// ---------------------------------------------------------------------------

const mounted: Array<{ unmount: () => void }> = []

interface ListInputs {
  address?: string
  type?: RelationListType
  visible?: number
  enabled?: boolean
  hidden?: string[]
  sort?: RelationSort
  query?: string
}

function list(inputs: ListInputs = {}) {
  const refs = {
    address: ref(inputs.address ?? 'POwner'),
    type: ref<RelationListType>(inputs.type ?? 'followers'),
    visible: ref(inputs.visible ?? 20),
    enabled: ref(inputs.enabled ?? true),
    hidden: ref<string[]>(inputs.hidden ?? []),
    sort: ref<RelationSort>(inputs.sort ?? 'new'),
    query: ref(inputs.query ?? ''),
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let api!: ReturnType<typeof useFollowersList>
  const harness = defineComponent({
    setup() {
      api = useFollowersList(
        refs.address,
        refs.type,
        refs.visible,
        refs.enabled,
        refs.hidden as Ref<readonly string[]>,
        refs.sort,
        refs.query
      )
      return () => h('div')
    },
  })
  mounted.push(mount(harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { api, ...refs }
}

const addresses = (rows: Array<{ address: string }>) => rows.map((r) => r.address)
const callsOf = (method: string) => node.calls.filter((c) => c.method === method)

beforeEach(() => {
  node.subscribers = {}
  node.subscribes = {}
  node.profiles = {}
  node.calls = []
  node.override = null
  __resetUserNamesForTests()
})

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  __resetUserNamesForTests()
})

describe('useFollowersList — список с ноды', () => {
  it('подписчики: getusersubscribers без подписи, строки с именем, аватаром и репутацией', async () => {
    node.subscribers.POwner = [{ address: 'PA', reputation: 120, height: 10 }]
    node.profiles.PA = { address: 'PA', name: 'alice', i: 'avahash', reputation: 15 }
    const { api } = list()
    await vi.waitFor(() => expect(api.rows.value[0]?.name).toBe('alice'))
    expect(callsOf('getusersubscribers')[0]).toMatchObject({
      parameters: ['POwner', '', '', 0, 5000],
      options: { auth: false },
    })
    expect(api.rows.value).toEqual([
      {
        address: 'PA',
        name: 'alice',
        avatar: 'https://pocketnet.app:8092/i/avahash',
        reputation: 15,
        isPrivate: false,
      },
    ])
    expect(api.totalCount.value).toBe(1)
    expect(api.isLoading.value).toBe(false)
  })

  it('подписки: getusersubscribes, адрес в поле adddress, приватность в любом виде', async () => {
    node.subscribes.POwner = [
      { adddress: 'P1', private: true },
      { adddress: 'P2', private: 'true' },
      { adddress: 'P3', private: 1 },
      { adddress: 'P4', private: '1' },
      { adddress: 'P5', private: 'false' },
      { adddress: 'P6' },
    ]
    const { api } = list({ type: 'following' })
    await vi.waitFor(() => expect(api.totalCount.value).toBe(6))
    expect(callsOf('getusersubscribes')).toHaveLength(1)
    expect(callsOf('getusersubscribers')).toHaveLength(0)
    const priv = Object.fromEntries(api.rows.value.map((r) => [r.address, r.isPrivate]))
    expect(priv).toEqual({ P1: true, P2: true, P3: true, P4: true, P5: false, P6: false })
  })

  it('скрытые (заблокированные владельцем), дубли и строки без адреса не попадают в список', async () => {
    node.subscribers.POwner = [
      { address: 'PA' },
      { address: 'PBlocked' },
      { address: 'PA' },
      { address: '' },
      null,
      { address: 42 },
      { address: 'PB' },
    ]
    const { api } = list({ hidden: ['PBlocked'] })
    await vi.waitFor(() => expect(api.totalCount.value).toBe(2))
    expect(addresses(api.rows.value)).toEqual(['PA', 'PB'])
  })

  it('без профиля репутация берётся из строки ноды (÷10), без неё — 0', async () => {
    node.subscribers.POwner = [
      { address: 'PA', reputation: 125, height: 2 },
      { address: 'PB', reputation: 'abc', height: 1 },
    ]
    const { api } = list()
    await vi.waitFor(() => expect(api.rows.value).toHaveLength(2))
    expect(api.rows.value.map((r) => r.reputation)).toEqual([12.5, 0])
  })

  it('порядок: сначала новые, по репутации — по запросу; смена порядка без запроса к ноде', async () => {
    node.subscribers.POwner = [
      { address: 'Old', reputation: 900, height: 1 },
      { address: 'New', reputation: 10, height: 3 },
      { address: 'Mid', reputation: 500, height: 2 },
    ]
    const { api, sort } = list()
    await vi.waitFor(() => expect(api.rows.value).toHaveLength(3))
    expect(addresses(api.rows.value)).toEqual(['New', 'Mid', 'Old'])
    sort.value = 'reputation'
    expect(addresses(api.rows.value)).toEqual(['Old', 'Mid', 'New'])
    expect(callsOf('getusersubscribers')).toHaveLength(1)
  })

  it('выключен или без адреса — к ноде не ходит', async () => {
    list({ enabled: false })
    list({ address: '' })
    await new Promise((r) => setTimeout(r, 20))
    expect(node.calls).toEqual([])
  })

  it('ошибка ноды — пустой список и ошибка наружу', async () => {
    node.override = (p) =>
      p.method === 'getusersubscribers' ? Promise.reject(new Error('node down')) : undefined
    const { api } = list()
    await vi.waitFor(() => expect(api.error.value).toBeTruthy())
    expect((api.error.value as Error).message).toBe('node down')
    expect(api.rows.value).toEqual([])
    expect(api.totalCount.value).toBe(0)
  })
})

describe('useFollowersList — видимый срез', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ address: `P${i}`, height: n - i }))

  it('показывает только срез, профили спрашивает только для него', async () => {
    node.subscribers.POwner = many(5)
    const { api } = list({ visible: 2 })
    await vi.waitFor(() => expect(callsOf('getuserprofile').length).toBeGreaterThan(0))
    expect(addresses(api.rows.value)).toEqual(['P0', 'P1'])
    expect(api.hasMore.value).toBe(true)
    expect(callsOf('getuserprofile')[0]!.parameters[0]).toEqual(['P0', 'P1'])
  })

  it('«показать ещё» расширяет срез до конца списка', async () => {
    node.subscribers.POwner = many(5)
    const { api, visible } = list({ visible: 2 })
    await vi.waitFor(() => expect(api.rows.value).toHaveLength(2))
    visible.value = 10
    expect(api.rows.value).toHaveLength(5)
    expect(api.hasMore.value).toBe(false)
  })

  it('отрицательный размер среза — пустой срез, а не хвост списка', async () => {
    node.subscribers.POwner = many(3)
    const { api } = list({ visible: -1 })
    await vi.waitFor(() => expect(api.totalCount.value).toBe(3))
    expect(api.rows.value).toEqual([])
    expect(api.hasMore.value).toBe(true)
  })
})

describe('useFollowersList — поиск', () => {
  it('по части адреса, без учёта регистра и @', async () => {
    node.subscribers.POwner = [{ address: 'PAlpha' }, { address: 'PBeta' }, { address: 'PGamma' }]
    const { api, query } = list()
    await vi.waitFor(() => expect(api.totalCount.value).toBe(3))
    query.value = '@BET'
    expect(addresses(api.rows.value)).toEqual(['PBeta'])
    expect(api.matchCount.value).toBe(1)
    expect(api.totalCount.value).toBe(3)
    query.value = ''
    expect(api.matchCount.value).toBe(3)
  })

  it('по нику: на первый поиск имена всего списка догружаются, найденное появляется', async () => {
    node.subscribers.POwner = [{ address: 'PA' }, { address: 'PB' }, { address: 'PC' }]
    node.profiles = {
      PA: { address: 'PA', name: 'alice' },
      PB: { address: 'PB', name: 'bob' },
      PC: { address: 'PC', name: 'carol' },
    }
    // Срез — один человек: без поиска имена остальных не нужны.
    const { api, query } = list({ visible: 1 })
    await vi.waitFor(() => expect(api.totalCount.value).toBe(3))
    query.value = 'car'
    await vi.waitFor(() => expect(addresses(api.rows.value)).toEqual(['PC']))
    expect(api.namesLoading.value).toBe(false)
    // Имена спрашивались для всего списка, а не только для среза.
    const asked = callsOf('getuserprofile').flatMap((c) => c.parameters[0] as string[])
    expect(new Set(asked)).toEqual(new Set(['PA', 'PB', 'PC']))
  })

  it('пока имена грузятся — признак загрузки, дальнейший ввод не перезапрашивает список', async () => {
    node.subscribers.POwner = [{ address: 'PA' }, { address: 'PB' }]
    node.profiles = { PA: { address: 'PA', name: 'alice' }, PB: { address: 'PB', name: 'bob' } }
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    node.override = (p) =>
      p.method === 'getuserprofile' && (p.parameters[0] as string[]).length === 2
        ? gate.then(() => (p.parameters[0] as string[]).map((a) => node.profiles[a]))
        : undefined
    const { api, query, visible } = list()
    visible.value = 0
    await vi.waitFor(() => expect(api.totalCount.value).toBe(2))
    query.value = 'a'
    await vi.waitFor(() => expect(api.namesLoading.value).toBe(true))
    query.value = 'al'
    query.value = 'ali'
    release()
    await vi.waitFor(() => expect(api.namesLoading.value).toBe(false))
    const bulk = callsOf('getuserprofile').filter((c) => (c.parameters[0] as string[]).length === 2)
    expect(bulk).toHaveLength(1)
    expect(api.matchCount.value).toBe(1)
  })
})

describe('useFollowersList — смена профиля', () => {
  it('ответ по прежнему профилю не подменяет список нового', async () => {
    let releaseOld!: () => void
    node.subscribers.POld = [{ address: 'PStale' }]
    node.subscribers.PNew = [{ address: 'PFresh' }]
    node.override = (p) =>
      p.method === 'getusersubscribers' && p.parameters[0] === 'POld'
        ? new Promise((r) => (releaseOld = () => r(node.subscribers.POld)))
        : undefined
    const { api, address } = list({ address: 'POld' })
    await vi.waitFor(() => expect(callsOf('getusersubscribers')).toHaveLength(1))
    address.value = 'PNew'
    await vi.waitFor(() => expect(addresses(api.rows.value)).toEqual(['PFresh']))
    releaseOld()
    await new Promise((r) => setTimeout(r, 10))
    expect(addresses(api.rows.value)).toEqual(['PFresh'])
  })

  it('переключение подписчики → подписки запрашивает другой метод', async () => {
    node.subscribers.POwner = [{ address: 'PFollower' }]
    node.subscribes.POwner = [{ adddress: 'PFollowing' }]
    const { api, type } = list()
    await vi.waitFor(() => expect(addresses(api.rows.value)).toEqual(['PFollower']))
    type.value = 'following'
    await vi.waitFor(() => expect(addresses(api.rows.value)).toEqual(['PFollowing']))
  })
})
