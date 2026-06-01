<template>
  <SC_TxIOGrid>
    <SC_TxIOColumn>
      <SC_TxIOHeader>{{ t('explorerPage.txIoHeaderVin') }}</SC_TxIOHeader>
      <SC_TxIOItem v-for="(vin, i) in tx.vin" :key="`vin-${i}`">
        <SC_TxIOAddress>
          <AddressLink v-if="vin.address" :address="vin.address" />
          <SC_Subtle v-else-if="vin.coinbase">{{ t('explorerPage.txIoCoinbase') }}</SC_Subtle>
          <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
        </SC_TxIOAddress>
        <SC_TxIOValue v-if="vin.value !== undefined">
          {{ formatExplorerPkoin(vin.value) }} PKOIN
        </SC_TxIOValue>
        <SC_TxIOAnnotation v-if="vin.txid">
          {{ t('explorerPage.txIoVinFrom') }}
          <SC_InlineLink :to="{ name: 'explorer-tx', params: { txid: vin.txid } }">
            {{ shortenHash(vin.txid, 6, 6) }}:{{ vin.vout }}
          </SC_InlineLink>
        </SC_TxIOAnnotation>
      </SC_TxIOItem>
    </SC_TxIOColumn>

    <SC_TxArrow>→</SC_TxArrow>

    <SC_TxIOColumn>
      <SC_TxIOHeader>{{ t('explorerPage.txIoHeaderVout') }}</SC_TxIOHeader>
      <SC_TxIOItem v-for="(vout, i) in tx.vout" :key="`vout-${i}`">
        <SC_TxIOAddress>
          <AddressLink v-if="firstAddress(vout)" :address="firstAddress(vout)" />
          <SC_Subtle v-else>
            {{ t('explorerPage.txIoOpReturn') }}
          </SC_Subtle>
        </SC_TxIOAddress>
        <SC_TxIOValue>{{ formatExplorerPkoin(vout.value) }} PKOIN</SC_TxIOValue>
        <SC_TxIOAnnotation>#{{ vout.n }}</SC_TxIOAnnotation>
      </SC_TxIOItem>
    </SC_TxIOColumn>
  </SC_TxIOGrid>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AddressLink from '../components/shared/address-link.vue'
import { formatExplorerPkoin, shortenHash } from '../components/shared/format-explorer'
import type { Transaction, TxVout } from '@/types/rpc-responses/get-transactions'
import {
  SC_TxIOGrid,
  SC_TxIOColumn,
  SC_TxIOHeader,
  SC_TxIOItem,
  SC_TxIOAddress,
  SC_TxIOValue,
  SC_TxIOAnnotation,
  SC_TxArrow,
  SC_InlineLink,
} from './tx-page.styled'
import {
  SC_Muted,
  SC_Subtle,
} from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'TxIoTable' })

defineProps<{
  tx: Transaction
}>()

const { t } = useI18n()

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

function firstAddress(vout: TxVout): string {
  const a = vout.scriptPubKey?.addresses?.[0]
  return a && a.length > 0 ? a : ''
}
</script>
