import { defineComponent, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserState } from '@/composables/use-user-queries'
import { useAuthStore } from '@/blockchain'
import {
  SC_LimitsWork,
  SC_LimitsPage,
  SC_LimitsTitle,
  SC_LimitsList,
  SC_LimitRow,
  SC_LimitLabel,
  SC_LimitValue,
  SC_LimitValueMuted,
  SC_LimitsLoading,
  SC_LimitsError,
} from './limits-page.styled'

/** Все типы лимитов как в оригинальном приложении (ustate metrics) */
const LIMIT_ITEMS: { key: string; label: string }[] = [
  { key: 'post', label: 'Количество постов' },
  { key: 'video', label: 'Количество постов с видео' },
  { key: 'audio', label: 'Количество постов с аудио' },
  { key: 'score', label: 'Количество звёзд' },
  { key: 'comment', label: 'Количество комментариев' },
  { key: 'comment_score', label: 'Количество оценок комментариев' },
  { key: 'complain', label: 'Количество жалоб' },
  { key: 'article', label: 'Количество статей' },
]

export default defineComponent({
  name: 'LimitsPage',
  components: {
    SC_LimitsWork,
    SC_LimitsPage,
    SC_LimitsTitle,
    SC_LimitsList,
    SC_LimitRow,
    SC_LimitLabel,
    SC_LimitValue,
    SC_LimitValueMuted,
    SC_LimitsLoading,
    SC_LimitsError,
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const { data: stateData, isLoading, isError, error } = useUserState()

    const userState = computed(() => {
      const d = stateData.value
      if (d && d.result === 'success' && d.data != null) {
        const raw = d.data
        if (Array.isArray(raw) && raw.length > 0) return raw[0]
        if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
      }
      return (authStore.getUserState ?? authStore.getUserProfile) as Record<string, unknown> | null
    })

    const limitRows = computed(() => {
      const state = userState.value
      if (!state) return []
      return LIMIT_ITEMS.map(({ key, label }) => {
        const unspent = Number(state[`${key}_unspent`] ?? 0)
        const spent = Number(state[`${key}_spent`] ?? 0)
        const total = unspent + spent
        return { key, label, unspent, spent, total }
      })
    })

    /** Репутация и Статус как в оригинале (reputation.html) */
    const reputationValue = computed(() => {
      const state = userState.value
      if (!state || state.reputation == null) return null
      const r = Number(state.reputation)
      return Number.isFinite(r) ? r.toFixed(1) : null
    })
    const statusValue = computed(() => {
      const state = userState.value
      if (!state) return null
      const s = state.s
      if (s && typeof s === 'string') return s
      return state.trial ? 'Триал' : 'Топ'
    })

    const hasAnyData = computed(
      () =>
        limitRows.value.length > 0 ||
        reputationValue.value != null ||
        statusValue.value != null
    )
    const showLoading = computed(
      () => isLoading.value && !authStore.getUserState && !authStore.getUserProfile
    )

    watch(
      () => authStore.isUserAuthenticated,
      (isAuth) => {
        if (!isAuth) {
          router.replace('/')
        }
      },
      { immediate: true }
    )

    return {
      isLoading,
      showLoading,
      isError,
      error,
      limitRows,
      reputationValue,
      statusValue,
      hasAnyData,
    }
  },
})
