// Типы для блока комментариев поста

/** Пост в минимальном виде для блока комментариев */
export interface PostForComments {
  id?: string | number
  hash?: string
  txid?: string
  comments?: number
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
