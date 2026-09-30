/**
 * Сколько публикаций у автора — столько, сколько в ленте его профиля.
 *
 * `postcnt` ноды с лентой расходится: у аккаунта с одним постом бывает 0, у
 * старого — на один меньше, чем постов (проверено 30.09.2026 на живых
 * профилях). Точна сумма `content` по типам публикаций: пост, видео, статья,
 * стрим, аудио. Удаления (207) в неё не входят. Так же считал прежний клиент
 * (components/authorn). `postcnt` — только когда `content` нет вовсе.
 */

import type { UserContent } from '@/types/rpc-responses/user-get'

/** Типы транзакций-публикаций в `content` профиля: 200 пост, 201 видео, 202 статья, 209 стрим, 210 аудио. */
export const PUBLICATION_TYPES = ['200', '201', '202', '209', '210'] as const

export interface PublicationCounts {
  content?: UserContent | null
  postcnt?: number
  publications_count?: number
}

export function publicationsCount(profile: PublicationCounts | null | undefined): number {
  const content = profile?.content
  if (content && typeof content === 'object') {
    const counted = PUBLICATION_TYPES.filter((type) => type in content)
    if (counted.length) {
      return counted.reduce((sum, type) => {
        const n = Number(content[type])
        return Number.isFinite(n) && n > 0 ? sum + n : sum
      }, 0)
    }
  }
  const fromApi = profile?.publications_count ?? profile?.postcnt
  return typeof fromApi === 'number' && Number.isFinite(fromApi) ? fromApi : 0
}
