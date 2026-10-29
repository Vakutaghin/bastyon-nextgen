<template>
  <SC_ExplorerHeader>
    <SC_ExplorerTitleRow>
      <SC_ExplorerTitle>{{ t('explorerPage.mainTitle') }}</SC_ExplorerTitle>
      <SC_LiveBadge
        :class="{ active: wsConnected }"
        :title="wsConnected ? t('explorerPage.liveTooltipOn') : t('explorerPage.liveTooltipOff')"
      >
        <SC_LiveDot :class="{ active: wsConnected }" />
        {{ wsConnected ? t('explorerPage.live') : t('explorerPage.offline') }}
      </SC_LiveBadge>
    </SC_ExplorerTitleRow>
    <SC_ExplorerSubtitle>
      {{
        t('explorerPage.mainSubtitle', {
          chain: chainLabel,
          height: tipHeightLabel,
          age: tipAgeLabel,
        })
      }}
    </SC_ExplorerSubtitle>

    <SC_ExplorerTabs :aria-label="t('explorerPage.tabsLabel')">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        v-slot="{ href, navigate, isExactActive }"
        custom
        :to="{ name: tab.name }"
      >
        <SC_ExplorerTab
          :href="href"
          :class="{ active: isExactActive }"
          :aria-current="isExactActive ? 'page' : undefined"
          @click="navigate"
        >
          <component :is="tab.icon" />
          {{ t(tab.labelKey) }}
        </SC_ExplorerTab>
      </RouterLink>
    </SC_ExplorerTabs>

    <ExplorerSearch />
  </SC_ExplorerHeader>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { BlockOutlined, ApartmentOutlined } from '@/components/icons'
import { useNodeInfo } from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import ExplorerSearch from '../explorer-search/explorer-search.vue'
import { formatExplorerNumber } from '../shared/format-explorer'
import {
  SC_ExplorerHeader,
  SC_ExplorerTitleRow,
  SC_ExplorerTitle,
  SC_LiveBadge,
  SC_LiveDot,
  SC_ExplorerSubtitle,
} from '../../block-explorer-page.styled'
import { SC_ExplorerTabs, SC_ExplorerTab } from './explorer-header.styled'

const { t } = useI18n()

const TABS = [
  { name: 'explorer', labelKey: 'explorerPage.tabOverview', icon: BlockOutlined },
  { name: 'explorer-network', labelKey: 'explorerPage.tabNetwork', icon: ApartmentOutlined },
] as const

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

const { isConnected: wsConnected } = useExplorerWsUpdates()
const { data: nodeInfo } = useNodeInfo()

const now = ref(Math.floor(Date.now() / 1000))
let tick: number | null = null
onMounted(() => {
  tick = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 1000)
})
onBeforeUnmount(() => {
  if (tick !== null) window.clearInterval(tick)
})

const lastBlock = computed(() => nodeInfo.value?.data?.lastblock)
const tipHeightLabel = computed(() =>
  lastBlock.value?.height !== undefined
    ? `#${formatExplorerNumber(lastBlock.value.height)}`
    : EM_DASH
)
const tipAgeLabel = computed(() =>
  lastBlock.value?.time ? formatTimeAgo(lastBlock.value.time, now.value) : EM_DASH
)
const chainLabel = computed(() => {
  const c = nodeInfo.value?.data?.chain
  // Названия сетей — технические идентификаторы, не локализуются.
  return c === 'main' ? 'main' : c === 'test' ? 'testnet' : EM_DASH
})
</script>
