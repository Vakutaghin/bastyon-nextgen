<template>
  <SC_ExplorerWork>
    <SC_ExplorerPage>
      <SC_ExplorerHeader>
        <SC_ExplorerTitleRow>
          <SC_ExplorerTitle>{{ t('explorerPage.mainTitle') }}</SC_ExplorerTitle>
          <SC_LiveBadge :class='{ active: wsConnected }' :title='wsConnected ? t("explorerPage.liveTooltipOn") : t("explorerPage.liveTooltipOff")'>
            <SC_LiveDot :class='{ active: wsConnected }' />
            {{ wsConnected ? t('explorerPage.live') : t('explorerPage.offline') }}
          </SC_LiveBadge>
        </SC_ExplorerTitleRow>
        <SC_ExplorerSubtitle>
          {{ t('explorerPage.mainSubtitle', { chain: chainLabel, height: tipHeightLabel, age: tipAgeLabel }) }}
        </SC_ExplorerSubtitle>
        <ExplorerSearch />
      </SC_ExplorerHeader>

      <SC_ExplorerStatsRow>
        <SC_StatCard>
          <SC_StatCardLabel>
            {{ t('explorerPage.statHeight') }}
            <InfoTooltip term-key='height' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='90' :height='22' />
            <template v-else>{{ tipHeightLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>{{ t('explorerPage.statHeightHint') }}</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>
            {{ t('explorerPage.statEmission') }}
            <InfoTooltip term-key='emission' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='emissionLabel === EM_DASH' :width='110' :height='22' />
            <template v-else>{{ emissionLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>{{ t('explorerPage.statEmissionHint') }}</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>{{ t('explorerPage.statNodeVersion') }}</SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='70' :height='22' />
            <template v-else>{{ versionLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>{{ chainLabel }}</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>
            {{ t('explorerPage.statNetStakeWeight') }}
            <InfoTooltip term-key='netStakeWeight' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='80' :height='22' />
            <template v-else>{{ netStakeLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>{{ t('explorerPage.statNetStakeWeightHint') }}</SC_StatCardHint>
        </SC_StatCard>
      </SC_ExplorerStatsRow>

      <NetworkStatsChart />

      <TopAddressesCard />

      <SC_ExplorerGrid>
        <SC_SectionCard>
          <SC_SectionHeader>
            <SC_SectionTitle>{{ t('explorerPage.sectionLatestBlocks') }}</SC_SectionTitle>
          </SC_SectionHeader>

          <SC_RowList v-if='lastBlocksLoading && !lastBlocks.length'>
            <SC_BlockRow v-for='i in 8' :key='`sk-${i}`'>
              <SC_BlockHeight><Skeleton :width='60' :height='16' /></SC_BlockHeight>
              <Skeleton width='100%' :height='16' />
              <SC_BlockNtx><Skeleton :width='40' :height='12' /></SC_BlockNtx>
              <SC_BlockAge><Skeleton :width='60' :height='12' /></SC_BlockAge>
            </SC_BlockRow>
          </SC_RowList>
          <ExplorerError v-else-if='lastBlocksError' :message="t('explorerPage.errorLoadBlocks')" />
          <SC_RowList v-else>
            <SC_BlockRow v-for='b in lastBlocks' :key='b.hash'>
              <SC_BlockHeight>
                <RouterLink
                  v-slot='{ navigate, href }'
                  custom
                  :to='{ name: "explorer-block", params: { hashOrHeight: b.hash } }'
                >
                  <a :href='href' style='color: inherit; text-decoration: none' @click='navigate'>
                    #{{ formatNumber(b.height) }}
                  </a>
                </RouterLink>
              </SC_BlockHeight>
              <HashLink
                :hash='b.hash'
                :to='{ name: "explorer-block", params: { hashOrHeight: b.hash } }'
              />
              <SC_BlockNtx>{{ t('explorerPage.txCount', { n: b.ntx }) }}</SC_BlockNtx>
              <SC_BlockAge :title='formatAbsTime(b.time)'>
                {{ formatRelTime(b.time, now) }}
              </SC_BlockAge>
            </SC_BlockRow>
          </SC_RowList>
        </SC_SectionCard>

        <SC_SectionCard>
          <SC_SectionHeader>
            <SC_SectionTitle>{{ t('explorerPage.sectionNetworkInfo') }}</SC_SectionTitle>
            <RouterLink
              v-slot='{ navigate, href }'
              custom
              :to='{ name: "explorer-peers" }'
            >
              <a
                :href='href'
                style='font-size: 12px; color: var(--color-primary); text-decoration: none;'
                @click='navigate'
              >
                {{ t('explorerPage.linkPeers') }}
              </a>
            </RouterLink>
          </SC_SectionHeader>

          <SC_RowList v-if='nodeInfoLoading && !nodeInfoData'>
            <SC_BlockRow>
              <SC_BlockHeight><Skeleton :width='40' :height='16' /></SC_BlockHeight>
              <Skeleton width='100%' :height='16' />
              <SC_BlockNtx><Skeleton :width='40' :height='12' /></SC_BlockNtx>
              <SC_BlockAge><Skeleton :width='60' :height='12' /></SC_BlockAge>
            </SC_BlockRow>
          </SC_RowList>
          <ExplorerError v-else-if='nodeInfoError' :message="t('explorerPage.errorNodeUnavailable')" />
          <SC_RowList v-else>
            <SC_BlockRow v-if='tipHash'>
              <SC_BlockHeight>{{ t('explorerPage.tip') }}</SC_BlockHeight>
              <HashLink
                :hash='tipHash'
                :to='{ name: "explorer-block", params: { hashOrHeight: tipHash } }'
              />
              <SC_BlockNtx>{{ tipNtxLabel }}</SC_BlockNtx>
              <SC_BlockAge :title='formatAbsTime(tipTime)'>
                {{ formatRelTime(tipTime, now) }}
              </SC_BlockAge>
            </SC_BlockRow>
            <div style='padding: 16px 18px; font-size: 13px; color: var(--color-text-secondary);'>
              {{ t('explorerPage.decentralizationNote', { server: serverLabel }) }}
            </div>
          </SC_RowList>
        </SC_SectionCard>
      </SC_ExplorerGrid>
    </SC_ExplorerPage>
  </SC_ExplorerWork>
</template>

<script setup lang='ts'>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  useNodeInfo,
  useCoinInfo,
  useLastBlocks,
} from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
import ExplorerSearch from './components/explorer-search/explorer-search.vue'
import NetworkStatsChart from './components/network-stats-chart/network-stats-chart.vue'
import TopAddressesCard from './components/top-addresses/top-addresses-card.vue'
import HashLink from './components/shared/hash-link.vue'
import InfoTooltip from './components/shared/info-tooltip.vue'
import ExplorerError from './components/shared/explorer-error.vue'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
} from './components/shared/format-explorer'
import {
  SC_ExplorerWork,
  SC_ExplorerPage,
  SC_ExplorerHeader,
  SC_ExplorerTitleRow,
  SC_ExplorerTitle,
  SC_LiveBadge,
  SC_LiveDot,
  SC_ExplorerSubtitle,
  SC_ExplorerGrid,
  SC_ExplorerStatsRow,
  SC_StatCard,
  SC_StatCardLabel,
  SC_StatCardValue,
  SC_StatCardHint,
  SC_SectionCard,
  SC_SectionHeader,
  SC_SectionTitle,
  SC_RowList,
  SC_BlockRow,
  SC_BlockHeight,
  SC_BlockNtx,
  SC_BlockAge,
} from './block-explorer-page.styled'

defineOptions({ name: 'BlockExplorerPage' })

const { t } = useI18n()

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

const { isConnected: wsConnected } = useExplorerWsUpdates()

const {
  data: nodeInfo,
  isLoading: nodeInfoLoading,
  error: nodeInfoError,
} = useNodeInfo()
const { data: coinInfo } = useCoinInfo()
const {
  data: lastBlocksResp,
  isLoading: lastBlocksLoading,
  error: lastBlocksError,
} = useLastBlocks(20)

const now = ref(Math.floor(Date.now() / 1000))
let tickHandle: number | null = null

onMounted(() => {
  tickHandle = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 1000)
})

onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})

const nodeInfoData = computed(() => nodeInfo.value?.data)

const tipHeightLabel = computed(() => {
  const h = nodeInfoData.value?.lastblock?.height
  return h !== undefined ? `#${formatNumber(h)}` : EM_DASH
})

const tipHash = computed(() => nodeInfoData.value?.lastblock?.hash ?? '')
const tipTime = computed(() => nodeInfoData.value?.lastblock?.time ?? 0)
const tipNtxLabel = computed(() => {
  const n = nodeInfoData.value?.lastblock?.ntx
  return n !== undefined ? t('explorerPage.txCount', { n }) : EM_DASH
})

const tipAgeLabel = computed(() => {
  const tm = tipTime.value
  return tm > 0 ? formatRelTime(tm, now.value) : EM_DASH
})

const chainLabel = computed(() => {
  const c = nodeInfoData.value?.chain
  // Названия сетей — технические идентификаторы, не локализуются.
  return c === 'main' ? 'main' : c === 'test' ? 'testnet' : EM_DASH
})

const versionLabel = computed(() => nodeInfoData.value?.version ?? EM_DASH)

const netStakeLabel = computed(() => {
  const w = nodeInfoData.value?.netstakeweight
  if (!w) return EM_DASH
  // Огромные числа — показываем в компактной форме.
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(w)
})

const emissionLabel = computed(() => {
  const e = coinInfo.value?.data?.emission
  if (e === null || e === undefined) return EM_DASH
  return formatNumber(e)
})

// getlastblocks возвращает блоки по возрастанию высоты — переворачиваем, чтобы
// сверху был самый свежий.
const lastBlocks = computed(() => {
  const arr = lastBlocksResp.value?.data ?? []
  return [...arr].sort((a, b) => b.height - a.height)
})

const serverLabel = computed(() => nodeInfo.value?.node ?? 'pocketnet.app')
</script>
