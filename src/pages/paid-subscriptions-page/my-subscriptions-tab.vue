<template>
  <SC_PaidSection>
    <SC_PaidLead>{{ t('paidSubscriptions.mine.lead') }}</SC_PaidLead>

    <SC_Empty v-if="!ready && !store.myPaymentsError">{{
      t('paidSubscriptions.loading')
    }}</SC_Empty>
    <SC_Empty v-else-if="!ready">
      {{ t('paidSubscriptions.mine.error') }}
      <div>
        <SC_Collapse type="button" @click="load(true)">{{
          t('paidSubscriptions.retry')
        }}</SC_Collapse>
      </div>
    </SC_Empty>
    <SC_Empty v-else-if="!rows.length">{{ t('paidSubscriptions.mine.empty') }}</SC_Empty>

    <SC_List v-else>
      <CounterpartyRow v-for="row in rows" :key="row.address" :row="row" :warning="warningFor(row)">
        <SC_RowAction v-if="actionFor(row)" type="button" @click="store.openModal(row.address)">
          {{ actionFor(row) }}
        </SC_RowAction>
      </CounterpartyRow>
    </SC_List>
  </SC_PaidSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { summarize, type PaidCounterparty } from '@/helpers/paid-subscription/ledger'
import { paidPurchaseSupported, usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import CounterpartyRow from './counterparty-row.vue'
import {
  SC_PaidSection,
  SC_PaidLead,
  SC_List,
  SC_Empty,
  SC_Collapse,
  SC_RowAction,
} from './paid-subscriptions-page.styled'

const { t } = useI18n()
const store = usePaidSubscriptionsStore()
const relations = useUserRelationsStore()

/** Платежи и цены всех авторов загружены. */
const pricesLoaded = ref(false)
const ready = computed(() => store.myPayments !== null && pricesLoaded.value)

const rows = computed<PaidCounterparty[]>(() =>
  ready.value ? summarize(store.allMyPayments, 'to', (a) => store.priceOf(a) ?? 0, store.now) : []
)

async function load(force = false): Promise<void> {
  pricesLoaded.value = false
  await store.ensureMyPayments(force)
  const authors = new Set(store.allMyPayments.map((p) => p.to))
  await Promise.all([...authors].map((a) => store.ensurePrice(a, force)))
  pricesLoaded.value = true
}

/** «Продлить» — пока срок идёт и есть что доплатить; «Оформить снова» — когда кончился. */
function actionFor(row: PaidCounterparty): string {
  if (!paidPurchaseSupported()) return ''
  const status = row.status
  if (status.kind === 'active' && status.offers.length) return t('paidSubscriptions.mine.extend')
  if (status.kind === 'inactive' && status.offers.length) return t('paidSubscriptions.mine.renew')
  return ''
}

/** Оплачено, но нет обычной подписки — платные посты не откроются. */
function warningFor(row: PaidCounterparty): string | undefined {
  const paid = row.status.kind === 'active' || row.status.kind === 'open'
  return paid && !relations.isSubscribed(row.address)
    ? t('paidSubscriptions.mine.notFollowing')
    : undefined
}

onMounted(() => {
  void load()
})
</script>
