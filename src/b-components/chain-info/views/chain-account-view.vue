<template>
  <ChainInfoSkeleton v-if="isLoading && !account" />
  <ExplorerError v-else-if="error || !account" :message="errorMessage" />
  <div v-else>
    <SC_ChainHead>
      <Avatar
        :src="userAvatar(address, profile?.i) ?? undefined"
        :alt="displayName"
        :fallback-text="displayName"
        :size="44"
      />
      <SC_ChainHeadText>
        <SC_ChainHeadName>
          {{ displayName }}
          <SC_ChainBadge v-for="badge in badges" :key="badge">
            {{ t(`profile.badges.${badge}`) }}
          </SC_ChainBadge>
          <SC_ChainBadge v-if="account.state?.trial" class="warning">
            {{ t('chainInfo.trial') }}
          </SC_ChainBadge>
          <SC_ChainBadge v-if="isDeleted" class="warning">
            {{ t('chainInfo.accountDeleted') }}
          </SC_ChainBadge>
        </SC_ChainHeadName>
        <SC_ChainHeadSub>
          <HashLink :hash="address" full :to="undefined" />
        </SC_ChainHeadSub>
      </SC_ChainHeadText>
    </SC_ChainHead>

    <SC_TxMetaGrid>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('chainInfo.balance') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <template v-if="account.balance !== null">
            {{ formatExplorerPkoin(account.balance) }} PKOIN
          </template>
          <SC_ChainMuted v-else>{{ EM_DASH }}</SC_ChainMuted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <template v-if="profile">
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.reputation') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerNumber(profile.reputation ?? 0) }}</SC_TxMetaValue>
        </SC_TxMetaCell>

        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.registered') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            <div>
              {{ formatDateTimeExact(registeredAt) }}
              <SC_ChainMuted v-if="account.state?.user_reg_height">
                · #{{ formatExplorerNumber(account.state.user_reg_height) }}
              </SC_ChainMuted>
            </div>
            <HashLink
              v-if="account.registration"
              :hash="account.registration.txid"
              :to="txRoute(account.registration.txid)"
            />
          </SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.profileUpdated') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            <div v-if="profile.update">{{ formatDateTimeExact(profile.update) }}</div>
            <HashLink v-if="profile.hash" :hash="profile.hash" :to="txRoute(profile.hash)" />
          </SC_TxMetaValue>
        </SC_TxMetaCell>

        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.posts') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            {{ formatExplorerNumber(profile.postcnt ?? 0) }}
            <SC_ChainMuted v-if="profile.dltdcnt">
              · {{ t('chainInfo.postsDeleted', { n: profile.dltdcnt }) }}
            </SC_ChainMuted>
          </SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.followers') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            {{ formatExplorerNumber(profile.subscribers_count ?? 0) }} /
            {{ formatExplorerNumber(profile.subscribes_count ?? 0) }}
          </SC_TxMetaValue>
        </SC_TxMetaCell>

        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.likers') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerNumber(profile.likers_count ?? 0) }}</SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.blockings') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            {{ formatExplorerNumber(profile.blockings_count ?? 0) }} /
            {{ formatExplorerNumber(profile.blockers_count ?? 0) }}
          </SC_TxMetaValue>
        </SC_TxMetaCell>

        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.actions') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerNumber(profile.actions ?? 0) }}</SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.chatKeys') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            <template v-if="keyCount">{{
              t('chainInfo.chatKeysPublished', { n: keyCount })
            }}</template>
            <SC_ChainMuted v-else>{{ t('chainInfo.chatKeysMissing') }}</SC_ChainMuted>
          </SC_TxMetaValue>
        </SC_TxMetaCell>

        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.moderation') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>
            <template v-if="flags || bans">
              <div v-if="flags">{{ t('chainInfo.flags', { n: flags }) }}</div>
              <div v-if="bans">{{ t('chainInfo.bans', { n: bans }) }}</div>
            </template>
            <SC_ChainMuted v-else>{{ t('chainInfo.moderationClean') }}</SC_ChainMuted>
          </SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('chainInfo.language') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ profile.l ? profile.l.toUpperCase() : EM_DASH }}</SC_TxMetaValue>
        </SC_TxMetaCell>
      </template>
    </SC_TxMetaGrid>

    <SC_ChainSection v-if="hasEarnings">
      <SC_ChainSectionTitle>{{ t('chainInfo.earnings') }}</SC_ChainSectionTitle>
      <SC_TxMetaGrid>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('wallet.earningsLottery') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerPkoin(earnings!.lottery) }} PKOIN</SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('wallet.earningsDonation') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerPkoin(earnings!.donation) }} PKOIN</SC_TxMetaValue>
        </SC_TxMetaCell>
        <SC_TxMetaCell>
          <SC_TxMetaLabel>{{ t('wallet.earningsTransfer') }}</SC_TxMetaLabel>
          <SC_TxMetaValue>{{ formatExplorerPkoin(earnings!.transfer) }} PKOIN</SC_TxMetaValue>
        </SC_TxMetaCell>
      </SC_TxMetaGrid>
    </SC_ChainSection>

    <SC_ChainSection>
      <SC_ChainSectionTitle>{{ t('chainInfo.recentTx') }}</SC_ChainSectionTitle>
      <SC_ChainMuted v-if="txLoading && !recent.length">{{
        t('explorerPage.loading')
      }}</SC_ChainMuted>
      <SC_ChainMuted v-else-if="!recent.length">{{
        t('explorerPage.addressTxEmpty')
      }}</SC_ChainMuted>
      <SC_ChainList v-else>
        <SC_ChainRow
          v-for="row in recent"
          :key="row.tx.txid"
          type="button"
          @click="openTx(row.tx.txid)"
        >
          <SC_ChainRowLabel>{{ labelForTxType(row.tx.type) }}</SC_ChainRowLabel>
          <SC_ChainRowHash>{{ row.tx.txid }}</SC_ChainRowHash>
          <SC_ChainRowMeta :class="row.move.direction">
            <template v-if="row.move.direction !== 'change'">
              {{ row.move.direction === 'in' ? '+' : '−'
              }}{{ formatPkoinAmount(row.move.amount, 4) }}
            </template>
          </SC_ChainRowMeta>
          <SC_ChainRowMeta :title="formatDateTimeExact(row.tx.nTime)">
            {{ formatTimeAgo(row.tx.nTime) }}
          </SC_ChainRowMeta>
        </SC_ChainRow>
      </SC_ChainList>
    </SC_ChainSection>

    <RouterLink v-if="profile && !isDeleted" v-slot="{ href, navigate }" custom :to="`/${address}`">
      <SC_ChainFooterLink :href="href" @click="navigate">
        {{ t('explorerShared.openProfile') }}
      </SC_ChainFooterLink>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { Avatar } from '@/components'
import HashLink from '@/pages/block-explorer-page/components/shared/hash-link.vue'
import ExplorerError from '@/pages/block-explorer-page/components/shared/explorer-error.vue'
import {
  formatExplorerNumber,
  formatExplorerPkoin,
} from '@/pages/block-explorer-page/components/shared/format-explorer'
import { labelForTxType } from '@/pages/block-explorer-page/components/shared/tx-type-labels'
import {
  SC_TxMetaGrid,
  SC_TxMetaCell,
  SC_TxMetaLabel,
  SC_TxMetaValue,
} from '@/pages/block-explorer-page/tx-page/tx-page.styled'
import { classifyWalletTx } from '@/pages/wallets-page/wallet-history/classify-tx'
import { fetchAddressTxPage, startAddressTxCursor } from '@/helpers/explorer/address-transactions'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import { formatDateTimeExact, formatTimeAgo } from '@/helpers/common/date-formatter'
import { formatPkoinAmount } from '@/helpers/common/pkoin-formatter'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { userAvatar, userName } from '@/services/user-names'
import { CHAIN_LINK_KEY } from '../chain-link'
import { chatKeyCount, fetchAccount, fetchEarnings, flagCount } from '../chain-info-data'
import ChainInfoSkeleton from './chain-info-skeleton.vue'
import {
  SC_ChainHead,
  SC_ChainHeadText,
  SC_ChainHeadName,
  SC_ChainHeadSub,
  SC_ChainBadge,
  SC_ChainMuted,
  SC_ChainSection,
  SC_ChainSectionTitle,
  SC_ChainList,
  SC_ChainRow,
  SC_ChainRowLabel,
  SC_ChainRowHash,
  SC_ChainRowMeta,
  SC_ChainFooterLink,
} from '../chain-info.styled'

defineOptions({ name: 'ChainAccountView' })

const p = defineProps<{ address: string }>()

const { t } = useI18n()
const openInChainModal = inject(CHAIN_LINK_KEY, null)

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'
/** Значки, для которых есть подписи (profile.badges). */
const KNOWN_BADGES = new Set(['verified', 'established', 'moderator', 'shark'])
const RECENT_TX = 10

const address = computed(() => p.address)

const {
  data: account,
  isLoading,
  error,
} = useQuery({
  queryKey: ['explorer', 'chain-info', 'account', address] as const,
  queryFn: () => fetchAccount(p.address),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})

const { data: recentTxs, isLoading: txLoading } = useQuery({
  queryKey: ['explorer', 'chain-info', 'recent-tx', address] as const,
  queryFn: async () =>
    (
      await fetchAddressTxPage(
        p.address,
        startAddressTxCursor(),
        { pageSize: RECENT_TX },
        getExplorerRpcConfig()
      )
    ).txs,
  staleTime: 30_000,
  refetchOnWindowFocus: false,
})

const { data: earningsData } = useQuery({
  queryKey: ['explorer', 'chain-info', 'earnings', address] as const,
  queryFn: () => fetchEarnings(p.address),
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
})
const earnings = computed(() => earningsData.value ?? null)

const recent = computed(() => {
  const mine = new Set([p.address])
  return (recentTxs.value ?? []).map((tx) => ({ tx, move: classifyWalletTx(tx, mine) }))
})

const profile = computed(() => account.value?.profile ?? null)
const isDeleted = computed(() => {
  const d = profile.value?.deleted
  return d === true || d === 'true'
})
const displayName = computed(() =>
  profile.value ? userName(p.address, profile.value) : t('chainInfo.noProfile')
)
const badges = computed(() =>
  (profile.value?.badges ?? account.value?.state?.badges ?? []).filter((b) => KNOWN_BADGES.has(b))
)
const registeredAt = computed(
  () => account.value?.registration?.time || profile.value?.regdate || 0
)
const keyCount = computed(() => chatKeyCount(profile.value))
const flags = computed(() => flagCount(profile.value?.flags))
const bans = computed(() => Object.keys(profile.value?.bans ?? {}).length)
const hasEarnings = computed(() => {
  const e = earnings.value
  return !!e && e.lottery + e.donation + e.transfer > 0
})

const errorMessage = computed(() =>
  error.value
    ? t('chainInfo.loadFailed', { msg: extractErrorMessage(error.value) })
    : t('chainInfo.notFound')
)

function txRoute(txid: string): RouteLocationRaw {
  return { name: 'explorer-tx', params: { txid } }
}

function openTx(txid: string): void {
  openInChainModal?.({ kind: 'tx', txid })
}
</script>
