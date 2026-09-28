<template>
  <SC_Poll role="group" :aria-label="t('poll.label')">
    <SC_Question>
      <PollIcon />
      <span>{{ poll.title }}</span>
    </SC_Question>

    <SC_Options>
      <li v-for="(option, i) in poll.options" :key="i">
        <SC_Option
          type="button"
          :class="{ chosen: myVote === i, results: showResults, idle: !interactive }"
          :disabled="voting || (!interactive && isAuthenticated)"
          :aria-pressed="myVote === i"
          @click="vote(i)"
        >
          <SC_Bar v-if="showResults" :share="`${percent(i)}%`" aria-hidden="true" />
          <SC_OptionText>{{ option }}</SC_OptionText>
          <CheckOutlined v-if="myVote === i" />
          <SC_Percent v-if="showResults">{{ percent(i) }}%</SC_Percent>
        </SC_Option>
      </li>
    </SC_Options>

    <SC_Footer>
      <span>{{ total ? t('poll.votes', { n: total }, total) : t('poll.noVotes') }}</span>
      <SC_Note v-if="pending">{{ t('poll.pending') }}</SC_Note>
      <SC_Note v-else-if="loadFailed">{{ t('poll.loadFailed') }}</SC_Note>
    </SC_Footer>
  </SC_Poll>
</template>

<script setup lang="ts">
// Опрос в посте: вопрос и варианты. До своего голоса варианты — кнопки, после
// него (и у гостя) — итоги с полосками. Голос — комментарий к посту, его ждёт
// подтверждение сети; до тех пор он отмечен как отправленный.
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '@/blockchain'
import { CheckOutlined, PollIcon } from '@/components/icons'
import type { PostPoll } from '@/helpers/content/poll'
import { usePostPollVotes } from './use-post-poll-votes'
import {
  SC_Bar,
  SC_Footer,
  SC_Note,
  SC_Option,
  SC_OptionText,
  SC_Options,
  SC_Percent,
  SC_Poll,
  SC_Question,
} from './styled'

const props = defineProps<{
  postId: string
  poll: PostPoll
  /** Пост ещё не в блокчейне: голосовать под ним пока нельзя. */
  postPending?: boolean
}>()

const { t } = useI18n()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isUserAuthenticated)

const { counts, total, myVote, pending, canVote, voting, loadFailed, vote } = usePostPollVotes(
  toRef(props, 'postId'),
  toRef(props, 'poll')
)

const interactive = computed(() => canVote.value && !props.postPending)
/** Итоги видны после своего голоса и гостю — он проголосовать не может. */
const showResults = computed(() => myVote.value !== null || !isAuthenticated.value)

function percent(index: number): number {
  return total.value ? Math.round(((counts.value[index] ?? 0) / total.value) * 100) : 0
}
</script>
