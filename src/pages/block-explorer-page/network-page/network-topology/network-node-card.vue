<template>
  <SC_NodeCard :aria-label="title">
    <SC_NodeCardHead>
      <SC_NodeCardTitle>
        {{ title }}
        <small v-if="subtitle">{{ subtitle }}</small>
      </SC_NodeCardTitle>
      <SC_NodeCardClose
        v-if="pinned"
        type="button"
        :aria-label="t('explorerNetwork.close')"
        @click="emit('close')"
      >
        ×
      </SC_NodeCardClose>
    </SC_NodeCardHead>

    <!-- Вы -->
    <template v-if="spec.kind === 'me'">
      <SC_NodeCardRows>
        <dt>{{ t('explorerNetwork.card.connection') }}</dt>
        <dd>{{ torLabel }}</dd>
        <dt>{{ t('explorerNetwork.card.proxyNow') }}</dt>
        <dd>{{ currentProxy ?? t('explorerPage.em') }}</dd>
      </SC_NodeCardRows>
      <SC_NodeCardNote>{{ t('explorerNetwork.card.meNote') }}</SC_NodeCardNote>
    </template>

    <!-- Прокси -->
    <template v-else-if="spec.kind === 'proxy' && proxy">
      <SC_NodeCardRows>
        <dt>{{ t('explorerNetwork.card.state') }}</dt>
        <dd>
          {{ proxy.ok ? t('explorerNetwork.card.proxyOk') : t('explorerNetwork.card.proxyDown') }}
        </dd>
        <template v-if="proxy.ok">
          <dt>{{ t('explorerNetwork.card.ping') }}</dt>
          <dd>{{ ms(proxy.latencyMs) }}</dd>
          <dt>
            {{ t('explorerNetwork.card.apps') }}
            <InfoTooltip :text="t('explorerNetwork.tips.apps')" />
          </dt>
          <dd>{{ appsLabel }}</dd>
          <dt>{{ t('explorerNetwork.card.rps') }}</dt>
          <dd>
            {{
              proxy.rps !== undefined
                ? t('explorerNetwork.card.rpsValue', { n: proxy.rps })
                : t('explorerPage.em')
            }}
          </dd>
          <dt>{{ t('explorerNetwork.card.pool') }}</dt>
          <dd>
            {{
              t('explorerNetwork.card.poolValue', {
                pool: proxy.pool.length,
                known: proxy.known ?? '—',
              })
            }}
          </dd>
          <dt>{{ t('explorerNetwork.card.bestNode') }}</dt>
          <dd>{{ proxy.bestNode ?? t('explorerPage.em') }}</dd>
          <dt v-if="proxy.startedAt">{{ t('explorerNetwork.card.proxyUp') }}</dt>
          <dd v-if="proxy.startedAt">{{ sinceLabel(Date.parse(proxy.startedAt) / 1000) }}</dd>
        </template>
      </SC_NodeCardRows>
      <SC_NodeCardNote>
        {{
          isCurrent ? t('explorerNetwork.card.proxyCurrent') : t('explorerNetwork.card.proxyNote')
        }}
      </SC_NodeCardNote>
    </template>

    <!-- Нода -->
    <template v-else-if="row">
      <SC_NodeCardRows>
        <dt>{{ t('explorerNetwork.card.state') }}</dt>
        <dd>{{ syncLabel }}</dd>
        <dt>{{ t('explorerNetwork.card.version') }}</dt>
        <dd>{{ row.version ?? t('explorerPage.em') }}</dd>
        <dt>{{ t('explorerNetwork.card.height') }}</dt>
        <dd>{{ row.height ? `#${formatExplorerNumber(row.height)}` : t('explorerPage.em') }}</dd>
        <dt>
          {{ t('explorerNetwork.card.kind') }}
          <InfoTooltip :text="t('explorerNetwork.tips.kind')" />
        </dt>
        <dd>{{ t(`explorerNetwork.kind.${row.kind}`) }}</dd>
        <dt>
          {{ t('explorerNetwork.card.access') }}
          <InfoTooltip :text="t('explorerNetwork.tips.access')" />
        </dt>
        <dd>
          {{ row.listening ? t('explorerNetwork.access.open') : t('explorerNetwork.access.nat') }}
        </dd>
        <dt>{{ t('explorerNetwork.card.links') }}</dt>
        <dd>{{ formatExplorerNumber(row.degree) }}</dd>
        <template v-if="row.onlineSince">
          <dt>
            {{ t('explorerNetwork.card.online') }}
            <InfoTooltip :text="t('explorerNetwork.tips.online')" />
          </dt>
          <dd>{{ sinceLabel(row.onlineSince) }}</dd>
        </template>
        <template v-if="row.clockOffset">
          <dt>{{ t('explorerNetwork.card.clock') }}</dt>
          <dd>{{ t('explorerNetwork.card.clockValue', { n: Math.abs(row.clockOffset) }) }}</dd>
        </template>
        <template v-if="row.proxies.length">
          <dt>
            {{ t('explorerNetwork.card.inPool') }}
            <InfoTooltip :text="t('explorerNetwork.tips.pool')" />
          </dt>
          <dd>{{ row.proxies.map(shortProxy).join(', ') }}</dd>
          <dt>{{ t('explorerNetwork.card.appsHere') }}</dt>
          <dd>{{ formatExplorerNumber(row.users) }}</dd>
          <template v-if="row.successPercent !== undefined">
            <dt>{{ t('explorerNetwork.card.answers') }}</dt>
            <dd>
              {{
                t('explorerNetwork.card.answersValue', {
                  percent: row.successPercent,
                  ms: row.avgMs ?? '—',
                })
              }}
            </dd>
          </template>
        </template>
      </SC_NodeCardRows>
      <SC_NodeCardNote v-if="!row.answered && !row.listening">{{
        t('explorerNetwork.card.natNote')
      }}</SC_NodeCardNote>
      <SC_NodeCardActions v-if="pinned && neighborsShown">
        <SC_NodeCardAction type="button" @click="emit('focus', spec.id)">
          {{ t('explorerNetwork.card.centerOn') }}
        </SC_NodeCardAction>
      </SC_NodeCardActions>
    </template>
  </SC_NodeCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTorStore } from '@/stores/tor-store'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import { proxyShortName, type TopoNodeSpec } from '@/services/network-map/topology-model'
import InfoTooltip from '../../components/shared/info-tooltip.vue'
import { formatExplorerNumber } from '../../components/shared/format-explorer'
import { useCountryNames } from '../use-country-names'
import {
  SC_NodeCard,
  SC_NodeCardHead,
  SC_NodeCardTitle,
  SC_NodeCardClose,
  SC_NodeCardRows,
  SC_NodeCardNote,
  SC_NodeCardActions,
  SC_NodeCardAction,
} from './network-topology.styled'

const p = defineProps<{
  spec: TopoNodeSpec
  tip: number
  /** Карточку закрепили щелчком: появляется крестик. */
  pinned: boolean
  currentProxy: string | null
}>()

const emit = defineEmits<{ close: []; focus: [id: string] }>()

const { t } = useI18n()
const torStore = useTorStore()
const { countryLabel } = useCountryNames()

const row = computed(() => p.spec.row)
const proxy = computed(() => p.spec.proxies?.find((x) => x.ok) ?? p.spec.proxies?.[0])
const isCurrent = computed(() => !!p.spec.proxies?.some((x) => x.host === p.currentProxy))
const neighborsShown = computed(() => (row.value?.degree ?? 0) > 0)

const title = computed(() => {
  if (p.spec.kind === 'me') return t('explorerNetwork.card.meTitle')
  if (p.spec.kind === 'proxy') {
    return t('explorerNetwork.card.proxyTitle', {
      names: (p.spec.proxies ?? []).map((x) => x.host).join(', '),
    })
  }
  return p.spec.id.startsWith('local@')
    ? t('explorerNetwork.card.localNode', { proxy: shortProxy(p.spec.id.slice(6)) })
    : p.spec.id
})

const subtitle = computed(() => {
  if (p.spec.kind !== 'node' || !row.value) return ''
  return row.value.country ? countryLabel(row.value.country) : t('explorerNetwork.countryUnknown')
})

const syncLabel = computed(() => {
  const r = row.value
  if (!r) return ''
  if (r.forked) return t('explorerNetwork.sync.forked')
  if (r.sync === 'synced') return t('explorerNetwork.sync.synced')
  if (r.sync === 'behind')
    return t('explorerNetwork.card.behindBy', { n: formatExplorerNumber(r.lag ?? 0) })
  return t('explorerNetwork.sync.unknown')
})

const appsLabel = computed(() => {
  const x = proxy.value
  if (!x || x.clients === undefined) return t('explorerPage.em')
  return t('explorerNetwork.card.appsValue', {
    clients: formatExplorerNumber(x.clients),
    users: formatExplorerNumber(x.users ?? 0),
  })
})

const torLabel = computed(() =>
  torStore.enabled ? t('explorerNetwork.card.viaTor') : t('explorerNetwork.card.direct')
)

function ms(value: number | undefined): string {
  return value !== undefined
    ? t('explorerNetwork.card.msValue', { n: value })
    : t('explorerPage.em')
}

function sinceLabel(unix: number): string {
  return formatTimeAgo(unix)
}

function shortProxy(host: string): string {
  return proxyShortName(host)
}
</script>
