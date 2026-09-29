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
      <SC_ExplorerLink :href="explorerUrl" @click.prevent="openInExplorer">
        {{ t('chat.viewInExplorer') }}
      </SC_ExplorerLink>
    </SC_Footer>
  </SC_Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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

const router = useRouter()

/**
 * Эксплорер — страница самого приложения. Раньше ссылка открывалась с
 * `target="_blank"`: в приложении для компьютера и на телефоне новое окно не
 * открывается, и нажатие ничего не делало. Полноэкранный чат перекрыл бы
 * страницу — закрываем его.
 */
function openInExplorer(): void {
  if (!tx.value.txid) return
  store.isFullScreen = false
  void router.push({ name: 'explorer-tx', params: { txid: tx.value.txid } })
}
</script>
