// Дозагрузка для уведомлений: посты, комментарии и профили — тремя пачками,
// без того, что уже пришло в снимке или лежит в кеше. Повторный вызов —
// без запросов. Уведомление, чья пачка упала, не помечается готовым и
// догружается в следующий раз (P2-9), остальные — помечаются. Профили —
// лёгкие и пачками до 50: полные с десяти адресов нода не отдаёт.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn(), rpcCallWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
}))

import { enrichNotifications, type EnrichmentCaches } from './notifications-enricher'
import { __resetUserNamesForTests, knownUsers } from '@/services/user-names'
import type { NotificationItem } from './notifications-types'

const caches = (): EnrichmentCaches => ({
  postCache: {},
  commentCache: {},
  profileCache: {},
  enrichedIds: new Set(),
})

const note = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1',
  type: 'upvote' as NotificationItem['type'],
  title: '',
  time: 0,
  seen: false,
  ...overrides,
})

/**
 * Нода: посты (`getrawtransactionwithmessagebyid`), комментарии — у них `msg`
 * (`getcomments` с пустым постом и списком id) и профили по адресу. На
 * комментарий `getrawtransactionwithmessagebyid` отвечает null — как настоящая.
 */
function node(
  txs: Record<string, Record<string, unknown>>,
  profiles: Record<string, Record<string, unknown>> = {}
) {
  const isComment = (tx: Record<string, unknown> | undefined) => !!tx && 'msg' in tx
  mocks.rpcCallWithAuth.mockImplementation(
    async (req: { method: string; parameters: unknown[] }) => {
      if (req.method === 'getcomments') {
        return (req.parameters[3] as string[]).map((id) => txs[id]).filter(isComment)
      }
      return (req.parameters[0] as string[]).map((id) =>
        txs[id] && !isComment(txs[id]) ? txs[id] : null
      )
    }
  )
  mocks.rpcCall.mockImplementation(async (req: { parameters: [string[]] }) =>
    req.parameters[0].map((address) => ({ address, ...profiles[address] }))
  )
}

describe('enrichNotifications', () => {
  beforeEach(() => {
    mocks.rpcCall.mockReset()
    mocks.rpcCallWithAuth.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetUserNamesForTests()
  })

  it('профиль в пути — адрес «в загрузке», повторно не запрашивается, после ответа снят', async () => {
    let answer: (v: unknown) => void = () => {}
    mocks.rpcCall.mockReturnValue(new Promise((r) => (answer = r)))
    const c = { ...caches(), pendingProfiles: new Set<string>() }
    // Снимок с одним адресом — как у большинства событий.
    const n = note({ id: 'up1', from: 'PBob', fromSnapshot: { address: 'PBob' } })
    const first = enrichNotifications(c, [n], () => {})
    expect([...c.pendingProfiles]).toEqual(['PBob'])
    await enrichNotifications(c, [n, note({ id: 'up2', from: 'PBob' })], () => {})
    expect(mocks.rpcCall).toHaveBeenCalledTimes(1)
    // Пока профиль в пути, второй вызов готовыми их не помечает.
    expect(c.enrichedIds.size).toBe(0)
    answer([{ address: 'PBob', name: 'bob' }])
    await first
    expect(c.pendingProfiles.size).toBe(0)
    expect(c.profileCache.PBob?.name).toBe('bob')
    expect([...c.enrichedIds]).toEqual(['up1'])
  })

  it('пост, комментарий и автор — по пачке на вид, кеш заполнен, всё помечено', async () => {
    node(
      {
        post1: {
          txid: 'post1',
          c: 'Заголовок',
          m: 'Текст поста',
          i: ['https://img/1.jpg'],
          type: 'share',
        },
        cm1: { id: 'cm1', postid: 'post1', msg: '{"message":"Отличный пост"}', address: 'PBob' },
      },
      { PBob: { name: 'bob', i: 'https://img/bob.jpg', reputation: 12 } }
    )
    const c = caches()
    const setEnriching = vi.fn()
    await enrichNotifications(
      c,
      [
        note({ id: 'up1', shareId: 'post1', from: 'PBob' }),
        note({
          id: 'cm1',
          type: 'comment' as NotificationItem['type'],
          shareId: 'post1',
          from: 'PBob',
        }),
      ],
      setEnriching
    )

    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(2)
    expect(mocks.rpcCallWithAuth.mock.calls[0]![0]).toMatchObject({
      method: 'getrawtransactionwithmessagebyid',
      parameters: [['post1']],
    })
    // Комментарий — через getcomments: getrawtransactionwithmessagebyid на него
    // отвечает null, и без текста оставались все уведомления о комментариях.
    expect(mocks.rpcCallWithAuth.mock.calls[1]![0]).toMatchObject({
      method: 'getcomments',
      parameters: ['', '', '', ['cm1']],
    })
    expect(mocks.rpcCall.mock.calls[0]![0]).toMatchObject({
      method: 'getuserprofile',
      parameters: [['PBob'], '1'],
      options: { auth: false },
    })
    expect(c.postCache.post1).toMatchObject({
      caption: 'Заголовок',
      message: 'Текст поста',
      images: ['https://img/1.jpg'],
    })
    expect(c.commentCache.cm1).toMatchObject({ postid: 'post1', message: 'Отличный пост' })
    expect(c.profileCache.PBob).toMatchObject({
      name: 'bob',
      avatar: 'https://img/bob.jpg',
      reputation: 12,
    })
    expect([...c.enrichedIds]).toEqual(['up1', 'cm1'])
    expect(setEnriching.mock.calls).toEqual([[true], [false]])
  })

  it('то, что пришло в снимке или уже в кеше, не запрашивается', async () => {
    node({})
    const c = caches()
    c.profileCache.PKnown = { address: 'PKnown', name: 'known' }
    c.postCache.postCached = { txid: 'postCached', message: 'x' }
    const setEnriching = vi.fn()
    await enrichNotifications(
      c,
      [
        note({ id: 'a', shareId: 'postCached', from: 'PKnown' }),
        note({
          id: 'b',
          shareId: 'postSnap',
          postSnapshot: { txid: 'postSnap', message: 'есть текст' },
          fromSnapshot: { address: 'PSnap', name: 'snap' },
        }),
      ],
      setEnriching
    )
    expect(mocks.rpcCall).not.toHaveBeenCalled()
    expect(mocks.rpcCallWithAuth).not.toHaveBeenCalled()
    expect(setEnriching).not.toHaveBeenCalled()
    expect(c.enrichedIds.size).toBe(2)
  })

  it('комментарий без shareId открывает пост из своего снимка', async () => {
    node({ post9: { txid: 'post9', m: 'Родительский пост' } })
    const c = caches()
    await enrichNotifications(
      c,
      [note({ id: 'x', commentSnapshot: { id: 'c9', postid: 'post9', message: 'ответ' } })],
      vi.fn()
    )
    expect(c.postCache.post9?.message).toBe('Родительский пост')
  })

  it('удалённый комментарий — без текста, с отметкой', async () => {
    node({ c5: { id: 'c5', postid: 'post5', msg: '', deleted: true } })
    const c = caches()
    await enrichNotifications(
      c,
      [note({ id: 'c5', type: 'comment', shareId: 'post5', mesType: 'comment' })],
      vi.fn()
    )
    expect(c.commentCache.c5).toMatchObject({ postid: 'post5', deleted: true })
    expect(c.commentCache.c5?.message).toBeUndefined()
  })

  it('оценка комментария: сначала комментарий, потом его пост', async () => {
    node({
      c7: { txid: 'c7', postid: 'post7', msg: JSON.stringify({ message: 'мой комментарий' }) },
      post7: { txid: 'post7', m: 'Пост с комментарием' },
    })
    const c = caches()
    await enrichNotifications(
      c,
      [note({ id: 's7', type: 'rating', mesType: 'upvoteComment', commentId: 'c7' })],
      vi.fn()
    )
    expect(c.commentCache.c7).toMatchObject({ postid: 'post7', message: 'мой комментарий' })
    expect(c.postCache.post7?.message).toBe('Пост с комментарием')
    expect(c.enrichedIds.has('s7')).toBe(true)
  })

  it('повторный вызов с теми же уведомлениями — без запросов', async () => {
    node({ post1: { txid: 'post1', m: 'x' } })
    const c = caches()
    const list = [note({ id: 'n1', shareId: 'post1' })]
    await enrichNotifications(c, list, vi.fn())
    await enrichNotifications(c, list, vi.fn())
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledTimes(1)
  })

  it('упала пачка профилей — зависящие от неё догрузятся потом, остальные готовы (P2-9)', async () => {
    node({ post1: { txid: 'post1', m: 'x' } })
    mocks.rpcCall.mockRejectedValueOnce(new Error('offline'))
    const c = caches()
    const withAuthor = note({ id: 'needs-profile', from: 'PBob' })
    const postOnly = note({ id: 'post-only', shareId: 'post1' })

    await enrichNotifications(c, [withAuthor, postOnly], vi.fn())
    expect([...c.enrichedIds]).toEqual(['post-only'])

    node({}, { PBob: { name: 'bob' } })
    await enrichNotifications(c, [withAuthor, postOnly], vi.fn())
    expect(c.profileCache.PBob?.name).toBe('bob')
    expect(c.enrichedIds.has('needs-profile')).toBe(true)
  })

  it('профили — лёгкие, пачками до 50; упавшая пачка не мешает другой; имена — в общий кэш', async () => {
    const addrs = Array.from({ length: 60 }, (_, i) => `PUser${String(i).padStart(2, '0')}`)
    const failing = addrs[55]!
    mocks.rpcCall.mockImplementation(async (req: { parameters: [string[], string] }) => {
      if (req.parameters[0].includes(failing)) throw new Error('sql request timeout')
      return req.parameters[0].map((address) => ({ address, name: `n_${address}` }))
    })
    const c = caches()
    const notes = addrs.map((from, i) => note({ id: `n${i}`, from }))
    await enrichNotifications(c, notes, vi.fn())

    const calls = mocks.rpcCall.mock.calls.map(([r]) => r.parameters)
    expect(calls.map(([batch, light]) => [batch.length, light])).toEqual([
      [50, '1'],
      [10, '1'],
    ])
    expect(c.enrichedIds.has('n0')).toBe(true)
    expect(c.enrichedIds.has('n55')).toBe(false)
    expect(c.profileCache.PUser00?.name).toBe('n_PUser00')
    expect(knownUsers().find((u) => u.address === 'PUser00')?.name).toBe('n_PUser00')
  })

  it('ошибка сети не бросает, индикатор всё равно гаснет', async () => {
    mocks.rpcCallWithAuth.mockRejectedValue(new Error('offline'))
    const setEnriching = vi.fn()
    await expect(
      enrichNotifications(caches(), [note({ shareId: 'post1' })], setEnriching)
    ).resolves.toBeUndefined()
    expect(setEnriching.mock.calls).toEqual([[true], [false]])
  })

  it('пустой список — ничего не делает', async () => {
    const setEnriching = vi.fn()
    await enrichNotifications(caches(), [], setEnriching)
    expect(setEnriching).not.toHaveBeenCalled()
  })
})
