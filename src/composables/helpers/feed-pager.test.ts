// Лента на нескольких языках сливается из лент каждого языка, не теряя
// порядка и постов при ошибках ноды; порог репутации отсеивает авторов и
// добирает страницы.

import { describe, expect, it, vi } from 'vitest'

import { SparseLanguageTimeout } from './date-feed'
import {
  byTime,
  collectVisible,
  mergeSources,
  passesReputation,
  toRawPage,
  type PageSource,
  type RawPage,
} from './feed-pager'

type Post = { txid: string; time: number; address?: string; userprofile?: { reputation?: number } }

const post = (txid: string, time: number, reputation?: number): Post => ({
  txid,
  time,
  address: `P${txid}`,
  userprofile: reputation === undefined ? undefined : { reputation },
})

/**
 * Лента одного языка: посты от новых к старым, страницы по `size`. Курсор —
 * txid последнего поста страницы, как у ноды.
 */
function lane(posts: Post[], size: number): PageSource & { calls: string[] } {
  const calls: string[] = []
  const source = (async (cursor: string): Promise<RawPage> => {
    calls.push(cursor)
    const start = cursor ? posts.findIndex((p) => p.txid === cursor) + 1 : 0
    const page = posts.slice(start, start + size)
    return toRawPage(
      { response: { data: { contents: page, height: 100 } } as never, requested: size },
      cursor
    )
  }) as PageSource & { calls: string[] }
  source.calls = calls
  return source
}

const ids = (page: RawPage): string[] => page.posts.map((p) => p.txid)

describe('страница ноды', () => {
  it('меньше, чем просили, или курсор не сдвинулся — дальше пусто', () => {
    const page = (n: number, requested: number) =>
      toRawPage(
        {
          response: { data: { contents: Array.from({ length: n }, (_, i) => post(`t${i}`, i)) } },
          requested,
        } as never,
        ''
      )
    expect(page(2, 2)).toMatchObject({ more: true, cursor: 't1' })
    expect(page(1, 2)).toMatchObject({ more: false, cursor: 't0' })
    expect(page(0, 2)).toMatchObject({ more: false, cursor: '' })
    const same = toRawPage(
      { response: { data: { contents: [post('t0', 0)] } }, requested: 1 } as never,
      't0'
    )
    expect(same.more).toBe(false)
  })
})

describe('лента из нескольких языков', () => {
  it('по дате, все посты по разу, страницами не больше заданной', async () => {
    const ru = lane([post('r1', 90), post('r2', 70), post('r3', 50), post('r4', 10)], 2)
    const en = lane([post('e1', 80), post('e2', 60), post('e3', 20)], 2)
    const feed = mergeSources([ru, en], byTime, 3)

    const first = await feed('')
    expect(ids(first)).toEqual(['r1', 'e1', 'r2'])
    expect(first.more).toBe(true)
    const all = [...ids(first)]
    let page = first
    while (page.more) {
      page = await feed(page.cursor)
      all.push(...ids(page))
    }
    expect(all).toEqual(['r1', 'e1', 'r2', 'e2', 'r3', 'e3', 'r4'])
  })

  it('редкий язык (по одному посту) спрашивается, только когда его пост ушёл в ленту', async () => {
    const ru = lane(
      Array.from({ length: 6 }, (_, i) => post(`r${i}`, 100 - i)),
      3
    )
    const it = lane([post('i1', 50), post('i2', 40)], 1)
    const feed = mergeSources([ru, it], byTime, 20)

    // Пост на итальянском старше всех русских страницы: русские идут без нового запроса к нему.
    const first = await feed('')
    expect(ids(first)).toEqual(['r0', 'r1', 'r2'])
    const second = await feed(first.cursor)
    expect(ids(second)).toEqual(['r3', 'r4', 'r5'])
    expect(it.calls).toEqual([''])
    const third = await feed(second.cursor)
    expect(ids(third)).toEqual(['i1'])
    const fourth = await feed(third.cursor)
    expect(ids(fourth)).toEqual(['i2'])
    // Кончилась ли лента, нода говорит следующей, пустой страницей.
    const last = await feed(fourth.cursor)
    expect(last).toMatchObject({ posts: [], more: false })
  })

  it('пост, пришедший в лентах двух языков, — один раз', async () => {
    // Пост без языка нода отдаёт в ленте любого языка.
    const shared = post('x', 85)
    const ru = lane([post('r1', 90), shared, post('r2', 70)], 3)
    const en = lane([shared, post('e1', 80)], 3)
    const page = await mergeSources([ru, en], byTime, 20)('')
    expect(ids(page)).toEqual(['r1', 'x', 'e1', 'r2'])
  })

  it('та же страница по тому же курсору — та же; чужой курсор — ошибка', async () => {
    const feed = mergeSources([lane([post('a', 2), post('b', 1)], 1)], byTime, 20)
    const first = await feed('')
    expect(await feed('')).toBe(first)
    await expect(feed('merged:7')).rejects.toThrow(/cursor/)
  })

  it('нода не ответила по одному языку — страница не теряет пришедшее и повторяется', async () => {
    const ru = lane([post('r1', 90), post('r2', 70)], 2)
    const en = lane([post('e1', 80)], 2)
    const flaky = vi.fn<PageSource>(en)
    flaky.mockRejectedValueOnce(new Error('node down'))
    const feed = mergeSources([ru, flaky], byTime, 20)

    await expect(feed('')).rejects.toThrow('node down')
    const page = await feed('')
    expect(ids(page)).toEqual(['r1', 'e1', 'r2'])
    // Русская страница пришла в первый раз — второй раз её не спрашивали.
    expect(ru.calls).toEqual([''])
  })

  it('на редком языке нода не нашла следующий пост — он выпадает, остальные идут дальше', async () => {
    const ru = lane([post('r1', 90), post('r2', 70)], 2)
    const sparse: PageSource = async () => {
      throw new SparseLanguageTimeout(true)
    }
    const feed = mergeSources([ru, sparse], byTime, 20)
    const page = await feed('')
    expect(ids(page)).toEqual(['r1', 'r2'])
    expect(await feed(page.cursor)).toMatchObject({ posts: [], more: false })
  })

  it('не нашлось ни на одном языке — ошибка ленты, как у одного языка', async () => {
    const sparse: PageSource = async () => {
      throw new SparseLanguageTimeout(true)
    }
    const feed = mergeSources([sparse, sparse], byTime, 20)
    const error = await feed('').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SparseLanguageTimeout)
    expect((error as SparseLanguageTimeout).first).toBe(true)
  })
})

describe('порог репутации', () => {
  const posts = [
    post('a', 9, 5000),
    post('b', 8, 3),
    post('c', 7, 2),
    post('d', 6, 1),
    post('e', 5, 7000),
    post('f', 4, 9000),
  ]
  const keep = (p: Post) => passesReputation(p as never, 100, '')

  it('мало видимых — берёт следующие страницы; курсор — после последнего просмотренного', async () => {
    const source = lane(posts, 2)
    const page = await collectVisible(source, '', keep as never)
    // Нужна половина страницы (1 из 2): первой хватило.
    expect(ids(page)).toEqual(['a'])
    expect(page).toMatchObject({ cursor: 'b', hidden: 1, more: true })

    const next = await collectVisible(source, page.cursor, keep as never)
    // На странице c, d — ни одного видимого: следующая, e и f.
    expect(ids(next)).toEqual(['e', 'f'])
    expect(next).toMatchObject({ cursor: 'f', hidden: 2 })
    expect(source.calls).toEqual(['', 'b', 'd'])
  })

  it('за раз — не больше заданного числа страниц, даже если не нашлось ни одного', async () => {
    const source = lane(
      Array.from({ length: 10 }, (_, i) => post(`x${i}`, 10 - i, 1)),
      2
    )
    const page = await collectVisible(source, '', keep as never, 3)
    expect(page.posts).toEqual([])
    expect(page).toMatchObject({ hidden: 6, cursor: 'x5', more: true })
  })

  it('без порога и когда ничего не скрыто — одна страница', async () => {
    const source = lane(posts, 2)
    await collectVisible(source, '', null)
    await collectVisible(source, 'd', keep as never)
    expect(source.calls).toEqual(['', 'd'])
  })

  it('своё и автора без профиля не прячет', () => {
    expect(passesReputation(post('a', 1, 5) as never, 100, 'Pa')).toBe(true)
    expect(passesReputation(post('a', 1, 5) as never, 100, 'Pz')).toBe(false)
    expect(passesReputation(post('a', 1) as never, 100, '')).toBe(true)
    expect(passesReputation(post('a', 1, 100) as never, 100, '')).toBe(true)
    expect(passesReputation(post('a', 1, -3) as never, 0, '')).toBe(false)
  })
})
