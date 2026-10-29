<template>
  <SC_ExplorerWork>
    <SC_ExplorerPage>
      <ExplorerHeader />

      <SC_NetGrid>
        <SC_NetStats>
          <SC_StatCard v-for="stat in stats" :key="stat.key">
            <SC_StatCardLabel>
              {{ t(`explorerNetwork.stats.${stat.key}`) }}
              <InfoTooltip :text="t(`explorerNetwork.tips.${stat.key}`)" />
            </SC_StatCardLabel>
            <SC_StatCardValue>{{ hasMap ? stat.value : t('explorerPage.em') }}</SC_StatCardValue>
            <SC_StatCardHint>{{ hasMap ? stat.hint : ' ' }}</SC_StatCardHint>
          </SC_StatCard>
        </SC_NetStats>

        <SC_SectionCard>
          <SC_SectionHeader>
            <SC_NetCardTitleRow>
              <SC_SectionTitle>{{ t('explorerNetwork.mapTitle') }}</SC_SectionTitle>
              <InfoTooltip :text="t('explorerNetwork.tips.map')" />
            </SC_NetCardTitleRow>
          </SC_SectionHeader>
          <SC_NetCrawl>
            <SC_NetCrawlText role="status" aria-live="polite">
              <template v-if="store.crawling && store.progress && !store.progress.asked">
                {{ t('explorerNetwork.crawl.probing') }}
              </template>
              <template v-else-if="store.crawling && store.progress">
                {{
                  t('explorerNetwork.crawl.progress', {
                    asked: store.progress.asked,
                    answered: store.progress.answered,
                    queued: store.progress.queued,
                    nodes: rows.length,
                  })
                }}
              </template>
              <template v-else-if="store.failed">{{ t('explorerNetwork.crawl.failed') }}</template>
              <template v-else-if="hasMap">
                {{
                  t('explorerNetwork.crawl.done', {
                    date: takenLabel,
                    seconds: Math.max(1, Math.round(store.snapshot.durationMs / 1000)),
                    asked: store.snapshot.asked,
                    answered: store.snapshot.answered,
                  })
                }}
              </template>
              <template v-else>{{ t('explorerNetwork.crawl.never') }}</template>
            </SC_NetCrawlText>
            <SC_NetButton
              v-if="store.crawling"
              type="button"
              class="secondary"
              @click="store.stopCrawl()"
            >
              <StopOutlined />
              {{ t('explorerNetwork.crawl.stop') }}
            </SC_NetButton>
            <SC_NetButton v-else type="button" :disabled="cooldown > 0" @click="void store.crawl()">
              <ReloadOutlined />
              {{
                cooldown > 0
                  ? t('explorerNetwork.crawl.wait', { s: Math.ceil(cooldown / 1000) })
                  : hasMap
                    ? t('explorerNetwork.crawl.refresh')
                    : t('explorerNetwork.crawl.start')
              }}
            </SC_NetButton>
            <SC_NetProgress v-if="store.crawling && store.progress" :share="progressShare" />
          </SC_NetCrawl>
          <SC_NetCardBody>
            <NetworkTopology
              ref="topologyRef"
              :snapshot="store.snapshot"
              :revision="store.revision"
              :rows="rows"
              :tip="totals.tip"
              :highlight="highlight"
              :country-name="countryName"
              @select="selectedIp = $event"
            >
              <SC_NetEmpty v-if="!hasMap && !store.crawling">
                <h3>{{ t('explorerNetwork.empty.title') }}</h3>
                <p>{{ t('explorerNetwork.empty.text') }}</p>
                <SC_NetButton type="button" @click="void store.crawl()">
                  <ReloadOutlined />
                  {{ t('explorerNetwork.crawl.start') }}
                </SC_NetButton>
              </SC_NetEmpty>
            </NetworkTopology>
          </SC_NetCardBody>
        </SC_SectionCard>

        <SC_NetTwoCols>
          <SC_SectionCard>
            <SC_SectionHeader>
              <SC_SectionTitle>{{ t('explorerNetwork.connection.title') }}</SC_SectionTitle>
            </SC_SectionHeader>
            <NetworkConnection
              :snapshot="store.snapshot"
              :revision="store.revision"
              :nodes-count="rows.length"
              :country-of="countryOf"
            />
          </SC_SectionCard>
          <SC_SectionCard>
            <SC_SectionHeader>
              <SC_SectionTitle>{{ t('explorerNetwork.breakdown.title') }}</SC_SectionTitle>
            </SC_SectionHeader>
            <NetworkBreakdown :rows="rows" :versions="versions" :percent="percent" />
          </SC_SectionCard>
        </SC_NetTwoCols>

        <SC_SectionCard v-if="hasMap">
          <SC_SectionHeader>
            <SC_NetCardTitleRow>
              <SC_SectionTitle>{{ t('explorerNetwork.countriesTitle') }}</SC_SectionTitle>
              <InfoTooltip :text="t('explorerNetwork.tips.countriesSource')" />
            </SC_NetCardTitleRow>
          </SC_SectionHeader>
          <NetworkCountries
            :countries="countries"
            :selected="selectedCountry"
            :percent="percent"
            @select="selectedCountry = $event"
          />
        </SC_SectionCard>

        <SC_SectionCard v-if="hasMap">
          <SC_SectionHeader>
            <SC_SectionTitle>{{ t('explorerNetwork.table.title') }}</SC_SectionTitle>
          </SC_SectionHeader>
          <NetworkNodesTable
            :rows="rows"
            :country="selectedCountry"
            :selected="selectedIp"
            @pick="pickNode"
            @clear-country="selectedCountry = null"
          />
        </SC_SectionCard>

        <SC_Sources>
          {{ t('explorerNetwork.sources', { date: countriesDateLabel }) }}
        </SC_Sources>
      </SC_NetGrid>
    </SC_ExplorerPage>
  </SC_ExplorerWork>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ReloadOutlined, StopOutlined } from '@/components/icons'
import { bcp47 } from '@/i18n'
import { formatDateTimeExact } from '@/helpers/common/date-formatter'
import {
  buildNodeRows,
  countryShares,
  networkTotals,
  versionShares,
} from '@/services/network-map/network-stats'
import { useNetworkMapStore } from '@/stores/network-map-store'
import ExplorerHeader from '../components/explorer-header/explorer-header.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import { formatExplorerNumber } from '../components/shared/format-explorer'
import {
  SC_ExplorerWork,
  SC_ExplorerPage,
  SC_StatCard,
  SC_StatCardLabel,
  SC_StatCardValue,
  SC_StatCardHint,
  SC_SectionCard,
  SC_SectionHeader,
  SC_SectionTitle,
} from '../block-explorer-page.styled'
import NetworkTopology from './network-topology/network-topology.vue'
import NetworkConnection from './network-connection.vue'
import NetworkBreakdown from './network-breakdown.vue'
import NetworkCountries from './network-countries.vue'
import NetworkNodesTable from './network-nodes-table.vue'
import { useCountryNames } from './use-country-names'
import {
  SC_NetGrid,
  SC_NetStats,
  SC_NetCrawl,
  SC_NetCrawlText,
  SC_NetButton,
  SC_NetProgress,
  SC_NetEmpty,
  SC_NetCardBody,
  SC_NetCardTitleRow,
  SC_NetTwoCols,
  SC_Sources,
} from './network-page.styled'

defineOptions({ name: 'NetworkPage' })

const { t, locale } = useI18n()
const store = useNetworkMapStore()
const { countryName } = useCountryNames()

const topologyRef = ref<{ focusNode: (id: string) => void } | null>(null)
const selectedCountry = ref<string | null>(null)
const selectedIp = ref<string | null>(null)

const hasMap = computed(() => store.hasMap)
const rows = computed(() => {
  void store.revision
  return buildNodeRows(store.snapshot)
})
const totals = computed(() => networkTotals(store.snapshot, rows.value))
const countries = computed(() => countryShares(rows.value))
const versions = computed(() => versionShares(rows.value))
const highlight = computed(() =>
  selectedCountry.value
    ? new Set(rows.value.filter((r) => r.country === selectedCountry.value).map((r) => r.ip))
    : null
)
const countryByIp = computed(() => new Map(rows.value.map((r) => [r.ip, r.country])))
const countryOf = (ip: string) => countryByIp.value.get(ip)

const percentFormat = computed(
  () => new Intl.NumberFormat(bcp47(locale.value), { style: 'percent', maximumFractionDigits: 0 })
)
// Одна нода из трёхсот — не «0 %»: показываем «<1 %».
const percent = (share: number) =>
  share > 0 && share < 0.01
    ? `<${percentFormat.value.format(0.01)}`
    : percentFormat.value.format(share)

/** Тонкие клиенты: приложения онлайн на всех прокси, без повторов одного сервера. */
const apps = computed(() => {
  void store.revision
  let clients = 0
  let users = 0
  let known = false
  for (const proxy of store.snapshot.proxies) {
    if (!proxy.ok || proxy.sameAs || proxy.clients === undefined) continue
    known = true
    clients += proxy.clients
    users += proxy.users ?? 0
  }
  return known ? { clients, users } : null
})

const stats = computed(() => {
  const x = totals.value
  const top = countries.value.known[0]
  return [
    {
      key: 'nodes',
      value: formatExplorerNumber(x.nodes),
      hint: t('explorerNetwork.statsHint.nodes', { n: formatExplorerNumber(x.answered) }),
    },
    {
      key: 'open',
      value: formatExplorerNumber(x.listening),
      hint: t('explorerNetwork.statsHint.open', { n: formatExplorerNumber(x.nodes - x.listening) }),
    },
    {
      key: 'countries',
      value: formatExplorerNumber(x.countries),
      hint: top
        ? t('explorerNetwork.statsHint.countries', {
            country: countryName(top.key),
            percent: percent(top.share),
          })
        : ' ',
    },
    {
      key: 'synced',
      value: percent(x.syncedShare),
      hint: x.forked
        ? t('explorerNetwork.statsHint.syncedForked', { behind: x.behind, forked: x.forked })
        : t('explorerNetwork.statsHint.synced', { behind: formatExplorerNumber(x.behind) }),
    },
    {
      key: 'version',
      value: x.latest ?? t('explorerPage.em'),
      hint: x.latest
        ? t('explorerNetwork.statsHint.version', { percent: percent(x.latestShare) })
        : ' ',
    },
    {
      key: 'apps',
      value: apps.value ? formatExplorerNumber(apps.value.clients) : t('explorerPage.em'),
      hint: apps.value
        ? t('explorerNetwork.statsHint.apps', { n: formatExplorerNumber(apps.value.users) })
        : ' ',
    },
  ]
})

const takenLabel = computed(() =>
  store.snapshot.takenAt ? formatDateTimeExact(Math.floor(store.snapshot.takenAt / 1000)) : ''
)

const countriesDateLabel = computed(() =>
  store.countriesDate
    ? new Date(`${store.countriesDate}T00:00:00Z`).toLocaleDateString(bcp47(locale.value))
    : t('explorerPage.em')
)

const progressShare = computed(() => {
  const x = store.progress
  if (!x) return 0
  const total = x.asked + x.queued
  return total ? x.asked / total : 0
})

// Пауза между обходами: кнопка показывает, сколько ждать.
const now = ref(Date.now())
const cooldown = computed(() => store.canCrawlIn(now.value))
let tick: number | null = null

function pickNode(ip: string): void {
  selectedIp.value = ip
  topologyRef.value?.focusNode(ip)
}

watch(selectedCountry, () => {
  if (
    selectedIp.value &&
    selectedCountry.value &&
    countryOf(selectedIp.value) !== selectedCountry.value
  ) {
    selectedIp.value = null
  }
})

onMounted(() => {
  // Таблица стран — файл самого приложения: сеть не трогаем.
  void store.resolveCountries()
  tick = window.setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  if (tick !== null) window.clearInterval(tick)
})
</script>
