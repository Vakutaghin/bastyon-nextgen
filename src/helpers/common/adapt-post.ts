/**
 * Единственный адаптер поста: сырой ответ ноды → `AdaptedPost`.
 *
 * Раньше их было два — богатый в `use-feed.ts` (лента) и усечённый здесь
 * (страница поста, embed, превью в чате). Усечённый не знал про `myVal`,
 * `lastComment`, `preview`, автора репоста и pending, поэтому повторная оценка
 * из embed уходила в `DoubleScore`, а превью статьи в чате рисовалось сырым
 * JSON (S22 / X3). Теперь адаптер один, а `use-feed` и `post-mapper` его
 * только реэкспортируют.
 */

import type { AdaptedPost } from '@/types/adapted-post'
import { registerNameAddress } from '@/services/user-resolver'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { normalizeImages } from '@/composables/use-feed-helpers'
import { safeDecode } from '@/helpers/content/safe-decode'
import { isUserVerified } from '@/helpers/profile/is-user-verified'

/** Канонический контракт поста — см. `@/types/adapted-post`. */
export type { AdaptedPost }

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
  /** Язык поста (`l`) — при правке его нельзя терять (V36). */
  l?: string
  /**
   * Настройки поста. Поля открыты (`[key: string]`), потому что у разных
   * ответов ноды состав отличается: в hierarchical strip `t` — строка, у нас в
   * композере — время отложенной публикации.
   */
  s?: { v?: string; f?: string }
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
  const verified = isUserVerified(userprofile)
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
    language: post.l || undefined,
    settings: (post.s as AdaptedPost['settings']) || undefined,
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
