<template>
  <SC_Votes v-if="comment" data-testid="notification-votes">
    <SC_VoteButton
      type="button"
      data-testid="notification-like"
      :class="{ voted: liked }"
      :disabled="!canLike"
      :aria-pressed="liked"
      :aria-label="t('header.likeComment', { n: scores.up })"
      @click.stop="emit('like')"
    >
      👍 {{ compactScore(scores.up) }}
    </SC_VoteButton>
    <SC_VoteButton
      type="button"
      data-testid="notification-dislike"
      :class="{ voted: disliked }"
      :disabled="!canDislike"
      :aria-pressed="disliked"
      :aria-label="t('header.dislikeComment', { n: scores.down })"
      @click.stop="emit('dislike')"
    >
      👎 {{ compactScore(scores.down) }}
    </SC_VoteButton>
  </SC_Votes>
</template>

<script setup lang="ts">
// Лайк и дизлайк комментария прямо в уведомлении — как под постом. Пока
// оценки не пришли с ноды, кнопок нет: нажать вслепую — значит не увидеть, что
// вы уже оценили.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { compressedNumber } from '@/b-components/content/post-card/components/post-card-comments/helpers'
import type {
  useCommentVoting,
  VotableComment,
} from '@/b-components/content/post-card/components/post-card-comments/composables/use-comment-voting'
import { SC_VoteButton, SC_Votes } from './styled'

const props = defineProps<{
  comment: VotableComment | undefined
  voting: ReturnType<typeof useCommentVoting>
}>()

const emit = defineEmits<{ like: []; dislike: [] }>()

const { t } = useI18n()

const NONE = { id: '', address: '' }
const target = computed<VotableComment>(() => props.comment ?? NONE)
const liked = computed(() => props.voting.isCommentLiked(target.value))
const disliked = computed(() => props.voting.isCommentDisliked(target.value))
const scores = computed(() => props.voting.commentScores(target.value))
const canLike = computed(() => props.voting.commentCanClickLike(target.value))
const canDislike = computed(() => props.voting.commentCanClickDislike(target.value))

const compactScore = (n: number): string => (n ? compressedNumber(n) || String(n) : '0')
</script>
