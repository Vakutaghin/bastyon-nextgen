<template>
  <SC_ExplorerWork>
    <SC_ExplorerPage>
      <ExplorerHeader />

      <LargeWalletsCard />

      <TopAddressesCard />
    </SC_ExplorerPage>
  </SC_ExplorerWork>
</template>

<script setup lang="ts">
import ExplorerHeader from '../components/explorer-header/explorer-header.vue'
import LargeWalletsCard from '../components/large-wallets/large-wallets-card.vue'
import TopAddressesCard from '../components/top-addresses/top-addresses-card.vue'
import { SC_ExplorerWork, SC_ExplorerPage } from '../block-explorer-page.styled'

defineOptions({ name: 'ExplorerWalletsPage' })
</script>
