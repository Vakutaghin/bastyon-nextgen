/**
 * Типы и хелперы для работы с лентой постов
 *
 * Основные composables находятся в use-feed-queries.ts
 */

import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import type { GetProfileFeedResponse, GetProfileFeedData } from '@/types/rpc-responses/get-profile-feed'
import { registerNameAddress } from '@/services/user-resolver'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

/**
 * Интерфейс адаптированного поста
 */
export interface AdaptedPost {
  id: string | number
  hash?: string // Хеш поста (share ID для upvote)
  txid?: string // ID транзакции (альтернатива hash)
  author: {
    name: string
    address: string
    avatar: string | null
    reputation: number
    letter: string
    verified?: boolean
    subscribers_count?: number
    subscribes_count?: number
  }
  title: string
  content: string
  timestamp: string
  likes: number
  comments: number
  shares: number
  tags: string[]
  type: string
  category: string
  images: string[]
  ratingStars: number
  scoreCnt: number
  scoreSum?: number
  myVal?: number
  videoUrl?: string
  preview?: string
  lastComment?: {
    id: string
    address: string
    authorName: string
    avatar: string | null
    time: number
    message: string
    children: number
    scoreUp: number
    scoreDown: number
  }
  /** txid оригинальной записи, если это репост */
  repost?: string
  /** Автор оригинальной записи (если есть в ответе API) */
  repostAuthor?: {
    name: string
    address: string
    avatar?: string | null
  }
  /** Время публикации оригинала (unix sec), для отображения даты в блоке репоста */
  repostOriginalTimestamp?: number
  /** Оригинальная запись удалена */
  repostDeleted?: boolean
  /**
   * Оптимистичный пост: транзакция ушла в мемпул, но ещё не подтверждена сетью.
   * Виден только автору в его ленте профиля, рисуется с пометкой «не опубликовано».
   */
  pending?: boolean
}

/**
 * Безопасное декодирование URL-encoded строк
 */
export function safeDecode(str: string): string {
  try {
    return decodeURIComponent((str + '').replace(/\+/g, '%20'))
  } catch (e) {
    return str
  }
}

/** Элемент массива изображений в сыром формате API: строка URL или объект с полями url/src. */
type RawImage = string | { url?: string; src?: string } | null | undefined

/**
 * Нормализует поле изображений из сырого ответа API (разные форматы: массив строк, одна строка, массив объектов с url).
 */
function normalizeImages(raw: unknown): string[] {
  if (!raw) return []
  const list = Array.isArray(raw)
    ? (raw as RawImage[]).map((item) => (typeof item === 'string' ? item : (item?.url ?? item?.src ?? '')))
    : typeof raw === 'string'
      ? [raw]
      : []
  // resolveImageUrl разворачивает голый хеш в полный URL + нормализует домен
  // (идемпотентен на уже полных URL).
  return list.map((u) => resolveImageUrl(u)).filter((u): u is string => !!u)
}

/** Минимальный профиль автора/пользователя в сыром ответе ленты. */
export interface RawUserProfile {
  name?: string
  address?: string
  i?: string
  avatar?: string | null
  reputation?: number
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
  subscribers_count?: number
  subscribes_count?: number
}

/** Последний комментарий в сыром формате API. */
interface RawLastComment {
  id?: string | number
  address?: string
  time?: number | string
  msg?: string
  children?: number
  scoreUp?: number
  scoreDown?: number
}

/**
 * Сырой пост из ответа RPC-ленты. Описывает только поля, к которым обращаются
 * адаптер и merge-логика (включая нестандартные поля вроде preview/repostAddress).
 */
export interface RawFeedPost {
  id?: string | number
  txid?: string
  hash?: string
  address?: string
  userprofile?: RawUserProfile
  c?: string
  m?: string
  time?: number | string
  scoreCnt?: number
  scoreSum?: number
  myVal?: number
  comments?: number
  reposted?: number
  t?: string[]
  i?: unknown
  images?: unknown
  u?: string
  s?: { v?: string }
  type?: string
  preview?: string
  p?: string
  repost?: string
  deleted?: unknown
  lastComment?: RawLastComment | null
  repostAddress?: string
  repost_author_address?: string
}

/**
 * Адаптирует данные поста из API в формат компонента
 */
export function adaptPostData(
  post: RawFeedPost,
  index: number,
  usersMap: Record<string, RawUserProfile> = {}
): AdaptedPost {
  let userprofile: RawUserProfile | undefined = post.userprofile

  // Если профиля нет в посте, пробуем найти его в карте пользователей по адресу
  if (!userprofile && post.address && usersMap[post.address]) {
    userprofile = usersMap[post.address]
  }

  // Регистрируем (name, address) для быстрого резолва ника в шапочном поиске.
  // Внутри user-resolver защита от дублей, persist debounced — повторные
  // вызовы для уже знакомых имён почти бесплатны.
  if (userprofile?.name && userprofile?.address) {
    registerNameAddress([{ name: userprofile.name, address: userprofile.address }])
  }

  const authorName = userprofile?.name || post.address || 'Неизвестный автор'

  const avatar = resolveImageUrl(userprofile?.i) ?? null
  const reputation = userprofile?.reputation || 0
  const verified = Array.isArray(userprofile?.badges)
    ? userprofile.badges.includes('verificated') || userprofile.badges.includes('verified')
    : (() => {
        const flags = userprofile?.flags
        const real = (flags && flags.real) ?? userprofile?.real
        return real === 1 || real === '1' || real === true || real === 'true'
      })()
  const title = safeDecode(post.c || '')
  const content = safeDecode(post.m || '')
  const timestamp = post.time
    ? new Date(Number(post.time) * 1000).toISOString()
    : new Date().toISOString()
  const likes = post.scoreCnt || 0
  const comments = post.comments || 0
  const shares = post.reposted || 0
  const tags = Array.isArray(post.t) ? post.t : []
  const images =
    normalizeImages(post.i).length > 0 ? normalizeImages(post.i) : normalizeImages(post.images)
  const videoUrl = post.u || post.s?.v || undefined
  const myVal = post.myVal
  const preview = safeDecode(post.preview || post.p || '')

  // hash/txid — строковые идентификаторы; числовой post.id используется как запасной вариант.
  const idAsString = post.id != null ? String(post.id) : undefined

  let ratingStars = 0
  const scoreCnt = post.scoreCnt ?? 0
  if (scoreCnt > 0 && post.scoreSum !== undefined && post.scoreSum !== null) {
    const averageRating = post.scoreSum / scoreCnt
    ratingStars = Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
  }

  let lastComment
  if (post.lastComment && post.lastComment.msg) {
    let msg: string
    try {
      const parsed = JSON.parse(post.lastComment.msg)
      msg = safeDecode(parsed?.message || '')
    } catch {
      msg = safeDecode(String(post.lastComment.msg || ''))
    }

    const commenterProfile = post.lastComment.address
      ? usersMap[post.lastComment.address] || null
      : null
    const commenterName = commenterProfile?.name || post.lastComment.address || ''
    const commenterAvatar = resolveImageUrl(commenterProfile?.i) ?? null

    lastComment = {
      id: String(post.lastComment.id || ''),
      address: String(post.lastComment.address || ''),
      authorName: String(commenterName || ''),
      avatar: commenterAvatar || null,
      time: Number(post.lastComment.time || 0),
      message: msg,
      children: Number(post.lastComment.children || 0),
      scoreUp: Number(post.lastComment.scoreUp || 0),
      scoreDown: Number(post.lastComment.scoreDown || 0),
    }
  }

  return {
    id: post.id || post.txid || post.hash || index,
    hash: post.hash || post.txid || idAsString,
    txid: post.txid || post.hash || idAsString,
    author: {
      name: authorName,
      address: post.address || '',
      avatar: avatar,
      reputation: reputation,
      letter: authorName.charAt(0).toUpperCase(),
      verified,
      subscribers_count: userprofile?.subscribers_count,
      subscribes_count: userprofile?.subscribes_count,
    },
    title: title,
    content: content,
    timestamp: timestamp,
    likes: likes,
    comments: comments,
    shares: shares,
    tags: tags,
    type: post.type || '',
    category: post.type || '',
    images: images,
    ratingStars: ratingStars,
    scoreCnt: post.scoreCnt || 0,
    scoreSum: post.scoreSum,
    myVal: myVal,
    videoUrl: videoUrl,
    preview: preview,
    lastComment,
    repost: post.repost || undefined,
    repostDeleted: !!post.deleted,
    repostAuthor: (() => {
      const addr = post.repostAddress || post.repost_author_address
      if (!addr) return undefined
      const profile = usersMap[addr]
      if (!profile) return undefined
      return {
        name: profile.name || addr,
        address: addr,
      }
    })(),
  }
}

/**
 * Подмешивает контент оригинальной записи в адаптированный пост-репост.
 * Вызывать после получения оригинала через getrawtransactionwithmessagebyid.
 */
export function mergeRepostContent(
  adapted: AdaptedPost,
  originalRaw: RawFeedPost | null | undefined
): void {
  if (!originalRaw) return
  adapted.title = safeDecode(originalRaw.c || '')
  adapted.content = safeDecode(originalRaw.m || '')
  adapted.images =
    normalizeImages(originalRaw.i).length > 0
      ? normalizeImages(originalRaw.i)
      : normalizeImages(originalRaw.images)
  adapted.videoUrl = originalRaw.u || originalRaw.s?.v || undefined
  adapted.tags = Array.isArray(originalRaw.t) ? originalRaw.t : []
  adapted.type = originalRaw.type || adapted.type
  adapted.category = originalRaw.type || adapted.category
  adapted.preview = safeDecode(originalRaw.preview || originalRaw.p || '')
  const origScoreCnt = originalRaw.scoreCnt ?? 0
  if (origScoreCnt > 0 && originalRaw.scoreSum != null) {
    adapted.ratingStars = Math.max(
      0,
      Math.min(5, Math.round((originalRaw.scoreSum / origScoreCnt) * 10) / 10)
    )
    adapted.scoreCnt = origScoreCnt
    adapted.scoreSum = originalRaw.scoreSum
  }
  const origAddress = originalRaw.address || ''
  const origName = originalRaw.userprofile?.name || origAddress || ''
  const origAvatar =
    resolveImageUrl(originalRaw.userprofile?.i ?? originalRaw.userprofile?.avatar) ?? null
  if (!adapted.repostAuthor && (origAddress || origName)) {
    adapted.repostAuthor = {
      address: origAddress,
      name: origName,
      avatar: origAvatar,
    }
  } else if (adapted.repostAuthor) {
    if (!adapted.repostAuthor.avatar && origAvatar) adapted.repostAuthor.avatar = origAvatar
  }
  if (originalRaw.time != null) {
    adapted.repostOriginalTimestamp =
      typeof originalRaw.time === 'number' ? originalRaw.time : parseInt(originalRaw.time, 10)
  }
  if (originalRaw.deleted) {
    adapted.repostDeleted = true
  }
}

/**
 * Преобразует данные API в массив адаптированных постов
 */
export function extractPostsFromResponse(
  feedData:
    | GetTopFeedResponse
    | GetHierarchicalStripResponse
    | GetProfileFeedResponse
    | GetProfileFeedData
    | null
    | undefined
): AdaptedPost[] {
  if (!feedData) {
    return []
  }

  let rawPosts: RawFeedPost[]
  const usersMap: Record<string, RawUserProfile> = {}

  // Сырой контент может приходить в разных формах (пост или профиль пользователя);
  // на уровне типов работаем с пересечением полей, реально доступных адаптеру.
  // feedData — строго типизированный union ответов, но в рантайме код защитно
  // проверяет нестандартные формы (массив, .posts, .contents), поэтому читаем
  // через индексируемую запись.
  type RawFeedItem = RawFeedPost & RawUserProfile
  const feedRecord = feedData as unknown as Record<string, unknown>
  const data = feedRecord.data as
    | { contents?: RawFeedItem[]; users?: RawUserProfile[] }
    | RawFeedItem[]
    | undefined
  const dataUsers = data && !Array.isArray(data) ? data.users : undefined

  // Обработка users из data.users (gethierarchicalstrip, gettopfeed)
  if (Array.isArray(dataUsers)) {
    dataUsers.forEach((u) => {
      if (u.address) {
        usersMap[u.address] = u
      }
    })
  }

  const asArray = (value: unknown): RawFeedItem[] | undefined =>
    Array.isArray(value) ? (value as RawFeedItem[]) : undefined

  // API может возвращать данные в разных форматах
  if (Array.isArray(feedData)) {
    rawPosts = feedData
  } else if (data && !Array.isArray(data) && Array.isArray(data.contents)) {
    // getprofilefeed может возвращать смешанный контент (посты + профили)
    const contents = data.contents

    // Разделяем посты и профили
    rawPosts = contents.filter((item) => {
      // Если есть поле 'name' и нет 'txid', это профиль пользователя
      // (согласно документации getprofilefeed)
      if (item.name && !item.txid && !item.type) {
        if (item.address) {
          usersMap[item.address] = item
        }
        return false // Не включаем в посты
      }
      return true // Это пост
    })
  } else if (Array.isArray(data)) {
    rawPosts = data
  } else if (asArray(feedRecord.result)) {
    rawPosts = asArray(feedRecord.result)!
  } else if (asArray(feedRecord.posts)) {
    rawPosts = asArray(feedRecord.posts)!
  } else if (asArray(feedRecord.contents)) {
    rawPosts = asArray(feedRecord.contents)!
  } else {
    return []
  }

  return rawPosts.map((post, index) => adaptPostData(post, index, usersMap))
}

/**
 * @deprecated Используйте useHierarchicalStrip из use-feed-queries.ts
 * Оставлено для обратной совместимости
 */
export { useHierarchicalStrip, useTopFeed } from './use-feed-queries'
