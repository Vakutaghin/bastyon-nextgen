// Голоса опроса под постом: итоги по корневым комментариям, свой голос (в том
// числе ещё не подтверждённый сетью) и отправка голоса. Формат — helpers/content/poll.ts.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'

import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { tallyVotes, type PostPoll } from '@/helpers/content/poll'
import { t } from '@/i18n'
import { usePollVotesStore } from '@/stores/poll-votes-store'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { fetchComments } from '../post-card-comments/helpers/fetch-comments'
import { sendPollVote } from '../post-card-comments/comment-sender'

/** Пока свой голос не подтверждён, итоги перечитываются так часто. */
const RECHECK_MS = 20_000

export function usePostPollVotes(postId: Ref<string>, poll: Ref<PostPoll>) {
  const auth = useAuthStore()
  const store = usePollVotesStore()

  const comments = shallowRef<GetComment[]>([])
  const loaded = ref(false)
  const loadFailed = ref(false)
  const voting = ref(false)

  async function load(): Promise<void> {
    if (!postId.value) return
    try {
      comments.value = await fetchComments(postId.value, '', `poll-${postId.value}-${Date.now()}`)
      loadFailed.value = false
    } catch {
      loadFailed.value = true
    } finally {
      loaded.value = true
    }
  }

  const tally = computed(() => tallyVotes(comments.value, poll.value.options.length))
  watch(tally, (value) => store.setVoteComments(postId.value, value.voteComments), {
    immediate: true,
  })

  const address = computed(() => auth.getUserAddress || '')
  const confirmedVote = computed<number | null>(() =>
    address.value ? (tally.value.byAddress.get(address.value) ?? null) : null
  )
  const pending = computed(() =>
    address.value ? store.pendingFor(address.value, postId.value) : null
  )

  // Голос дошёл до ноды — локальная отметка больше не нужна.
  watch([confirmedVote, pending], ([confirmed, p]) => {
    if (p && confirmed === p.vote) store.removePending(address.value, postId.value)
  })

  /** Свой голос: неподтверждённый важнее — он новее. */
  const myVote = computed<number | null>(() => pending.value?.vote ?? confirmedVote.value)

  /** Итоги с учётом своего неподтверждённого голоса. */
  const counts = computed<number[]>(() => {
    const out = [...tally.value.counts]
    const p = pending.value
    if (p && confirmedVote.value !== p.vote && p.vote < out.length) {
      out[p.vote] = (out[p.vote] ?? 0) + 1
      if (confirmedVote.value !== null)
        out[confirmedVote.value] = (out[confirmedVote.value] ?? 1) - 1
    }
    return out
  })
  const total = computed(() => counts.value.reduce((sum, n) => sum + n, 0))

  const canVote = computed(
    () => auth.isUserAuthenticated && myVote.value === null && !voting.value && loaded.value
  )

  async function vote(index: number): Promise<void> {
    if (!auth.isUserAuthenticated) {
      appToast.info({ message: t('poll.signIn') })
      return
    }
    const option = poll.value.options[index]
    if (!canVote.value || option === undefined) return
    voting.value = true
    try {
      const txid = await sendPollVote(postId.value, index, option)
      store.addPending(address.value, postId.value, index, txid)
    } catch (error) {
      appToast.error({
        message: t('poll.failed'),
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      voting.value = false
    }
  }

  // Пока голос не подтверждён — перечитываем итоги: комментарий-голос
  // появится у ноды через блок-другой.
  let timer: ReturnType<typeof setInterval> | null = null
  watch(
    pending,
    (p) => {
      if (p && !timer) timer = setInterval(() => void load(), RECHECK_MS)
      if (!p && timer) {
        clearInterval(timer)
        timer = null
      }
    },
    { immediate: true }
  )

  onMounted(() => void load())
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return { counts, total, myVote, pending, canVote, voting, loaded, loadFailed, vote }
}
