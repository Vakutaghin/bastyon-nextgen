import { describe, it, expectTypeOf } from 'vitest'

import type { AdaptedPost } from './adapted-post'
import type { AdaptedPost as FeedAdaptedPost } from '@/composables/use-feed'
import type { AdaptedPost as MapperAdaptedPost } from '@/helpers/common/post-mapper'

// Контракт один: реэкспорты из use-feed и post-mapper — тот же тип, а не копии.
describe('AdaptedPost — канонический контракт', () => {
  it('use-feed и post-mapper реэкспортируют один и тот же тип', () => {
    expectTypeOf<FeedAdaptedPost>().toEqualTypeOf<AdaptedPost>()
    expectTypeOf<MapperAdaptedPost>().toEqualTypeOf<AdaptedPost>()
  })
})
