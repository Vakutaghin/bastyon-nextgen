<template>
  <PriceEditor />

  <SC_PaidSection>
    <SC_PaidSectionTitle>{{ t('paidSubscriptions.subscribers.title') }}</SC_PaidSectionTitle>

    <SC_Empty v-if="loading && !payments">{{ t('paidSubscriptions.loading') }}</SC_Empty>
    <SC_Empty v-else-if="failed && !payments">
      {{ t('paidSubscriptions.subscribers.error') }}
      <div>
        <SC_Collapse type="button" @click="reload">{{ t('paidSubscriptions.retry') }}</SC_Collapse>
      </div>
    </SC_Empty>

    <template v-else-if="payments">
      <SC_Stats>
        <SC_Stat>
          <SC_StatLabel>{{ t('paidSubscriptions.subscribers.active') }}</SC_StatLabel>
          <SC_StatValue>{{ active.length }}</SC_StatValue>
        </SC_Stat>
        <SC_Stat>
          <SC_StatLabel>{{ t('paidSubscriptions.subscribers.month') }}</SC_StatLabel>
          <SC_StatValue>{{ formatPkoin(incomeMonth) }} PKOIN</SC_StatValue>
        </SC_Stat>
        <SC_Stat>
          <SC_StatLabel>{{ t('paidSubscriptions.subscribers.year') }}</SC_StatLabel>
          <SC_StatValue>{{ formatPkoin(incomeYear) }} PKOIN</SC_StatValue>
        </SC_Stat>
      </SC_Stats>

      <SC_Empty v-if="!rows.length">{{ t('paidSubscriptions.subscribers.empty') }}</SC_Empty>

      <SC_List v-if="active.length">
        <CounterpartyRow
          v-for="row in active"
          :key="row.address"
          :row="row"
          :warning="warningFor(row.address)"
        />
      </SC_List>

      <template v-if="ended.length">
        <SC_Collapse type="button" :aria-expanded="showEnded" @click="showEnded = !showEnded">
          {{ t('paidSubscriptions.subscribers.ended', { count: ended.length }) }}
          {{ showEnded ? '▴' : '▾' }}
        </SC_Collapse>
        <SC_List v-if="showEnded">
          <CounterpartyRow v-for="row in ended" :key="row.address" :row="row" />
        </SC_List>
      </template>
    </template>
  </SC_PaidSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain'
import { summarize, sumSince, yearAgo } from '@/helpers/paid-subscription/ledger'
import { MONTH_SECONDS } from '@/helpers/paid-subscription/plans'
import { formatPkoin } from '@/helpers/paid-subscription/format'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import CounterpartyRow from './counterparty-row.vue'
import PriceEditor from './price-editor.vue'
import { useMySubscribers } from './use-my-subscribers'
import {
  SC_PaidSection,
  SC_PaidSectionTitle,
  SC_Stats,
  SC_Stat,
  SC_StatLabel,
  SC_StatValue,
  SC_List,
  SC_Empty,
  SC_Collapse,
} from './paid-subscriptions-page.styled'

const { t } = useI18n()
const authStore = useAuthStore()
const store = usePaidSubscriptionsStore()
const { payments, followers, loading, failed, load } = useMySubscribers()

const me = computed(() => authStore.getUserAddress || '')
const showEnded = ref(false)

/**
 * Сроки — по цене, которую видят подписчики: подтверждённой сетью. Пока
 * новая цена не в блоке, их клиенты считают по старой.
 */
const price = computed(() => store.confirmedPriceOf(me.value) ?? store.priceOf(me.value) ?? 0)

const rows = computed(() =>
  payments.value ? summarize(payments.value, 'from', () => price.value, store.now) : []
)
const active = computed(() => rows.value.filter((r) => r.status.kind === 'active'))
const ended = computed(() => rows.value.filter((r) => r.status.kind !== 'active'))

const incomeMonth = computed(() => sumSince(payments.value ?? [], store.now - MONTH_SECONDS))
const incomeYear = computed(() => sumSince(payments.value ?? [], yearAgo(store.now)))

/** Заплатил, но не подписан — платные посты не видит. */
function warningFor(address: string): string | undefined {
  const list = followers.value
  return list && !list.has(address) ? t('paidSubscriptions.subscribers.notFollowing') : undefined
}

function reload(): void {
  void load(me.value)
}

onMounted(() => {
  void store.ensurePrice(me.value)
  reload()
})
</script>
