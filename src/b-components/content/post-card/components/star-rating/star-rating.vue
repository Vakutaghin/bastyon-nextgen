<template>
  <APopover v-model:open="authPopoverVisible" trigger="click" placement="bottom">
    <template #content>
      <SC_AuthPopoverContent>
        <p>Войдите или зарегистрируйтесь, чтобы оценивать посты</p>
        <AButton type="primary" size="small" @click="openAuthModal">Войти</AButton>
      </SC_AuthPopoverContent>
    </template>
    <!-- Обёртка перехватывает клик до popover, чтобы решить — открывать его или сразу
         засчитывать голос (через handleRatingClick). -->
    <div style="display: inline-block" @click.capture="handleRatingClick">
      <SC_StarRating class="star-rating">
        <template v-for="n in 5" :key="`star-${n}`">
          <SC_StarWrapper
            :class="{ disabled: disabled || isSubmitting, readonly: hasVoted }"
            @mouseenter="handleStarHover(n)"
            @mouseleave="handleStarLeave"
            @click="(e) => handleStarClick(n, e)"
          >
            <!-- Пустая контурная звезда (фон) — всегда видна. -->
            <StarOutlined class="star-bg" :style="{ color: 'rgba(255, 193, 7, 0.3)' }" />

            <!-- Полностью заполненная звезда поверх. -->
            <SC_StarFilled v-if="displayRating >= n">
              <StarFilled class="star-fill" :style="ICON_WARNING" />
            </SC_StarFilled>
          </SC_StarWrapper>
        </template>

        <span class="star-count">({{ optimisticAverageRating.toFixed(1) }})</span>
        <span class="voters-count">
          <UserOutlined />
          {{ optimisticVotersCount }}
        </span>
      </SC_StarRating>
    </div>
  </APopover>
</template>

<script setup lang="ts">
import { Popover as APopover, Button as AButton } from 'ant-design-vue'
import { StarOutlined, StarFilled, UserOutlined } from '@ant-design/icons-vue'
import { useStarRating } from './use-star-rating'
import { SC_AuthPopoverContent, SC_StarRating, SC_StarWrapper, SC_StarFilled } from './styled'
import { ICON_WARNING } from '@/styles/icon-styles'

const props = withDefaults(
  defineProps<{
    rating: number
    votersCount?: number
    shareId: string
    contentAuthorAddress: string
    userVote?: number
    scoreSum?: number
    disabled?: boolean
  }>(),
  { votersCount: 0, userVote: undefined, scoreSum: 0, disabled: false }
)

const emit = defineEmits<{
  'rating-change': [rating: number]
  error: [error: unknown]
}>()

const {
  authPopoverVisible,
  isSubmitting,
  hasVoted,
  displayRating,
  optimisticAverageRating,
  optimisticVotersCount,
  handleStarHover,
  handleStarLeave,
  handleStarClick,
  handleRatingClick,
  openAuthModal,
} = useStarRating(props, emit)
</script>
