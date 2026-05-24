<template>
  <SC_ExplorerWork>
    <SC_ExplorerPage>
      <SC_ExplorerHeader>
        <SC_ExplorerTitleRow>
          <SC_ExplorerTitle>Блок-эксплорер Pocketnet</SC_ExplorerTitle>
          <SC_LiveBadge :class='{ active: wsConnected }' :title='wsConnected ? "Real-time через WebSocket" : "Соединение восстанавливается"'>
            <SC_LiveDot :class='{ active: wsConnected }' />
            {{ wsConnected ? 'live' : 'offline' }}
          </SC_LiveBadge>
        </SC_ExplorerTitleRow>
        <SC_ExplorerSubtitle>
          Сеть {{ chainLabel }} · последний блок {{ tipHeightLabel }} · обновлено {{ tipAgeLabel }}
        </SC_ExplorerSubtitle>
        <ExplorerSearch />
      </SC_ExplorerHeader>

      <SC_ExplorerStatsRow>
        <SC_StatCard>
          <SC_StatCardLabel>
            Высота
            <InfoTooltip term-key='height' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='90' :height='22' />
            <template v-else>{{ tipHeightLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>Последний блок сети</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>
            Эмиссия
            <InfoTooltip term-key='emission' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='emissionLabel === "—"' :width='110' :height='22' />
            <template v-else>{{ emissionLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>PKOIN в обращении</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>Версия ноды</SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='70' :height='22' />
            <template v-else>{{ versionLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>{{ chainLabel }}</SC_StatCardHint>
        </SC_StatCard>

        <SC_StatCard>
          <SC_StatCardLabel>
            Net stake weight
            <InfoTooltip term-key='netStakeWeight' />
          </SC_StatCardLabel>
          <SC_StatCardValue>
            <Skeleton v-if='!nodeInfoData' :width='80' :height='22' />
            <template v-else>{{ netStakeLabel }}</template>
          </SC_StatCardValue>
          <SC_StatCardHint>Чем больше, тем безопаснее сеть</SC_StatCardHint>
        </SC_StatCard>
      </SC_ExplorerStatsRow>

      <NetworkStatsChart />

      <TopAddressesCard />

      <SC_ExplorerGrid>
        <SC_SectionCard>
          <SC_SectionHeader>
            <SC_SectionTitle>Последние блоки</SC_SectionTitle>
          </SC_SectionHeader>

          <SC_RowList v-if='lastBlocksLoading && !lastBlocks.length'>
            <SC_BlockRow v-for='i in 8' :key='`sk-${i}`'>
              <SC_BlockHeight><Skeleton :width='60' :height='16' /></SC_BlockHeight>
              <Skeleton width='100%' :height='16' />
              <SC_BlockNtx><Skeleton :width='40' :height='12' /></SC_BlockNtx>
              <SC_BlockAge><Skeleton :width='60' :height='12' /></SC_BlockAge>
            </SC_BlockRow>
          </SC_RowList>
          <SC_ErrorPlaceholder v-else-if='lastBlocksError'>
            Не удалось загрузить блоки
          </SC_ErrorPlaceholder>
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
              <SC_BlockNtx>{{ b.ntx }} tx</SC_BlockNtx>
              <SC_BlockAge :title='formatAbsTime(b.time)'>
                {{ formatRelTime(b.time, now) }}
              </SC_BlockAge>
            </SC_BlockRow>
          </SC_RowList>
        </SC_SectionCard>

        <SC_SectionCard>
          <SC_SectionHeader>
            <SC_SectionTitle>Информация о сети</SC_SectionTitle>
            <RouterLink
              v-slot='{ navigate, href }'
              custom
              :to='{ name: "explorer-peers" }'
            >
              <a
                :href='href'
                style='font-size: 12px; color: rgb(0, 123, 255); text-decoration: none;'
                @click='navigate'
              >
                Все ноды и пиры →
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
          <SC_ErrorPlaceholder v-else-if='nodeInfoError'>
            Нода недоступна
          </SC_ErrorPlaceholder>
          <SC_RowList v-else>
            <SC_BlockRow v-if='tipHash'>
              <SC_BlockHeight>Tip</SC_BlockHeight>
              <HashLink
                :hash='tipHash'
                :to='{ name: "explorer-block", params: { hashOrHeight: tipHash } }'
              />
              <SC_BlockNtx>{{ tipNtxLabel }}</SC_BlockNtx>
              <SC_BlockAge :title='formatAbsTime(tipTime)'>
                {{ formatRelTime(tipTime, now) }}
              </SC_BlockAge>
            </SC_BlockRow>
            <div style='padding: 16px 18px; font-size: 13px; color: rgb(108, 117, 125);'>
              Эксплорер использует тот же набор нод, что и остальное приложение
              ({{ serverLabel }}). Никаких внешних редиректов на www.bastyon.com.
            </div>
          </SC_RowList>
        </SC_SectionCard>
      </SC_ExplorerGrid>
    </SC_ExplorerPage>
  </SC_ExplorerWork>
</template>

<script setup lang='ts'>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
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
  SC_ErrorPlaceholder,
} from './block-explorer-page.styled'

defineOptions({ name: 'BlockExplorerPage' })

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
  return h !== undefined ? `#${formatNumber(h)}` : '—'
})

const tipHash = computed(() => nodeInfoData.value?.lastblock?.hash ?? '')
const tipTime = computed(() => nodeInfoData.value?.lastblock?.time ?? 0)
const tipNtxLabel = computed(() => {
  const n = nodeInfoData.value?.lastblock?.ntx
  return n !== undefined ? `${n} tx` : '—'
})

const tipAgeLabel = computed(() => {
  const t = tipTime.value
  return t > 0 ? formatRelTime(t, now.value) : '—'
})

const chainLabel = computed(() => {
  const c = nodeInfoData.value?.chain
  return c === 'main' ? 'main' : c === 'test' ? 'testnet' : '—'
})

const versionLabel = computed(() => nodeInfoData.value?.version ?? '—')

const netStakeLabel = computed(() => {
  const w = nodeInfoData.value?.netstakeweight
  if (!w) return '—'
  // Огромные числа — показываем в компактной форме.
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(w)
})

const emissionLabel = computed(() => {
  const e = coinInfo.value?.data?.emission
  if (e === null || e === undefined) return '—'
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
