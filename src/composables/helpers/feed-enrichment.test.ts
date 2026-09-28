// Авторы последних комментариев под постами: их имена догружаются одним
// лёгким запросом до показа страницы. Берутся только адреса из lastComment —
// авторы постов приходят с профилем, а посты без комментария пропускаются.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getByPRC: vi.fn(), getByPRCWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({
  getByPRC: mocks.getByPRC,
  getByPRCWithAuth: mocks.getByPRCWithAuth,
}))

import { __resetUserNamesForTests, userName } from '@/services/user-names'
import { preloadLastCommentAuthors } from './feed-enrichment'

beforeEach(() => {
  __resetUserNamesForTests()
  mocks.getByPRC.mockReset()
})

afterEach(() => {
  __resetUserNamesForTests()
})

describe('preloadLastCommentAuthors', () => {
  it('спрашивает имена авторов последних комментариев, и подпись сразу с ником', async () => {
    mocks.getByPRC.mockResolvedValue({
      result: 'success',
      data: [
        { address: 'PCommenterA', name: 'lic' },
        { address: 'PCommenterB', name: 'Ivin1962' },
      ],
    })
    await preloadLastCommentAuthors([
      { txid: 'a', address: 'PAuthor', lastComment: { address: 'PCommenterA' } },
      { txid: 'b', address: 'PAuthor', lastComment: null },
      { txid: 'c', address: 'PAuthor' },
      null,
      { txid: 'd', address: 'PAuthor', lastComment: { address: 'PCommenterB' } },
    ])
    expect(mocks.getByPRC).toHaveBeenCalledTimes(1)
    expect(mocks.getByPRC.mock.calls[0]![0].parameters).toEqual([
      ['PCommenterA', 'PCommenterB'],
      '1',
    ])
    expect(userName('PCommenterA')).toBe('lic')
    expect(userName('PCommenterB')).toBe('Ivin1962')
  })

  it('страница без комментариев и пустой ответ — без запроса', async () => {
    await preloadLastCommentAuthors([{ txid: 'a', lastComment: null }])
    await preloadLastCommentAuthors(undefined)
    expect(mocks.getByPRC).not.toHaveBeenCalled()
  })
})
