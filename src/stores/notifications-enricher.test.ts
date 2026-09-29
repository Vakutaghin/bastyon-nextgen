// Дозагрузка для уведомлений: посты, комментарии и профили — тремя пачками,
// без того, что уже пришло в снимке или лежит в кеше. Повторный вызов —
// без запросов. Уведомление, чья пачка упала, не помечается готовым и
// догружается в следующий раз (P2-9), остальные — помечаются.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpcCall: vi.fn(), rpcCallWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
}))

import { enrichNotifications, type EnrichmentCaches } from './notifications-enricher'
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

/** Нода: транзакции по id и профили по адресу. */
function node(
  txs: Record<string, Record<string, unknown>>,
  profiles: Record<string, Record<string, unknown>> = {}
) {
  mocks.rpcCallWithAuth.mockImplementation(async (req: { parameters: [string[]] }) =>
    req.parameters[0].map((id) => txs[id]).filter(Boolean)
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
    expect(mocks.rpcCall.mock.calls[0]![0]).toMatchObject({
      method: 'getuserprofile',
      parameters: [['PBob']],
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
