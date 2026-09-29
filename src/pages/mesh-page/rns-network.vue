<template>
  <SC_MeshCard>
    <SC_MeshCardHead>
      <SC_MeshCardTitle>
        {{ t('mesh.rns.network.title') }}
        <SC_MeshCount>{{ paths.length }}</SC_MeshCount>
      </SC_MeshCardTitle>
      <Button size="small" :loading="loading" @click="refresh">
        {{ t('mesh.rns.network.refresh') }}
      </Button>
    </SC_MeshCardHead>
    <SC_MeshNote>{{ t('mesh.rns.network.lead') }}</SC_MeshNote>
    <SC_MeshError v-if="error">{{ errorText(error) }}</SC_MeshError>

    <SC_NetGraph>
      <svg :viewBox="viewBox" role="img" :aria-label="t('mesh.rns.network.graph')">
        <g v-for="ring in rings" :key="ring.hops">
          <circle class="ring" :r="ring.r" />
          <text class="ring-label" :x="ring.r * 0.72 + 4" :y="ring.r * 0.72 + 4">
            {{ ring.label }}
          </text>
        </g>
        <line
          v-for="e in lines"
          :key="e.key"
          class="edge"
          :x1="e.x1"
          :y1="e.y1"
          :x2="e.x2"
          :y2="e.y2"
        />
        <g
          v-for="n in graph.nodes"
          :key="n.id"
          :class="['node', n.kind, { offline: !n.online }]"
          :transform="`translate(${n.x} ${n.y})`"
        >
          <title>{{ n.label }}</title>
          <circle :r="n.kind === 'self' ? 11 : n.kind === 'interface' ? 8 : 6" />
          <text v-if="labelled(n)" :y="n.kind === 'self' ? 26 : -11">{{ n.label }}</text>
        </g>
      </svg>
    </SC_NetGraph>
    <SC_NetLegend>
      <li v-for="kind in LEGEND" :key="kind" :class="kind">
        {{ t(`mesh.rns.network.kind.${kind}`) }}
      </li>
    </SC_NetLegend>

    <SC_MeshNote v-if="paths.length === 0 && !loading">{{
      t('mesh.rns.network.empty')
    }}</SC_MeshNote>
    <SC_MeshNote v-else-if="graph.hidden > 0">
      {{ t('mesh.rns.network.hidden', { n: graph.hidden }, graph.hidden) }}
    </SC_MeshNote>

    <SC_MeshList v-if="rows.length > 0">
      <SC_MeshItem v-for="r in rows" :key="r.dest">
        <SC_MeshItemMain>
          <SC_MeshItemName>{{ r.name }}</SC_MeshItemName>
          <SC_MeshItemMeta>{{ r.meta }}</SC_MeshItemMeta>
        </SC_MeshItemMain>
        <Button
          v-if="r.aspect === 'lxmf.delivery'"
          size="small"
          @click="writeToLxmf(r.dest, r.peerName)"
        >
          {{ t('mesh.contacts.write') }}
        </Button>
      </SC_MeshItem>
    </SC_MeshList>
    <SC_MeshNote v-if="paths.length > rows.length">
      {{
        t('mesh.rns.network.more', { n: paths.length - rows.length }, paths.length - rows.length)
      }}
    </SC_MeshNote>
  </SC_MeshCard>
</template>

<script setup lang="ts">
/**
 * Обзор сети Reticulum: куда узел знает дорогу (таблица путей), через какой
 * интерфейс и транспортный узел, сколько прыжков. Граф — ближние адреса по
 * кольцам (network-graph.ts), список — все пути, ближние первыми.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Button } from 'ant-design-vue'
import { formatTimeAgo } from '@/helpers/common/date-formatter'
import {
  ASPECT_KIND,
  MAX_RING_HOPS,
  RING_INTERFACE,
  RING_STEP,
  buildNetGraph,
  type NetNode,
  type NetNodeKind,
} from '@/mesh/reticulum/network-graph'
import { rnsPaths, type RnsAspect, type RnsPath } from '@/mesh/reticulum/rns-api'
import { meshErrorCode } from '@/mesh/store/radio-common'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { useMeshErrorText, useMeshOpenChat } from './use-mesh-page'
import {
  SC_MeshCard,
  SC_MeshCardHead,
  SC_MeshCardTitle,
  SC_MeshCount,
  SC_MeshError,
  SC_MeshItem,
  SC_MeshItemMain,
  SC_MeshItemMeta,
  SC_MeshItemName,
  SC_MeshList,
  SC_MeshNote,
} from './mesh-page.styled'
import { SC_NetGraph, SC_NetLegend } from './rns-network.styled'

/** Как часто обновлять таблицу путей, пока карточка на экране. */
const REFRESH_MS = 15_000
/** Сколько путей показывать списком. */
const MAX_ROWS = 100

const LEGEND: NetNodeKind[] = [
  'self',
  'interface',
  'transport',
  'delivery',
  'nomadnetwork',
  'propagation',
  'unknown',
]

const { t } = useI18n()
const rns = useReticulumStore()
const { peers, interfaces, config } = storeToRefs(rns)
const errorText = useMeshErrorText()
const { writeToLxmf } = useMeshOpenChat()

const paths = ref<RnsPath[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

async function refresh(): Promise<void> {
  if (rns.status !== 'running' || loading.value) return
  loading.value = true
  try {
    paths.value = await rnsPaths()
    error.value = null
  } catch (e) {
    error.value = meshErrorCode(e)
  } finally {
    loading.value = false
  }
}

const graph = computed(() =>
  buildNetGraph(
    paths.value,
    peers.value,
    interfaces.value.map((i) => ({ name: i.name, kind: i.kind, online: i.online })),
    config.value.displayName || t('mesh.rns.network.kind.self')
  )
)

const viewBox = computed(() => {
  const r = graph.value.radius + 36
  return `${-r} ${-r} ${2 * r} ${2 * r}`
})

/** Кольца прыжков: 1, 2, … до самого дальнего («4+» — последнее). */
const rings = computed(() => {
  const out: Array<{ hops: number; r: number; label: string }> = []
  for (let h = 1; RING_INTERFACE + RING_STEP * h <= graph.value.radius; h++) {
    out.push({
      hops: h,
      r: RING_INTERFACE + RING_STEP * h,
      label: h === MAX_RING_HOPS ? `${h}+` : String(h),
    })
  }
  return out
})

const lines = computed(() => {
  const at = new Map(graph.value.nodes.map((n) => [n.id, n]))
  return graph.value.edges.flatMap((e) => {
    const a = at.get(e.from)
    const b = at.get(e.to)
    return a && b ? [{ key: `${e.from}>${e.to}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : []
  })
})

/** Подписи — у узлов с именами; у безымянных адресов имя во всплывающей подсказке. */
function labelled(n: NetNode): boolean {
  return n.kind !== 'unknown' && !(n.kind === 'transport' && /^[0-9a-f]{8}$/.test(n.label))
}

const byDest = computed(() => new Map(peers.value.map((p) => [p.dest, p])))
const byIdentity = computed(() => new Map(peers.value.map((p) => [p.identity, p])))

const rows = computed(() =>
  paths.value.slice(0, MAX_ROWS).map((p) => {
    const peer = byDest.value.get(p.dest)
    const aspect: RnsAspect | null = peer?.aspect ?? null
    const parts = [
      t(`mesh.rns.network.kind.${aspect ? ASPECT_KIND[aspect] : 'unknown'}`),
      p.hops <= 1 ? t('mesh.contacts.direct') : t('mesh.contacts.hops', { n: p.hops }, p.hops),
    ]
    if (p.via) {
      const hop = byIdentity.value.get(p.via)?.name || p.via.slice(0, 8)
      parts.push(t('mesh.rns.network.via', { name: hop }))
    }
    if (p.interface) parts.push(p.interface)
    if (p.updated > 0) parts.push(formatTimeAgo(Math.floor(p.updated)))
    return {
      dest: p.dest,
      aspect,
      peerName: peer?.name ?? null,
      name: peer?.name || p.dest.slice(0, 12),
      meta: parts.join(' · '),
    }
  })
)

onMounted(() => {
  void refresh()
  timer = setInterval(() => void refresh(), REFRESH_MS)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
