<template>
  <SC_RatingRow>
    <Popover v-model:open="authPopoverVisible" trigger="click" placement="bottom">
      <template #content>
        <SC_AuthPopoverContent>
          <p>{{ t('postCard.authPrompt') }}</p>
          <Button type="primary" size="small" @click="openAuthModal">{{
            t('postCard.login')
          }}</Button>
        </SC_AuthPopoverContent>
      </template>
      <!-- Обёртка перехватывает клик до popover, чтобы решить — открывать его или сразу
           засчитывать голос (через handleRatingClick). -->
      <SC_InlineBlock @click.capture="handleRatingClick">
        <!-- С клавиатуры: одна остановка Tab на всю строку, стрелки выбирают
             звезду (она закрашивается, как при наведении), Enter или пробел
             ставят оценку. Оценку не отменить, поэтому стрелка её не ставит. -->
        <SC_StarRating class="star-rating" role="group" :aria-label="groupLabel">
          <template v-for="n in 5" :key="`star-${n}`">
            <SC_StarWrapper
              v-key-activate
              :class="{ disabled: disabled || isOwnPost, readonly: hasVoted }"
              :title="isOwnPost ? t('postCard.ratingOwnPost') : undefined"
              role="button"
              :data-star="n"
              :tabindex="focusStar === n ? 0 : -1"
              :aria-label="t('a11y.rateStars', { n })"
              :aria-pressed="pressed(n)"
              :aria-disabled="disabled || isOwnPost || hasVoted ? 'true' : undefined"
              @mouseenter="handleStarHover(n)"
              @mouseleave="handleStarLeave"
              @focus="handleStarHover(n)"
              @blur="handleStarLeave"
              @keydown="(e: KeyboardEvent) => onStarKey(e, n)"
              @click="(e) => handleStarClick(n, e)"
            >
              <!-- Пустая контурная звезда (фон) — всегда видна. -->
              <StarOutlined class="star-bg" :style="ICON_WARNING_TRACK" />

              <!-- Полностью заполненная звезда поверх. -->
              <SC_StarFilled v-if="displayRating >= n">
                <StarFilled class="star-fill" :style="ICON_WARNING" />
              </SC_StarFilled>
            </SC_StarWrapper>
          </template>

          <span v-if="heldValue === null" class="star-count">
            ({{ optimisticAverageRating.toFixed(1) }})
          </span>
        </SC_StarRating>
      </SC_InlineBlock>
    </Popover>

    <!-- Оценка ещё не ушла: вместо чисел — «Отменить» с отсчётом. Место то же,
         и кнопки поста рядом не прыгают. -->
    <template v-if="heldValue !== null">
      <SC_HoldButton
        type="button"
        :title="t('postCard.ratingHoldHint')"
        data-testid="rating-undo"
        @click.stop="cancelHold"
      >
        {{ t('postCard.ratingUndo') }}
        <span class="seconds" aria-hidden="true">{{ holdSeconds }}</span>
      </SC_HoldButton>
      <span class="sr-status" role="status">{{
        t('postCard.ratingHoldStatus', { n: heldValue })
      }}</span>
    </template>

    <!-- Число оценок — кто и как оценил, как в прежнем Bastyon. Вне окна входа:
         смотреть можно и гостю. -->
    <SC_VotersButton
      v-else-if="optimisticVotersCount > 0"
      type="button"
      class="voters-count"
      :title="t('postScores.open')"
      :aria-label="t('postScores.openCount', { n: optimisticVotersCount }, optimisticVotersCount)"
      data-testid="post-scores-open"
      @click="scoresOpen = true"
    >
      <UserOutlined />
      {{ optimisticVotersCount }}
    </SC_VotersButton>
    <span v-else class="voters-count">
      <UserOutlined />
      {{ optimisticVotersCount }}
    </span>

    <PostScoresModal
      v-if="scoresMounted"
      v-model:open="scoresOpen"
      :txid="shareId"
      :user-vote="userVote || submittedValue || undefined"
    />
  </SC_RatingRow>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { vKeyActivate } from '@/helpers/a11y/key-activate'
import { useI18n } from 'vue-i18n'
import Popover from '@/components/popover'
import Button from '@/components/button'
import { StarOutlined, StarFilled, UserOutlined } from '@/components/icons'
import { useStarRating } from './use-star-rating'
import {
  SC_AuthPopoverContent,
  SC_HoldButton,
  SC_StarRating,
  SC_StarWrapper,
  SC_StarFilled,
  SC_InlineBlock,
  SC_RatingRow,
  SC_VotersButton,
} from './styled'
import { ICON_WARNING, ICON_WARNING_TRACK } from '@/styles/icon-styles'

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
  error: [error: unknown]
}>()

const { t } = useI18n()

const {
  authPopoverVisible,
  hasVoted,
  heldValue,
  holdSeconds,
  submittedValue,
  displayRating,
  optimisticAverageRating,
  optimisticVotersCount,
  isOwnPost,
  handleStarHover,
  handleStarLeave,
  handleStarClick,
  handleRatingClick,
  cancelHold,
  openAuthModal,
} = useStarRating(props, emit)

/** Нажатая звезда — для экранного диктора. */
function pressed(n: number): 'true' | 'false' | undefined {
  if (!hasVoted.value && heldValue.value === null) return undefined
  return displayRating.value === n ? 'true' : 'false'
}

/** Звезда, на которую встаёт Tab (остальные — стрелками). */
const focusStar = ref(1)
const groupLabel = computed(() =>
  t('a11y.ratingGroup', { avg: optimisticAverageRating.value.toFixed(1) })
)

/** Стрелки, Home и End — фокус на соседнюю звезду; оценка — только Enter или пробел. */
function onStarKey(e: KeyboardEvent, n: number): void {
  const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
  let next: number | null = null
  if (e.key in step) next = Math.min(5, Math.max(1, n + step[e.key]!))
  else if (e.key === 'Home') next = 1
  else if (e.key === 'End') next = 5
  if (next === null) return
  e.preventDefault()
  focusStar.value = next
  const row = (e.currentTarget as HTMLElement).closest('.star-rating')
  row?.querySelector<HTMLElement>(`[data-star="${next}"]`)?.focus()
}

// Окно «кто оценил» — отдельный чанк, грузится при первом открытии.
const PostScoresModal = defineAsyncComponent(() => import('../post-scores/post-scores-modal.vue'))
const scoresOpen = ref(false)
const scoresMounted = ref(false)
watch(scoresOpen, (open) => {
  if (open) scoresMounted.value = true
})
</script>
