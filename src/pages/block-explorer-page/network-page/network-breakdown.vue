<template>
  <SC_NetCardBody>
    <SC_NetCardLead>{{ t('explorerNetwork.breakdown.lead') }}</SC_NetCardLead>

    <SC_SubTitle>
      {{ t('explorerNetwork.breakdown.kinds') }}
      <InfoTooltip :text="t('explorerNetwork.tips.kind')" />
    </SC_SubTitle>
    <SC_ShareList>
      <SC_ShareRow v-for="item in kinds" :key="item.key">
        <SC_ShareName>{{ t(`explorerNetwork.kind.${item.key}`) }}</SC_ShareName>
        <SC_ShareCount
          >{{ formatExplorerNumber(item.count) }} · {{ percent(item.share) }}</SC_ShareCount
        >
        <SC_ShareBar :share="item.share" :color="item.color" />
      </SC_ShareRow>
    </SC_ShareList>

    <SC_SubTitle>
      {{ t('explorerNetwork.breakdown.sync') }}
      <InfoTooltip :text="t('explorerNetwork.tips.sync')" />
    </SC_SubTitle>
    <SC_ShareList>
      <SC_ShareRow v-for="item in sync" :key="item.key">
        <SC_ShareName>{{ t(`explorerNetwork.sync.${item.key}`) }}</SC_ShareName>
        <SC_ShareCount
          >{{ formatExplorerNumber(item.count) }} · {{ percent(item.share) }}</SC_ShareCount
        >
        <SC_ShareBar :share="item.share" :color="item.color" />
      </SC_ShareRow>
    </SC_ShareList>

    <SC_SubTitle>
      {{ t('explorerNetwork.breakdown.versions') }}
      <InfoTooltip :text="t('explorerNetwork.tips.version')" />
    </SC_SubTitle>
    <SC_ShareList>
      <SC_ShareRow v-for="(v, i) in versions.versions" :key="v.key">
        <SC_ShareName>
          {{ v.key }}
          <small v-if="i === 0">{{ t('explorerNetwork.breakdown.latest') }}</small>
        </SC_ShareName>
        <SC_ShareCount>{{ formatExplorerNumber(v.count) }} · {{ percent(v.share) }}</SC_ShareCount>
        <SC_ShareBar
          :share="v.share"
          :color="i === 0 ? 'var(--ui-success)' : 'var(--ui-warning)'"
        />
      </SC_ShareRow>
      <SC_ShareRow v-if="versions.unknown">
        <SC_ShareName>{{ t('explorerNetwork.legendUnknown') }}</SC_ShareName>
        <SC_ShareCount>{{ formatExplorerNumber(versions.unknown) }}</SC_ShareCount>
      </SC_ShareRow>
    </SC_ShareList>
  </SC_NetCardBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CountShare, NodeRow } from '@/services/network-map/network-stats'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import { formatExplorerNumber } from '../components/shared/format-explorer'
import {
  SC_NetCardBody,
  SC_NetCardLead,
  SC_SubTitle,
  SC_ShareList,
  SC_ShareRow,
  SC_ShareName,
  SC_ShareCount,
  SC_ShareBar,
} from './network-page.styled'

const p = defineProps<{
  rows: NodeRow[]
  versions: { versions: CountShare<string>[]; unknown: number }
  percent: (share: number) => string
}>()

const { t } = useI18n()

function groups<K extends string>(
  keys: readonly K[],
  keyOf: (row: NodeRow) => K,
  colors: Record<K, string>
) {
  const total = p.rows.length || 1
  return keys
    .map((key) => {
      const count = p.rows.filter((row) => keyOf(row) === key).length
      return { key, count, share: count / total, color: colors[key] }
    })
    .filter((item) => item.count)
}

const kinds = computed(() =>
  groups(['full', 'pruned', 'unknown'] as const, (row) => row.kind, {
    full: 'var(--ui-info)',
    pruned: 'var(--ui-violet)',
    unknown: 'var(--ui-text-dimmed)',
  })
)

const sync = computed(() =>
  groups(
    ['synced', 'behind', 'forked', 'unknown'] as const,
    (row) => (row.forked ? 'forked' : row.sync),
    {
      synced: 'var(--ui-success)',
      behind: 'var(--ui-warning)',
      forked: 'var(--ui-error)',
      unknown: 'var(--ui-text-dimmed)',
    }
  )
)
</script>
