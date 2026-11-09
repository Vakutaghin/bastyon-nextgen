/**
 * Страницы ленты на нескольких языках и с порогом репутации автора.
 *
 * Нода отбирает посты по одному языку: `lang` в запросе ленты — одна строка,
 * пустая — все языки (pocketnet.core, `( ? or p.String1 = ? )`). Поэтому
 * ленту на нескольких языках собираем сами: у каждого языка своя лента со
 * своим курсором, а их страницы сливаются — по дате, в «Лучшем» по оценкам,
 * в «Обсуждаемом» по числу комментариев. Пост выходит в ленту, только когда
 * у каждого языка есть пост, который встанет после него: иначе свежий пост
 * редкого языка, ещё не пришедший с ноды, оказался бы ниже уже показанных.
 *
 * Порог репутации нода тоже не принимает — у неё свой, общий для сети
 * (`ConsensusLimit_bad_reputation`). Посты авторов ниже порога отсеиваем
 * здесь; осталось мало — берём следующие страницы.
 */

import type {
  GetHierarchicalStripPost,
  GetHierarchicalStripResponse,
} from '@/types/rpc-responses/get-hierarchical-strip'
import { SparseLanguageTimeout, type DatePage } from './date-feed'

type RawPost = GetHierarchicalStripPost
type RawUser = { address?: string } & Record<string, unknown>

/** Страница ленты: посты, есть ли дальше и откуда просить следующую. */
export interface RawPage {
  posts: RawPost[]
  /** Профили из `data.users` ответа (авторы последних комментариев). */
  users: RawUser[]
  /** Высота блока первой страницы — с ней просят следующие (FeedQueryContext.height). */
  height: number
  more: boolean
  /** Курсор следующей страницы; '' — голова ленты. */
  cursor: string
}

/** Источник страниц: курсор → страница. */
export type PageSource = (cursor: string) => Promise<RawPage>

/** По чему сливать ленты языков: больше — выше. */
export type MergeKey = (post: RawPost) => number

export const byTime: MergeKey = (p) => Number(p.time) || 0
export const byScore: MergeKey = (p) => Number(p.scoreSum) || 0
export const byComments: MergeKey = (p) => Number(p.comments) || 0

/** Ответ ноды → страница. Пришло меньше, чем просили, или курсор не сдвинулся — дальше пусто. */
export function toRawPage(page: DatePage, cursor: string): RawPage {
  const data = page.response?.data as
    | { contents?: RawPost[]; users?: RawUser[]; height?: number }
    | undefined
  const posts = Array.isArray(data?.contents) ? data.contents : []
  const last = posts[posts.length - 1]?.txid ?? ''
  return {
    posts,
    users: Array.isArray(data?.users) ? data.users : [],
    height: Number(data?.height) || 0,
    more: posts.length >= page.requested && last !== '' && last !== cursor,
    cursor: last || cursor,
  }
}

interface Lane {
  source: PageSource
  cursor: string
  /** Пришли с ноды, ещё не в ленте. */
  queue: RawPost[]
  ended: boolean
}

/**
 * Одна лента из лент нескольких языков. Помнит очереди непоказанных постов,
 * поэтому живёт, пока не сменились фильтры. Курсоры страниц — свои
 * («merged:N»); та же страница по тому же курсору отдаётся та же — vue-query
 * повторяет запрос после ошибки. Ошибка ноды ничего не теряет: пришедшее
 * остаётся в очередях, а в ленту посты уходят уже после всех запросов.
 *
 * Редкий язык, на котором нода не нашла следующий пост, выпадает из ленты, а
 * остальные идут дальше. Остался он один — ошибка ленты, как у одного языка.
 */
export function mergeSources(sources: PageSource[], key: MergeKey, pageSize: number): PageSource {
  const lanes: Lane[] = sources.map((source) => ({ source, cursor: '', queue: [], ended: false }))
  const pages = new Map<string, Promise<RawPage>>()
  let users: RawUser[] = []
  /** Уже ушедшие в ленту — повтор из ленты другого языка не показываем. */
  const seen = new Set<string>()
  let issued = 0
  let shown = 0
  let next = ''

  const alive = (lane: Lane): boolean => lane.queue.length > 0 || !lane.ended

  async function fill(): Promise<void> {
    const hungry = lanes.filter((lane) => !lane.ended && lane.queue.length === 0)
    const results = await Promise.allSettled(hungry.map((lane) => lane.source(lane.cursor)))
    let failure: unknown = null
    const timedOut: Lane[] = []
    results.forEach((result, i) => {
      const lane = hungry[i]!
      if (result.status === 'fulfilled') {
        const page = result.value
        lane.queue.push(...page.posts)
        users.push(...page.users)
        lane.cursor = page.cursor
        lane.ended = !page.more
      } else if (result.reason instanceof SparseLanguageTimeout) {
        timedOut.push(lane)
      } else {
        failure ??= result.reason
      }
    })
    if (failure) throw failure
    if (!timedOut.length) return
    if (!lanes.some((lane) => !timedOut.includes(lane) && alive(lane))) {
      // Больше идти некуда: ошибка ленты, а повтор снова спросит этот язык.
      throw new SparseLanguageTimeout(shown === 0)
    }
    for (const lane of timedOut) lane.ended = true
  }

  async function produce(): Promise<RawPage> {
    const posts: RawPost[] = []
    // Пустая страница бывает, только если всё взятое — повторы: тогда ещё круг.
    do {
      await fill()
      while (posts.length < pageSize) {
        const live = lanes.filter(alive)
        // Кому-то нужна следующая страница: без неё не узнать, чей пост свежее.
        if (!live.length || live.some((lane) => lane.queue.length === 0)) break
        let best = live[0]!
        for (const lane of live) if (key(lane.queue[0]!) > key(best.queue[0]!)) best = lane
        const post = best.queue.shift()!
        // У поста один язык, но пост без языка нода отдаёт в ленте любого.
        if (seen.has(post.txid)) continue
        seen.add(post.txid)
        posts.push(post)
      }
    } while (!posts.length && lanes.some(alive))
    shown += posts.length
    issued += 1
    const page: RawPage = {
      posts,
      users,
      height: 0,
      more: lanes.some(alive),
      cursor: `merged:${issued}`,
    }
    users = []
    return page
  }

  return (cursor) => {
    const known = pages.get(cursor)
    if (known) return known
    if (cursor !== next) return Promise.reject(new Error(`Unknown feed cursor: ${cursor}`))
    const page = produce().then((result) => {
      next = result.cursor
      return result
    })
    // Держим только последнюю: повторяют только её.
    pages.clear()
    pages.set(cursor, page)
    page.catch(() => pages.delete(cursor))
    return page
  }
}

/** Страница после отсева: сколько постов скрыто порогом. */
export interface VisiblePage extends RawPage {
  hidden: number
}

/** Сколько видимых постов хватает странице — не больше половины того, что приносит одна. */
const ENOUGH_VISIBLE = 10
/** Больше страниц за раз не берём: дальше лента сама попросит ещё. */
const MAX_ROUNDS = 5

/**
 * Страница без постов, которые отсеивает `keep`. Скрыто много и видимых мало —
 * берёт следующие страницы, но не больше `maxRounds` за раз. Курсор — после
 * последнего просмотренного поста, видимого или нет.
 */
export async function collectVisible(
  source: PageSource,
  cursor: string,
  keep: ((post: RawPost) => boolean) | null,
  maxRounds = MAX_ROUNDS
): Promise<VisiblePage> {
  const posts: RawPost[] = []
  const users: RawUser[] = []
  let hidden = 0
  let height = 0
  let pageSize = 0
  let at = cursor
  let more: boolean
  for (let round = 0; ; round += 1) {
    const page = await source(at)
    if (round === 0) height = page.height
    const visible = keep ? page.posts.filter(keep) : page.posts
    hidden += page.posts.length - visible.length
    posts.push(...visible)
    users.push(...page.users)
    at = page.cursor
    more = page.more
    pageSize = Math.max(pageSize, page.posts.length)
    const enough = Math.min(ENOUGH_VISIBLE, Math.ceil(pageSize / 2))
    if (!keep || !more || hidden === 0 || posts.length >= enough || round + 1 >= maxRounds) break
  }
  return { posts, users, height, more, cursor: at, hidden }
}

/**
 * Пост проходит порог «Репутация авторов». Своё не прячем; профиля автора
 * нет — репутация неизвестна, тоже не прячем.
 */
export function passesReputation(post: RawPost, min: number, me: string): boolean {
  if (me && post.address === me) return true
  const reputation = post.userprofile?.reputation
  return typeof reputation !== 'number' || !Number.isFinite(reputation) || reputation >= min
}

/** Что лента знает о странице сверх ответа ноды. */
export interface FeedPageInfo {
  more: boolean
  cursor: string
  hidden: number
}

/** Ответ для ленты: как у ноды, плюс FeedPageInfo. */
export type FeedPageResponse = GetHierarchicalStripResponse & { feedPage: FeedPageInfo }

export function toFeedResponse(page: VisiblePage): FeedPageResponse {
  return {
    data: { contents: page.posts, users: page.users, height: page.height },
    feedPage: { more: page.more, cursor: page.cursor, hidden: page.hidden },
  } as unknown as FeedPageResponse
}
