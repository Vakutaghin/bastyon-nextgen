// Записи аудио-поста доходят до карточки и у своего поста, и у репоста.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/user-resolver', () => ({ registerNameAddress: vi.fn() }))
vi.mock('@/services/user-names', () => ({ rememberUsers: vi.fn() }))

import { adaptPostData, mergeRepostContent } from './adapt-post'

const part = (n: number) => `peertube://pt.example/u${n}/audio`
const audios = [{ u: part(1), c: 'Глава 1' }, { u: part(2) }]
const raw = { txid: 'tx1', address: 'PA', type: 'audio', u: part(1), c: 'Книга', time: 1 }

describe('adaptPost: записи аудио-поста', () => {
  it('список — в audios, у обычного трека его нет', () => {
    const book = adaptPostData({ ...raw, s: { f: '0', audios } } as never, 0, {} as never)
    expect(book.audios).toEqual([
      { url: part(1), title: 'Глава 1', duration: null },
      { url: part(2), title: '', duration: null },
    ])
    const track = adaptPostData({ ...raw, s: { f: '0' } } as never, 0, {} as never)
    expect('audios' in track).toBe(false)
  })

  it('репост берёт записи оригинала, свои у него — не в счёт', () => {
    const repost = adaptPostData(
      { ...raw, type: 'share', u: '', repost: 'tx0' } as never,
      0,
      {} as never
    )
    mergeRepostContent(repost, { ...raw, s: { audios } } as never)
    expect(repost.audios?.map((a) => a.url)).toEqual([part(1), part(2)])
    mergeRepostContent(repost, raw as never)
    expect(repost.audios).toBeUndefined()
  })
})
