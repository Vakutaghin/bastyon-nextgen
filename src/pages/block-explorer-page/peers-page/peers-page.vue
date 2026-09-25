<template>
  <SC_PeersWork>
    <SC_PeersPage>
      <SC_PeersBreadcrumb>
        <RouterLink :to="{ name: 'explorer' }">{{ t('explorerPage.breadcrumbRoot') }}</RouterLink>
        <span> / {{ t('explorerPage.peersBreadcrumb') }}</span>
      </SC_PeersBreadcrumb>

      <SC_PeersTitle>{{ t('explorerPage.peersTitle') }}</SC_PeersTitle>

      <SC_PeersSection>
        <SC_PeersSectionHeader>
          <SC_PeersSectionTitle>{{
            t('explorerPage.peersNodesSectionTitle')
          }}</SC_PeersSectionTitle>
          <SC_PeersSectionHint>
            {{ t('explorerPage.peersNodesHealthHint', { alive: healthyCount, total: totalNodes }) }}
          </SC_PeersSectionHint>
        </SC_PeersSectionHeader>

        <template v-if="healthLoading && !nodeHealth.length">
          <SC_NodeRow v-for="i in totalNodes" :key="`node-sk-${i}`">
            <SC_NodeDot color="var(--ui-border-accented)" />
            <SC_NodeAddr><Skeleton width="160" :height="14" /></SC_NodeAddr>
            <SC_NodeMetric><Skeleton :width="60" :height="12" /></SC_NodeMetric>
            <SC_NodeMetric class="secondary"><Skeleton :width="60" :height="12" /></SC_NodeMetric>
            <SC_NodeMetric class="secondary"><Skeleton :width="60" :height="12" /></SC_NodeMetric>
          </SC_NodeRow>
        </template>

        <template v-else>
          <SC_NodeRow v-for="node in nodeHealth" :key="`${node.host}:${node.port}`">
            <SC_NodeDot
              :color="node.ok ? 'var(--ui-success)' : 'var(--ui-error)'"
              :title="
                node.ok
                  ? t('explorerPage.peersNodeOk')
                  : node.error || t('explorerPage.peersNodeFail')
              "
            />
            <SC_NodeAddr>{{ node.host }}:{{ node.port }}</SC_NodeAddr>
            <SC_NodeMetric>
              <SC_NodeMetricLabel>{{ t('explorerPage.peersNodeMetricPing') }}</SC_NodeMetricLabel>
              <span v-if="node.latencyMs !== null">{{ node.latencyMs }} ms</span>
              <SC_NodeMetricEmpty v-else>{{ t('explorerPage.em') }}</SC_NodeMetricEmpty>
            </SC_NodeMetric>
            <SC_NodeMetric class="secondary">
              <SC_NodeMetricLabel>{{ t('explorerPage.peersNodeMetricHeight') }}</SC_NodeMetricLabel>
              <span v-if="node.height !== undefined">{{ formatNumber(node.height) }}</span>
              <span v-else>{{ t('explorerPage.em') }}</span>
            </SC_NodeMetric>
            <SC_NodeMetric class="secondary">
              <SC_NodeMetricLabel>{{
                t('explorerPage.peersNodeMetricVersion')
              }}</SC_NodeMetricLabel>
              <span v-if="node.version">{{ node.version }}</span>
              <span v-else>{{ t('explorerPage.em') }}</span>
            </SC_NodeMetric>
          </SC_NodeRow>
        </template>
      </SC_PeersSection>

      <SC_PeersSection>
        <SC_PeersSectionHeader>
          <SC_PeersSectionTitle>{{
            t('explorerPage.peersPeersSectionTitle')
          }}</SC_PeersSectionTitle>
          <SC_PeersSectionHint v-if="peers.length">
            {{
              t('explorerPage.peersPeersCountHint', { total: peers.length, inbound: inboundCount })
            }}
          </SC_PeersSectionHint>
        </SC_PeersSectionHeader>

        <SC_PeerTableHeader>
          <div>{{ t('explorerPage.peersColAddress') }}</div>
          <div>{{ t('explorerPage.peersColClient') }}</div>
          <div>{{ t('explorerPage.peersColDirection') }}</div>
          <div class="col-hide-mobile">{{ t('explorerPage.peersColPing') }}</div>
          <div class="col-hide-mobile">{{ t('explorerPage.peersColSync') }}</div>
          <div class="col-hide-mobile">{{ t('explorerPage.peersColConnected') }}</div>
        </SC_PeerTableHeader>

        <div v-if="peersLoading && !peers.length">
          <SC_PeerRow v-for="i in 6" :key="`peer-sk-${i}`">
            <SC_PeerAddr><Skeleton :width="140" :height="14" /></SC_PeerAddr>
            <SC_PeerVersion><Skeleton :width="100" :height="14" /></SC_PeerVersion>
            <div><Skeleton :width="50" :height="16" /></div>
            <div class="col-hide-mobile"><Skeleton :width="40" :height="12" /></div>
            <div class="col-hide-mobile"><Skeleton :width="50" :height="12" /></div>
            <div class="col-hide-mobile"><Skeleton :width="50" :height="12" /></div>
          </SC_PeerRow>
        </div>

        <ExplorerError v-else-if="peersError" :message="t('explorerPage.peersPeersError')" />

        <SC_Placeholder v-else-if="!peers.length">
          {{ t('explorerPage.peersPeersEmpty') }}
        </SC_Placeholder>

        <template v-else-if="peers.length">
          <SC_PeerRow v-for="peer in peers" :key="peer.addr">
            <SC_PeerAddr :title="peer.addr">{{ peer.addr }}</SC_PeerAddr>
            <SC_PeerVersion :title="peer.version">{{
              shortenVersion(peer.version)
            }}</SC_PeerVersion>
            <div>
              <SC_DirectionBadge :dir="peer.inbound ? 'in' : 'out'">
                {{ peer.inbound ? t('explorerPage.peersDirIn') : t('explorerPage.peersDirOut') }}
              </SC_DirectionBadge>
            </div>
            <SC_PeerMetaCell class="col-hide-mobile">
              {{ pingLabel(peer.pingtime) }}
            </SC_PeerMetaCell>
            <SC_PeerMetaCell class="col-hide-mobile">
              #{{ formatNumber(peer.synced_blocks) }}
            </SC_PeerMetaCell>
            <SC_PeerMetaCell class="col-hide-mobile">
              {{ ageLabel(peer.conntime) }}
            </SC_PeerMetaCell>
          </SC_PeerRow>
        </template>
      </SC_PeersSection>
    </SC_PeersPage>
  </SC_PeersWork>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { usePeerInfo } from '@/composables/use-block-explorer-queries'
import { useNodeHealth, getProductionServersList } from '@/composables/use-node-health'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components'
import ExplorerError from '../components/shared/explorer-error.vue'
import { formatExplorerNumber as formatNumber } from '../components/shared/format-explorer'
import { formatTimeAgo as formatRelativeTime } from '@/helpers/common/date-formatter'
import type { PeerInfo } from '@/types/rpc-responses/get-peer-info'
import { pingLabel as formatPingLabel, shortenVersion } from './peers-format'
import {
  SC_PeerMetaCell,
  SC_NodeMetricEmpty,
  SC_PeersWork,
  SC_PeersPage,
  SC_PeersBreadcrumb,
  SC_PeersTitle,
  SC_PeersSection,
  SC_PeersSectionHeader,
  SC_PeersSectionTitle,
  SC_PeersSectionHint,
  SC_NodeRow,
  SC_NodeDot,
  SC_NodeAddr,
  SC_NodeMetric,
  SC_NodeMetricLabel,
  SC_PeerTableHeader,
  SC_PeerRow,
  SC_PeerAddr,
  SC_PeerVersion,
  SC_DirectionBadge,
  SC_Placeholder,
} from './peers-page.styled'

defineOptions({ name: 'PeersPage' })

const { t } = useI18n()

const { data: healthData, isLoading: healthLoading } = useNodeHealth()
const { data: peerResp, isLoading: peersLoading, error: peersError } = usePeerInfo()

const totalNodes = computed(() => getProductionServersList().length)
const nodeHealth = computed(() => healthData.value ?? [])
const healthyCount = computed(() => nodeHealth.value.filter((n) => n.ok).length)

const peers = computed<PeerInfo[]>(() => peerResp.value?.data ?? [])
const inboundCount = computed(() => peers.value.filter((p) => p.inbound).length)

/** Подпись пинга: `pingtime` у Core — секунды, а не микросекунды (S68). */
function pingLabel(seconds: number): string {
  return formatPingLabel(seconds, t('explorerPage.em'))
}

function ageLabel(unixSeconds: number): string {
  return formatRelativeTime(unixSeconds)
}
</script>
