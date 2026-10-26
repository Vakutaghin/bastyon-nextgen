// Типы для блока комментариев поста

/** Пост в минимальном виде для блока комментариев */
export interface PostForComments {
  id?: string | number
  hash?: string
  txid?: string
  comments?: number
  /**
   * Автор поста. В `AdaptedPost` адрес лежит именно здесь; плоского `address`
   * у адаптированного поста нет — на этом ломались модерация автором,
   * `disableBannedByAuthor` и буст автора в сортировке (V31).
   */
  author?: {
    address?: string
  }
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
    /** Автор поста заблокировал комментатора — превью свёрнуто, как в обсуждении. */
    blockedByPostAuthor?: boolean
    /** Репутация комментатора, если его профиль пришёл с лентой. */
    authorReputation?: number
    /** Оценка текущего пользователя: 1 — лайк, -1 — дизлайк, 0/нет — не голосовал */
    myScore?: number
  }
}

/** Порядок сортировки комментариев */
export type CommentsSortOrder = 'interesting' | 'newest' | 'oldest'

/** Цель ответа: на какой комментарий отвечаем */
export interface ReplyTarget {
  /** ID комментария или 'root' для комментария к посту */
  commentId: string
  /** ID родительского комментария для API */
  parentId: string
  /** Префикс @Имя в поле ввода */
  prefix: string
}

/** Пользователь для автокомплита @упоминаний */
export interface MentionUser {
  address: string
  name: string
}

/** Действие контекстного меню комментария (comment-menu.vue). */
export type CommentMenuAction =
  | 'edit'
  | 'delete'
  | 'block'
  | 'unblock'
  | 'share'
  | 'donate'
  | 'report'
  | 'chain'
