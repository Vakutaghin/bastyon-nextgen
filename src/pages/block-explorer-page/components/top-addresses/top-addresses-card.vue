<template>
  <SC_TopCard>
    <SC_TopHeader>
      <SC_TopTitleGroup>
        <SC_TopTitle>
          {{ t('explorerPage.topAddressesTitle') }}
          <InfoTooltip :text='t("explorerPage.topAddressesTooltip")' />
        </SC_TopTitle>
        <SC_TopHint>{{ hint }}</SC_TopHint>
      </SC_TopTitleGroup>
      <SC_TopToggle type='button' :disabled='!hasMore' @click='toggleShowAll'>
        {{ expanded ? t('explorerPage.topAddressesCollapse') : t('explorerPage.topAddressesExpand', { n: maxShown }) }}
      </SC_TopToggle>
    </SC_TopHeader>

    <template v-if='isLoading'>
      <SC_TopRow v-for='i in 6' :key='`sk-${i}`'>
        <SC_TopRank>{{ i }}</SC_TopRank>
        <Skeleton :width='160' :height='14' />
        <SC_TopVolume><Skeleton :width='60' :height='12' /></SC_TopVolume>
        <SC_TopCount><Skeleton :width='40' :height='12' /></SC_TopCount>
      </SC_TopRow>
    </template>

    <SC_Placeholder v-else-if='error'>
      {{ t('explorerPage.topAddressesError') }}
    </SC_Placeholder>

    <SC_Placeholder v-else-if='!visibleAddresses.length'>
      {{ t('explorerPage.topAddressesEmpty') }}
    </SC_Placeholder>

    <template v-else>
      <SC_TopRow v-for='(row, idx) in visibleAddresses' :key='row.address'>
        <SC_TopRank>{{ idx + 1 }}</SC_TopRank>
        <AddressLink :address='row.address' />
        <SC_TopVolume :title='t("explorerPage.topAddressesVolumeTooltip")'>
          {{ formatExplorerPkoin(row.volumeIn + row.volumeOut) }} PKOIN
        </SC_TopVolume>
        <SC_TopCount :title='t("explorerPage.topAddressesCountTooltip")'>
          {{ t('explorerPage.topAddressesTxCount', { n: row.txCount }) }}
        </SC_TopCount>
      </SC_TopRow>
    </template>
  </SC_TopCard>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActiveAddresses } from '@/composables/use-active-addresses'
import AddressLink from '../shared/address-link.vue'
import InfoTooltip from '../shared/info-tooltip.vue'
import { formatExplorerPkoin } from '../shared/format-explorer'
import { Skeleton } from '@/components'
import {
  SC_TopCard,
  SC_TopHeader,
  SC_TopTitleGroup,
  SC_TopTitle,
  SC_TopHint,
  SC_TopToggle,
  SC_TopRow,
  SC_TopRank,
  SC_TopVolume,
  SC_TopCount,
  SC_Placeholder,
} from './top-addresses-card.styled'

defineOptions({ name: 'TopAddressesCard' })

const { t } = useI18n()

const TOP_SHORT = 10
const TOP_FULL = 30

const expanded = ref(false)
const maxShown = TOP_FULL

const { data, isLoading, error } = useActiveAddresses({ blockDepth: 50, txLimit: 100 })

const addresses = computed(() => data.value?.addresses ?? [])
const hasMore = computed(() => addresses.value.length > TOP_SHORT)

const visibleAddresses = computed(() => {
  const n = expanded.value ? TOP_FULL : TOP_SHORT
  return addresses.value.slice(0, n)
})

const hint = computed(() => {
  const blocks = data.value?.blocksScanned ?? 0
  const txCount = data.value?.txCount ?? 0
  if (!blocks) return ''
  return t('explorerPage.topAddressesHint', { blocks, txCount: txCount.toLocaleString('en-US') })
})

function toggleShowAll() {
  expanded.value = !expanded.value
}
</script>
