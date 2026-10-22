<template>
  <SC_TxMetaGrid>
    <SC_TxMetaCell v-for="i in 6" :key="`chain-sk-${i}`">
      <SC_TxMetaLabel><Skeleton :width="90" :height="10" /></SC_TxMetaLabel>
      <SC_TxMetaValue><Skeleton width="80%" :height="16" /></SC_TxMetaValue>
    </SC_TxMetaCell>
  </SC_TxMetaGrid>
</template>

<script setup lang="ts">
import { Skeleton } from '@/components'
import {
  SC_TxMetaGrid,
  SC_TxMetaCell,
  SC_TxMetaLabel,
  SC_TxMetaValue,
} from '@/pages/block-explorer-page/tx-page/tx-page.styled'

defineOptions({ name: 'ChainInfoSkeleton' })
</script>
