/**
 * Лента по дате на любом языке, в том числе на редком.
 *
 * Посты на языке нода ищет так: перебирает от курсора подряд посты всех
 * языков, пока не наберёт `count` своих, и через ~10 с сдаётся
 * («GetHistoricalFeed: sql request timeout»). На русском, английском,
 * немецком, французском и китайском 20 постов находятся за секунду, а на
 * итальянском, испанском и сербском это недели и месяцы перебора (замер
 * 03.11.2026). Там просим по одному посту: нода ищет только до ближайшего.
 *
 * Бывает, что и до ближайшего слишком далеко: на сербском перед постами
 * августа перерыв, а на корейском нода подряд не находит ни одного поста
 * (ближайший с ходовыми тегами — весны 2025-го). Тогда
 * перерыв перепрыгиваем по тегам: следующий пост с ходовыми тегами языка
 * (`gettags`) нода находит по их индексу за пару секунд, а от него лента
 * снова идёт подряд. Пропасть могут только посты внутри такого перерыва без
 * ходовых тегов: до них нода не добирается вовсе.
 *
 * Раньше на редком языке вместо ленты показывалось лучшее за месяц, а у
 * итальянского за месяц там пусто — лента была пустой, хотя постов на нём
 * сотни.
 *
 * «Редкость» — у сочетания языка, типа постов и тегов фильтра: русских
 * видео за 20 постов тоже может не набраться, а русская лента от этого
 * медленнее стать не должна.
 */

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCallArray } from '@/helpers/api/request'
import { isNodeTimeout } from '@/helpers/api/rpc-errors'
import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import { buildHistoricalStripQuery, type FeedQueryContext } from './feed-queries'

/** Страница ленты и сколько постов в ней просили: пришло меньше — лента кончилась. */
export interface DatePage {
  response: GetHierarchicalStripResponse
  requested: number
}

/** Нода не нашла следующий пост на этом языке ни подряд, ни по тегам. */
export class SparseLanguageTimeout extends Error {
  /** `first` — не нашлось ни одного поста, лента пуста. */
  constructor(readonly first: boolean) {
    super('The node did not find the next post in this language in time')
    this.name = 'SparseLanguageTimeout'
  }
}

const STORAGE_KEY = 'feed-sparse-languages'
/** Язык редкий неделю: потом снова пробуем страницу целиком — вдруг на нём стали писать чаще. */
const SPARSE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Больше не помним: сочетаний с тегами фильтра может быть много. */
const SPARSE_KEEP = 50
/** Сколько ходовых тегов языка брать для прыжка через перерыв (`gettags` отдаёт до 50). */
const JUMP_TAGS = 50

type SparseScope = Pick<FeedQueryContext, 'lang' | 'contentTypes' | 'allTags'>

const sparseKey = (scope: SparseScope): string =>
  JSON.stringify([scope.lang, scope.contentTypes, scope.allTags])

/** Сочетание → когда выяснилось, что оно редкое. Помним между запусками: иначе каждый раз лишние 10 с. */
let sparseSince: Map<string, number> | null = null

function sparseLanguages(): Map<string, number> {
  if (sparseSince) return sparseSince
  sparseSince = new Map()
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (saved && typeof saved === 'object') {
      for (const [lang, at] of Object.entries(saved)) {
        if (typeof at === 'number' && Date.now() - at < SPARSE_TTL_MS) sparseSince.set(lang, at)
      }
    }
  } catch {
    // Без памяти — узнаем заново первым запросом.
  }
  return sparseSince
}

function markSparse(scope: SparseScope): void {
  const all = sparseLanguages()
  all.set(sparseKey(scope), Date.now())
  // Map хранит порядок добавления: первыми уходят самые старые.
  for (const key of [...all.keys()].slice(0, Math.max(all.size - SPARSE_KEEP, 0))) all.delete(key)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(all)))
  } catch {
    // Не сохранилось — до перезапуска помним в памяти.
  }
}

/** Такую ленту нода целыми страницами не собирает — идём по одному посту. */
export function isSparseFeed(scope: SparseScope): boolean {
  return scope.lang !== '' && sparseLanguages().has(sparseKey(scope))
}

const tagsByLanguage = new Map<string, Promise<string[]>>()

/** Ходовые теги языка — в том виде, в каком их ждёт лента (см. buildAllTags). */
function languageTags(lang: string): Promise<string[]> {
  let tags = tagsByLanguage.get(lang)
  if (!tags) {
    tags = rpcCallArray<{ tag?: string }>({
      method: rpcEndpoints.getTags,
      parameters: ['', String(JUMP_TAGS), '', lang],
      options: { auth: false },
    })
      .then((list) =>
        list.flatMap((item) => (item?.tag ? [encodeURIComponent(item.tag.toLowerCase())] : []))
      )
      .catch(() => {
        tagsByLanguage.delete(lang)
        return []
      })
    tagsByLanguage.set(lang, tags)
  }
  return tags
}

/** Следующий пост с ходовыми тегами языка; null — такого нет или нода не успела и тут. */
async function jumpByTags(ctx: FeedQueryContext): Promise<GetHierarchicalStripResponse | null> {
  const tags = await languageTags(ctx.lang)
  if (!tags.length) return null
  try {
    const response = await buildHistoricalStripQuery({ ...ctx, allTags: tags }, 1)
    return response?.data?.contents?.length ? response : null
  } catch (err) {
    if (isNodeTimeout(err)) return null
    throw err
  }
}

/**
 * Страница ленты по дате. На редком языке — по одному посту, через долгий
 * перерыв — прыжком по тегам языка. Свои теги в фильтре нода и так ищет по
 * индексу, им прыжок не нужен (и подменил бы фильтр). `jump: false` — для
 * проверки «есть ли новое»: пост за перерывом новым не бывает.
 */
export async function fetchDatePage(
  ctx: FeedQueryContext,
  { jump = true }: { jump?: boolean } = {}
): Promise<DatePage> {
  if (!isSparseFeed(ctx)) {
    try {
      // Одна нода: не успела — не ждём вторую, а идём по одному посту.
      const response = await buildHistoricalStripQuery(ctx, ctx.lang ? 1 : undefined)
      return { response, requested: ctx.count }
    } catch (err) {
      if (!ctx.lang || !isNodeTimeout(err)) throw err
      markSparse(ctx)
    }
  }

  const one: FeedQueryContext = { ...ctx, count: 1 }
  try {
    return { response: await buildHistoricalStripQuery(one, 1), requested: 1 }
  } catch (err) {
    if (!isNodeTimeout(err)) throw err
  }
  const jumped = !jump || one.allTags.length ? null : await jumpByTags(one)
  if (jumped) return { response: jumped, requested: 1 }
  throw new SparseLanguageTimeout(ctx.currentTxid === '')
}

/** Сброс памяти модуля — только для тестов. */
export function resetDateFeedForTests(): void {
  sparseSince = null
  tagsByLanguage.clear()
}
