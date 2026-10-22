<template>
  <SC_Card>
    <SC_Row>
      <SC_Icon aria-hidden="true">💎</SC_Icon>
      <SC_Body>
        <SC_Caption>{{ isOutgoing ? t('chat.pkoinSent') : t('chat.pkoinReceived') }}</SC_Caption>
        <SC_Amount>{{ amountLabel }}</SC_Amount>
      </SC_Body>
    </SC_Row>

    <SC_Note v-if="tx.message">{{ tx.message }}</SC_Note>

    <SC_Footer>
      <SC_Txid :title="tx.txid">{{ shortTxid }}</SC_Txid>
      <SC_ExplorerLink :href="explorerUrl" @click.prevent="openChainInfo">
        {{ t('chainInfo.action') }}
      </SC_ExplorerLink>
    </SC_Footer>
  </SC_Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChainInfoStore } from '@/stores/chain-info-store'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import { formatPkoinAmount, type PkoinTransferInfo } from '../../lib/pkoin-transfer'
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

const props = defineProps<{
  message: Message
}>()

const { t } = useI18n()
const store = useMessengerStore()

const tx = computed<PkoinTransferInfo>(
  () => (props.message.info?.transaction as PkoinTransferInfo) || ({} as PkoinTransferInfo)
)

const isOutgoing = computed<boolean>(() => {
  return props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
})

const amountLabel = computed<string>(() => `${formatPkoinAmount(Number(tx.value.amount))} PKOIN`)

const shortTxid = computed<string>(() => {
  const txid = tx.value.txid || ''
  if (txid.length < 12) return txid
  return `${txid.slice(0, 6)}…${txid.slice(-4)}`
})

const explorerUrl = computed<string>(() => {
  return `/explorer/tx/${encodeURIComponent(tx.value.txid)}`
})

/**
 * Перевод — в модалке «В блокчейне» поверх чата: посмотрел и вернулся к
 * переписке. Если из модалки уйти в эксплорер или профиль, полноэкранный чат
 * закрывается — иначе он перекрыл бы страницу.
 */
function openChainInfo(): void {
  if (!tx.value.txid) return
  useChainInfoStore().open(
    { kind: 'tx', txid: tx.value.txid },
    {
      onLeave: () => {
        store.isFullScreen = false
      },
    }
  )
}
</script>
