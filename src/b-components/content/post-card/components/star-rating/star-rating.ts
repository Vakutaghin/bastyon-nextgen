import { defineComponent } from 'vue'

import { useStarRating } from './use-star-rating'
import type {
  StarRatingProps,
  StarRatingEmits,
} from './types'

export const starRatingOptions = defineComponent({
  name: 'StarRating',
  props: {
    rating: {
      type: Number,
      required: true,
      validator: (value: number) => value >= 0 && value <= 5
    },
    votersCount: {
      type: Number,
      default: 0
    },
    shareId: {
      type: String,
      required: true
    },
    contentAuthorAddress: {
      type: String,
      required: true
    },
    userVote: {
      type: Number,
      default: undefined
    },
    scoreSum: {
      type: Number,
      default: 0
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['rating-change', 'error'],
  setup(
    p: StarRatingProps,
    { emit }: { emit: StarRatingEmits },
  ) {
    return useStarRating(p, emit)
  }
})
