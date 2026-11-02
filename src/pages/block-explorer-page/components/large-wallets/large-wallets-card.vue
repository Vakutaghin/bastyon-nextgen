<template>
  <SC_WalletsCard data-testid="large-wallets">
    <SC_WalletsHeader>
      <SC_WalletsTitleGroup>
        <SC_WalletsTitle>
          {{ t('explorerPage.walletsTitle') }}
          <InfoTooltip :text="t('explorerPage.walletsTooltip')" />
        </SC_WalletsTitle>
        <SC_WalletsHint role="status" aria-live="polite">{{ hint }}</SC_WalletsHint>
      </SC_WalletsTitleGroup>
      <SC_WalletsToggle v-if="rows.length > SHORT" type="button" @click="expanded = !expanded">
        {{
          expanded
            ? t('explorerPage.walletsCollapse')
            : t('explorerPage.walletsExpand', { n: rows.length })
        }}
      </SC_WalletsToggle>
    </SC_WalletsHeader>

    <SC_WalletsNote>{{ t('explorerPage.walletsNote', { blocks: STAKER_BLOCKS }) }}</SC_WalletsNote>

    <template v-if="!rows.length && loading">
      <SC_WalletsRow v-for="i in 6" :key="`sk-${i}`">
        <SC_WalletsRank>{{ i }}</SC_WalletsRank>
        <SC_WalletsMain>
          <Skeleton :width="160" :height="14" />
          <Skeleton :width="90" :height="12" />
        </SC_WalletsMain>
        <SC_WalletsAmount>
          <Skeleton :width="90" :height="14" />
          <Skeleton :width="50" :height="12" />
        </SC_WalletsAmount>
      </SC_WalletsRow>
    </template>

    <SC_WalletsPlaceholder v-else-if="!rows.length && failed">
      {{ t('explorerPage.walletsError') }}
    </SC_WalletsPlaceholder>

    <SC_WalletsPlaceholder v-else-if="!rows.length">
      {{ t('explorerPage.walletsEmpty') }}
    </SC_WalletsPlaceholder>

    <template v-else>
      <SC_WalletsRow v-for="(row, idx) in visibleRows" :key="row.address">
        <SC_WalletsRank>{{ idx + 1 }}</SC_WalletsRank>
        <SC_WalletsMain>
          <AddressLink :address="row.address" :head="8" :tail="6" />
          <SC_WalletsMeta>
            <SC_WalletsName v-if="nameOf(row.address)">{{ nameOf(row.address) }}</SC_WalletsName>
            <SC_WalletsTag
              v-if="row.stakedBlocks"
              class="staker"
              :title="t('explorerPage.walletsStakedTooltip', { total: blocksTotal })"
            >
              {{ t('explorerPage.walletsStaked', { n: row.stakedBlocks, total: blocksTotal }) }}
            </SC_WalletsTag>
            <SC_WalletsTag v-if="row.active" :title="t('explorerPage.walletsActiveTooltip')">
              {{ t('explorerPage.walletsActive') }}
            </SC_WalletsTag>
          </SC_WalletsMeta>
        </SC_WalletsMain>
        <SC_WalletsAmount>
          <SC_WalletsBalance>{{ formatExplorerPkoin(row.balance, 2) }} PKOIN</SC_WalletsBalance>
          <SC_WalletsShare
            v-if="row.share !== null"
            :title="t('explorerPage.walletsShareTooltip', { emission: emissionLabel })"
          >
            {{ t('explorerPage.walletsShare', { share: formatShare(row.share) }) }}
          </SC_WalletsShare>
        </SC_WalletsAmount>
      </SC_WalletsRow>
    </template>
  </SC_WalletsCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components'
import { useLargeWallets } from '@/composables/use-large-wallets'
import { userNameIfKnown } from '@/services/user-names'
import AddressLink from '../shared/address-link.vue'
import InfoTooltip from '../shared/info-tooltip.vue'
import { formatExplorerNumber, formatExplorerPkoin } from '../shared/format-explorer'
import { STAKER_BLOCKS, emissionShare, formatShare, totalBalance } from './large-wallets'
import {
  SC_WalletsCard,
  SC_WalletsHeader,
  SC_WalletsTitleGroup,
  SC_WalletsTitle,
  SC_WalletsHint,
  SC_WalletsToggle,
  SC_WalletsNote,
  SC_WalletsRow,
  SC_WalletsRank,
  SC_WalletsMain,
  SC_WalletsMeta,
  SC_WalletsName,
  SC_WalletsTag,
  SC_WalletsAmount,
  SC_WalletsBalance,
  SC_WalletsShare,
  SC_WalletsPlaceholder,
} from './large-wallets-card.styled'

defineOptions({ name: 'LargeWalletsCard' })

const { t } = useI18n()

/** Сколько строк видно до «Показать все». */
const SHORT = 20

const expanded = ref(false)

const { rows, emission, blocksTotal, blocksDone, balancesLeft, loading, failed } = useLargeWallets()

const visibleRows = computed(() => (expanded.value ? rows.value : rows.value.slice(0, SHORT)))

const emissionLabel = computed(() => `${formatExplorerNumber(emission.value)} PKOIN`)

/** Пока идёт проверка — прогресс, потом — сколько нашли и сколько у них вместе. */
const hint = computed(() => {
  if (loading.value) {
    if (!blocksTotal.value) return ''
    const progress = t('explorerPage.walletsProgress', {
      done: blocksDone.value,
      total: blocksTotal.value,
    })
    return balancesLeft.value
      ? `${progress} · ${t('explorerPage.walletsBalancesLeft', { n: balancesLeft.value })}`
      : progress
  }
  const n = rows.value.length
  if (!n) return ''
  const sum = totalBalance(rows.value)
  return t(
    'explorerPage.walletsSummary',
    {
      n,
      sum: formatExplorerNumber(Math.round(sum)),
      share: formatShare(emissionShare(sum, emission.value)),
    },
    n
  )
})

/** Имя аккаунта, если у адреса он есть: подписи догружаются пачками. */
function nameOf(address: string): string {
  return userNameIfKnown(address)
}
</script>
