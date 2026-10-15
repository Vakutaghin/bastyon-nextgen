<template>
  <SC_Row>
    <RouterLink :to="profileRoute" :aria-label="name">
      <Avatar :src="avatar ?? undefined" alt="" :fallback-text="name" :size="40" shape="circle" />
    </RouterLink>

    <SC_RowMain>
      <SC_RowNameLink :to="profileRoute">
        <SC_RowName>{{ name }}</SC_RowName>
      </SC_RowNameLink>
      <SC_RowMeta v-for="line in details" :key="line">{{ line }}</SC_RowMeta>
      <SC_RowWarning v-if="warning">{{ warning }}</SC_RowWarning>
    </SC_RowMain>

    <SC_Term :class="{ active: row.status.kind === 'active' }">{{ term }}</SC_Term>
    <slot />
  </SC_Row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import Avatar from '@/components/avatar/avatar.vue'
import type { PaidCounterparty } from '@/helpers/paid-subscription/ledger'
import { formatPkoin, formatTermDate } from '@/helpers/paid-subscription/format'
import { userAvatar, userName } from '@/services/user-names'
import {
  SC_Row,
  SC_RowMain,
  SC_RowNameLink,
  SC_RowName,
  SC_RowMeta,
  SC_RowWarning,
  SC_Term,
} from './paid-subscriptions-page.styled'

/** Подписчик (у автора) или автор (у подписчика): срок, платежи, предупреждение. */
const props = defineProps<{
  row: PaidCounterparty
  warning?: string
}>()

const { t } = useI18n()

const name = computed(() => userName(props.row.address))
const avatar = computed(() => userAvatar(props.row.address))
const profileRoute = computed(() => ({ name: 'profile', params: { userName: props.row.address } }))

const term = computed<string>(() => {
  const status = props.row.status
  if (status.kind === 'active') {
    return t('paidSubscriptions.page.activeUntil', { date: formatTermDate(status.until) })
  }
  if (status.kind === 'open') return t('paidSubscriptions.page.authorOff')
  if (status.kind === 'unavailable') return t('paidSubscriptions.page.noPrice')
  return status.endedAt
    ? t('paidSubscriptions.page.ended', { date: formatTermDate(status.endedAt) })
    : t('paidSubscriptions.page.notPaid')
})

const details = computed<string[]>(() => {
  const { row } = props
  const lines: string[] = []
  if (row.status.kind === 'active') {
    lines.push(
      t('paidSubscriptions.page.plan', { plan: t(`paidSubscriptions.plans.${row.status.plan}`) })
    )
  }
  lines.push(
    t('paidSubscriptions.page.last', {
      amount: formatPkoin(row.last.amount),
      date: formatTermDate(row.last.time),
    })
  )
  if (row.payments.length > 1) {
    lines.push(t('paidSubscriptions.page.yearTotal', { amount: formatPkoin(row.total) }))
  }
  return lines
})
</script>
