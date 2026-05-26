<template>
  <SC_Card>
    <SC_Row>
      <SC_Icon aria-hidden="true">💎</SC_Icon>
      <SC_Body>
        <SC_Caption>{{ isOutgoing ? 'Перевод PKOIN' : 'Получено PKOIN' }}</SC_Caption>
        <SC_Amount>{{ amountLabel }}</SC_Amount>
      </SC_Body>
    </SC_Row>

    <SC_Note v-if="tx.message">{{ tx.message }}</SC_Note>

    <SC_Footer>
      <SC_Txid :title="tx.txid">{{ shortTxid }}</SC_Txid>
      <SC_ExplorerLink :href="explorerUrl" target="_blank" rel="noopener noreferrer">
        В эксплорере
      </SC_ExplorerLink>
    </SC_Footer>
  </SC_Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import {
  SC_Card,
  SC_Row,
  SC_Icon,
  SC_Body,
  SC_Caption,
  SC_Amount,
  SC_Note,
  SC_Footer,
  SC_Txid,
  SC_ExplorerLink,
} from './styled'

interface PkoinTx {
  txid: string
  amount: number
  from: string
  to: string
  message?: string
}

const props = defineProps<{
  message: Message
}>()

const store = useMessengerStore()

const tx = computed<PkoinTx>(() => (props.message.info?.transaction as PkoinTx) || ({} as PkoinTx))

const isOutgoing = computed<boolean>(() => {
  return props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
})

const amountLabel = computed<string>(() => {
  const v = Number(tx.value.amount)
  if (!Number.isFinite(v)) return '— PKOIN'
  // Убираем хвостовые нули у дробных
  const formatted = v % 1 === 0 ? v.toString() : v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  return `${formatted} PKOIN`
})

const shortTxid = computed<string>(() => {
  const t = tx.value.txid || ''
  if (t.length < 12) return t
  return `${t.slice(0, 6)}…${t.slice(-4)}`
})

const explorerUrl = computed<string>(() => {
  return `/explorer/tx/${encodeURIComponent(tx.value.txid)}`
})
</script>
