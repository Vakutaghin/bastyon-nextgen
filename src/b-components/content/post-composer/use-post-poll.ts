// Опрос в композере поста: заголовок + 2..MAX_POLL_OPTIONS вариантов, очищенная
// форма для payload. Вынесено из use-post-composer (по образцу use-post-tags).
import { computed, ref } from 'vue'
import { MAX_POLL_OPTIONS } from './consts'

const MIN_POLL_OPTIONS = 2
const emptyOptions = (): string[] => Array.from({ length: MIN_POLL_OPTIONS }, () => '')

export function usePostPoll() {
  const pollActive = ref(false)
  const pollTitle = ref('')
  const pollOptions = ref<string[]>(emptyOptions())

  /** Очищенный опрос (если активен): { title, list } непустых опций; иначе undefined. */
  const cleanedPoll = computed(() => {
    if (!pollActive.value) return undefined
    const list = pollOptions.value.map((o) => o.trim()).filter(Boolean)
    return { title: pollTitle.value.trim(), list }
  })

  const togglePoll = (active: boolean): void => {
    pollActive.value = active
    if (!active) {
      pollTitle.value = ''
      pollOptions.value = emptyOptions()
    }
  }
  const setPollTitle = (value: string): void => {
    pollTitle.value = value
  }
  const setPollOption = (index: number, value: string): void => {
    pollOptions.value = pollOptions.value.map((o, i) => (i === index ? value : o))
  }
  const addPollOption = (): void => {
    if (pollOptions.value.length < MAX_POLL_OPTIONS) pollOptions.value = [...pollOptions.value, '']
  }
  const removePollOption = (index: number): void => {
    if (pollOptions.value.length > MIN_POLL_OPTIONS) {
      pollOptions.value = pollOptions.value.filter((_, i) => i !== index)
    }
  }
  const resetPoll = (): void => {
    pollActive.value = false
    pollTitle.value = ''
    pollOptions.value = emptyOptions()
  }

  return {
    pollActive,
    pollTitle,
    pollOptions,
    cleanedPoll,
    togglePoll,
    setPollTitle,
    setPollOption,
    addPollOption,
    removePollOption,
    resetPoll,
  }
}
