<template>
  <SC_LimitsWork>
    <SC_LimitsPage>
      <SC_LimitsTitle>{{ t('limits.title') }}</SC_LimitsTitle>

      <SC_LimitsLoading v-if="showLoading"> {{ t('limits.loading') }} </SC_LimitsLoading>

      <SC_LimitsError v-else-if="isError && !hasAnyData">
        {{ error?.message || t('limits.loadError') }}
      </SC_LimitsError>

      <template v-else-if="hasAnyData">
        <SC_LimitsList>
          <SC_LimitRow v-if="reputationValue != null">
            <SC_LimitLabel>{{ t('limits.reputation') }}</SC_LimitLabel>
            <SC_LimitValue>{{ reputationValue }}</SC_LimitValue>
          </SC_LimitRow>
          <SC_LimitRow v-if="statusValue != null">
            <SC_LimitLabel>{{ t('limits.status') }}</SC_LimitLabel>
            <SC_LimitValue>{{ statusValue }}</SC_LimitValue>
          </SC_LimitRow>
          <SC_LimitRow v-for="row in limitRows" :key="row.key">
            <SC_LimitLabel>{{ row.label }}</SC_LimitLabel>
            <span>
              <SC_LimitValue>{{ row.unspent }}</SC_LimitValue>
              <SC_LimitValueMuted> / {{ row.total }}</SC_LimitValueMuted>
            </span>
          </SC_LimitRow>
        </SC_LimitsList>
      </template>

      <SC_LimitsLoading v-else>
        {{ t('limits.noData') }}
      </SC_LimitsLoading>
    </SC_LimitsPage>
  </SC_LimitsWork>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useUserState } from '@/composables/use-user-profile'
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

/** Все типы лимитов как в оригинальном приложении (ustate metrics). */
const LIMIT_ITEMS: { key: string; labelKey: string }[] = [
  { key: 'post', labelKey: 'limits.itemPost' },
  { key: 'video', labelKey: 'limits.itemVideo' },
  { key: 'audio', labelKey: 'limits.itemAudio' },
  { key: 'score', labelKey: 'limits.itemScore' },
  { key: 'comment', labelKey: 'limits.itemComment' },
  { key: 'comment_score', labelKey: 'limits.itemCommentScore' },
  { key: 'complain', labelKey: 'limits.itemComplain' },
  { key: 'article', labelKey: 'limits.itemArticle' },
]

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { data: stateData, isLoading, isError, error } = useUserState()

const userState = computed<Record<string, unknown> | null>(() => {
  const d = stateData.value
  if (d && d.result === 'success' && d.data != null) {
    const raw = d.data
    if (Array.isArray(raw) && raw.length > 0) return raw[0] as Record<string, unknown>
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  }
  return (authStore.getUserState ?? authStore.getUserProfile) as Record<string, unknown> | null
})

const limitRows = computed(() => {
  const state = userState.value
  if (!state) return []
  return LIMIT_ITEMS.map(({ key, labelKey }) => {
    const unspent = Number(state[`${key}_unspent`] ?? 0)
    const spent = Number(state[`${key}_spent`] ?? 0)
    return { key, label: t(labelKey), unspent, spent, total: unspent + spent }
  })
})

/** Репутация и Статус как в оригинале (reputation.html). */
const reputationValue = computed<string | null>(() => {
  const state = userState.value
  if (!state || state.reputation == null) return null
  const r = Number(state.reputation)
  return Number.isFinite(r) ? r.toFixed(1) : null
})

const statusValue = computed<string | null>(() => {
  const state = userState.value
  if (!state) return null
  const s = state.s
  if (s && typeof s === 'string') return s
  return state.trial ? t('limits.statusTrial') : t('limits.statusTop')
})

const hasAnyData = computed<boolean>(
  () => limitRows.value.length > 0 || reputationValue.value != null || statusValue.value != null
)

const showLoading = computed<boolean>(
  () => isLoading.value && !authStore.getUserState && !authStore.getUserProfile
)

watch(
  () => authStore.isUserAuthenticated,
  (isAuth) => {
    if (!isAuth) router.replace('/')
  },
  { immediate: true }
)
</script>
