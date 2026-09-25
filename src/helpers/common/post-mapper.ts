/**
 * Маппинг данных поста из API формата в UI формат.
 * Вынесено из feed-store для повторного использования в composables и сторах.
 */

import type { AdaptedPost } from '@/types/adapted-post'

/** Канонический контракт поста — см. `@/types/adapted-post`. */
export type { AdaptedPost }

// Адаптер один на всё приложение (S22/X3) — см. `adapt-post.ts`; модуль
// только переотдаёт его.
export type { RawUserProfile, RawFeedPost } from './adapt-post'
export { adaptPostData, mergeRepostContent } from './adapt-post'
