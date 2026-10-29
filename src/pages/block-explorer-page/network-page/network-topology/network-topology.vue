<template>
  <SC_Topo ref="rootRef" :class="{ fullscreen: isFullscreen }">
    <SC_TopoToolbar>
      <SC_TopoSegmented role="radiogroup" :aria-label="t('explorerNetwork.colorBy')">
        <SC_TopoSegment
          v-for="mode in COLOR_MODES"
          :key="mode"
          type="button"
          role="radio"
          :aria-checked="colorMode === mode"
          :class="{ active: colorMode === mode }"
          @click="colorMode = mode"
        >
          {{ t(`explorerNetwork.colorMode.${mode}`) }}
        </SC_TopoSegment>
      </SC_TopoSegmented>
      <SC_TopoSegmented role="radiogroup" :aria-label="t('explorerNetwork.layoutLabel')">
        <SC_TopoSegment
          v-for="mode in LAYOUTS"
          :key="mode"
          type="button"
          role="radio"
          :aria-checked="layout === mode"
          :class="{ active: layout === mode }"
          @click="layout = mode"
        >
          {{ t(`explorerNetwork.layout.${mode}`) }}
        </SC_TopoSegment>
      </SC_TopoSegmented>
      <SC_TopoTools>
        <SC_TopoTool
          type="button"
          :title="t('explorerNetwork.zoomIn')"
          :aria-label="t('explorerNetwork.zoomIn')"
          @click="zoomBy(1.4)"
        >
          <ZoomInOutlined />
        </SC_TopoTool>
        <SC_TopoTool
          type="button"
          :title="t('explorerNetwork.zoomOut')"
          :aria-label="t('explorerNetwork.zoomOut')"
          @click="zoomBy(1 / 1.4)"
        >
          <ZoomOutOutlined />
        </SC_TopoTool>
        <SC_TopoTool
          type="button"
          :title="t('explorerNetwork.fit')"
          :aria-label="t('explorerNetwork.fit')"
          @click="fitView(true)"
        >
          <FitViewIcon />
        </SC_TopoTool>
        <SC_TopoTool
          type="button"
          :title="
            isFullscreen ? t('explorerNetwork.exitFullscreen') : t('explorerNetwork.fullscreen')
          "
          :aria-label="
            isFullscreen ? t('explorerNetwork.exitFullscreen') : t('explorerNetwork.fullscreen')
          "
          @click="toggleFullscreen"
        >
          <FullscreenExitOutlined v-if="isFullscreen" />
          <FullscreenOutlined v-else />
        </SC_TopoTool>
      </SC_TopoTools>
    </SC_TopoToolbar>

    <SC_TopoStage ref="stageRef">
      <SC_TopoCanvas
        ref="canvasRef"
        role="img"
        :aria-label="ariaLabel"
        :class="{ pointer: !!hoverId }"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
        @click="onClick"
      />
      <SC_TopoEvent v-if="blockEvent" :key="blockEvent.at" role="status">
        {{ t('explorerNetwork.newBlock', { height: formatExplorerNumber(blockEvent.height) }) }}
      </SC_TopoEvent>
      <NetworkNodeCard
        v-if="cardSpec"
        :spec="cardSpec"
        :tip="tip"
        :pinned="!!selectedId"
        :current-proxy="currentProxyHost"
        @close="select(null)"
        @focus="focusNode"
      />
      <slot />
    </SC_TopoStage>

    <SC_TopoLegend>
      <SC_TopoLegendItem v-for="entry in coloring.legend" :key="entry.labelKey ?? entry.label">
        <SC_TopoSwatch :color="entry.color" />
        {{ entry.labelKey ? t(entry.labelKey) : entry.label }}
        <SC_TopoLegendCount>{{ formatExplorerNumber(entry.count) }}</SC_TopoLegendCount>
      </SC_TopoLegendItem>
      <SC_TopoLegendItem>
        <SC_TopoLine class="p2p" />{{ t('explorerNetwork.legendP2p') }}
      </SC_TopoLegendItem>
      <SC_TopoLegendItem>
        <SC_TopoLine class="pool" />{{ t('explorerNetwork.legendPool') }}
      </SC_TopoLegendItem>
      <SC_TopoLegendItem>
        <SC_TopoPulse />{{ t('explorerNetwork.legendRequest') }}
      </SC_TopoLegendItem>
    </SC_TopoLegend>
    <SC_TopoHint>{{
      coarse ? t('explorerNetwork.hintTouch') : t('explorerNetwork.hintMouse')
    }}</SC_TopoHint>
  </SC_Topo>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  select as d3select,
  zoom as d3zoom,
  zoomIdentity,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3'
import {
  FitViewIcon,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@/components/icons'
import { useTheme } from '@/composables/use-theme'
import { currentProxy } from '@/helpers/api/node-selector'
import { onRpcTraffic } from '@/helpers/api/rpc-traffic'
import { wsService } from '@/blockchain/ws/ws-service'
import { nodeIp, type NetworkSnapshot } from '@/services/network-map/network-snapshot'
import type { NodeRow } from '@/services/network-map/network-stats'
import {
  buildTopology,
  ME_ID,
  proxyIdByHost,
  type TopoKind,
  type TopoLinkKind,
  type TopoNodeSpec,
  type TopoTier,
} from '@/services/network-map/topology-model'
import { formatExplorerNumber } from '../../components/shared/format-explorer'
import NetworkNodeCard from './network-node-card.vue'
import {
  buildColoring,
  COLOR_MODES,
  readPalette,
  roundRect,
  type ColorMode,
  type Palette,
} from './topology-palette'
import {
  SC_Topo,
  SC_TopoToolbar,
  SC_TopoSegmented,
  SC_TopoSegment,
  SC_TopoTools,
  SC_TopoTool,
  SC_TopoStage,
  SC_TopoCanvas,
  SC_TopoEvent,
  SC_TopoLegend,
  SC_TopoLegendItem,
  SC_TopoSwatch,
  SC_TopoLegendCount,
  SC_TopoLine,
  SC_TopoPulse,
  SC_TopoHint,
} from './network-topology.styled'

const p = defineProps<{
  snapshot: NetworkSnapshot
  /** Меняется вместе с картой: сам снимок не реактивен. */
  revision: number
  rows: NodeRow[]
  tip: number
  /** Подсветить только эти ноды (страна из списка); null — все. */
  highlight: Set<string> | null
  countryName: (code: string) => string
}>()

const emit = defineEmits<{ select: [ip: string | null] }>()

const { t } = useI18n()
const { isDark } = useTheme()

const LAYOUTS = ['rings', 'free'] as const
type Layout = (typeof LAYOUTS)[number]

interface SimNode extends SimulationNodeDatum {
  id: string
  kind: TopoKind
  tier: TopoTier
  r: number
  spec: TopoNodeSpec
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  key: string
  kind: TopoLinkKind
  source: SimNode
  target: SimNode
}

const rootRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const stageRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const canvasRef = ref<{ $el?: HTMLCanvasElement } | HTMLCanvasElement | null>(null)
const el = <T extends HTMLElement>(r: { $el?: T } | T | null): T | null =>
  r instanceof HTMLElement ? (r as T) : (r?.$el ?? null)

const colorMode = ref<ColorMode>('sync')
const layout = ref<Layout>('rings')
const hoverId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const isFullscreen = ref(false)
const blockEvent = ref<{ height: number; at: number } | null>(null)
const palette = shallowRef<Palette | null>(null)
const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
const reducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const nodes = new Map<string, SimNode>()
let links: SimLink[] = []
let neighbors = new Map<string, Set<string>>()
let simulation: Simulation<SimNode, SimLink> | null = null
let zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown> | null = null
let transform: ZoomTransform = zoomIdentity
let userMoved = false
let width = 0
let height = 0

const coloring = computed(() => {
  void p.revision
  return buildColoring(colorMode.value, p.rows, palette.value ?? FALLBACK_PALETTE, p.countryName)
})

const FALLBACK_PALETTE: Palette = {
  primary: '#2b7fff',
  success: '#00c16a',
  warning: '#f0b100',
  error: '#fb2c36',
  info: '#2b7fff',
  violet: '#8e51ff',
  pink: '#f6339a',
  text: '#0f172b',
  textMuted: '#62748e',
  textDimmed: '#90a1b9',
  border: '#cad5e2',
  bg: '#fff',
  font: 'sans-serif',
}

const currentProxyHost = ref(currentProxy()?.host ?? null)

const cardSpec = computed<TopoNodeSpec | null>(() => {
  void p.revision
  const id = selectedId.value ?? hoverId.value
  return id ? (nodes.get(id)?.spec ?? null) : null
})

const ariaLabel = computed(() =>
  t('explorerNetwork.topologyAria', {
    nodes: formatExplorerNumber(p.rows.length),
    links: formatExplorerNumber(p.snapshot.links.size),
  })
)

// --- Раскладка

function ringRadii(): Record<TopoTier, number> {
  let open = 0
  let nat = 0
  for (const n of nodes.values()) {
    if (n.tier === 2) open++
    else if (n.tier === 3) nat++
  }
  const r1 = 70
  const r2 = r1 + 60 + Math.sqrt(open) * 9
  const r3 = r2 + 70 + Math.sqrt(nat) * 6
  return { 0: 0, 1: r1, 2: r2, 3: r3 }
}

function radiusOf(spec: TopoNodeSpec): number {
  if (spec.kind === 'me') return 11
  if (spec.kind === 'proxy') return 9
  const degree = spec.row?.degree ?? 0
  return 2.5 + Math.min(4, Math.sqrt(degree) * 0.45)
}

/** Угол по адресу — стабильный между перерисовками, для нод без соседей на кольце. */
function hashAngle(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (((h >>> 0) % 3600) / 3600) * Math.PI * 2
}

/**
 * Куда ставить узлы в раскладке «Кольца». Прокси и открытые ноды — поровну по
 * своим кольцам (открытые — группами по странам), нода за роутером — напротив
 * своих соседей с открытого кольца. Порядок, а не углы, раздаёт места, поэтому
 * кольцо заполнено ровно и ноды не налезают друг на друга.
 */
function ringTargets(radii: Record<TopoTier, number>): Map<string, { x: number; y: number }> {
  const targets = new Map<string, { x: number; y: number }>()
  const place = (list: SimNode[], r: number, wobble = 0) => {
    list.forEach((n, i) => {
      const angle = -Math.PI / 2 + (i / Math.max(1, list.length)) * Math.PI * 2
      const radius = r + (wobble && i % 2 ? wobble : 0)
      targets.set(n.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
    })
  }
  const byTier = (tier: TopoTier) => [...nodes.values()].filter((n) => n.tier === tier)

  place(byTier(1), radii[1])

  const open = byTier(2).sort((a, b) => {
    const ca = a.spec.row?.country ?? '~'
    const cb = b.spec.row?.country ?? '~'
    return ca.localeCompare(cb) || (b.spec.row?.degree ?? 0) - (a.spec.row?.degree ?? 0)
  })
  place(open, radii[2])
  const angleOf = new Map<string, number>()
  for (const n of open) {
    const t = targets.get(n.id)!
    angleOf.set(n.id, Math.atan2(t.y, t.x))
  }

  const behind = byTier(3)
    .map((n) => {
      let sx = 0
      let sy = 0
      for (const id of neighbors.get(n.id) ?? []) {
        const angle = angleOf.get(id)
        if (angle === undefined) continue
        sx += Math.cos(angle)
        sy += Math.sin(angle)
      }
      return { n, angle: sx || sy ? Math.atan2(sy, sx) : hashAngle(n.id) }
    })
    // От верхней точки по часовой — как и открытое кольцо.
    .sort(
      (a, b) =>
        ((a.angle + Math.PI * 2.5) % (Math.PI * 2)) - ((b.angle + Math.PI * 2.5) % (Math.PI * 2))
    )
    .map((x) => x.n)
  place(behind, radii[3], 12)
  return targets
}

let targets = new Map<string, { x: number; y: number }>()

function applyForces(): void {
  if (!simulation) return
  const radii = ringRadii()
  if (layout.value === 'rings') {
    targets = ringTargets(radii)
    const toward = (axis: 'x' | 'y') => (d: SimNode) => targets.get(d.id)?.[axis] ?? 0
    simulation
      .force('link', null)
      .force('charge', null)
      .force('radial', null)
      .force('x', forceX<SimNode>(toward('x')).strength(0.18))
      .force('y', forceY<SimNode>(toward('y')).strength(0.18))
      .force(
        'collide',
        forceCollide<SimNode>((d) => d.r + 1)
      )
    return
  }
  simulation
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((l) => (l.kind === 'access' ? radii[1] : l.kind === 'pool' ? 70 : 34))
        .strength((l) => (l.kind === 'access' ? 0.5 : l.kind === 'pool' ? 0.05 : 0.07))
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength((d) => (d.kind === 'node' ? -28 : -160))
        .distanceMax(300)
    )
    .force(
      'radial',
      forceRadial<SimNode>((d) => radii[d.tier], 0, 0).strength((d) =>
        d.kind === 'node' ? 0 : 0.3
      )
    )
    .force('x', forceX<SimNode>(0).strength(0.03))
    .force('y', forceY<SimNode>(0).strength(0.03))
    .force(
      'collide',
      forceCollide<SimNode>((d) => d.r + 1.5)
    )
}

/** Новая нода выходит из центра к своему месту или рядом с соседом — сеть «прорастает». */
function spawnPoint(spec: TopoNodeSpec, radii: Record<TopoTier, number>): { x: number; y: number } {
  if (layout.value === 'free') {
    for (const id of neighbors.get(spec.id) ?? []) {
      const n = nodes.get(id)
      if (n?.x !== undefined && n.y !== undefined) {
        return { x: n.x + (Math.random() - 0.5) * 20, y: n.y + (Math.random() - 0.5) * 20 }
      }
    }
  }
  const angle = hashAngle(spec.id)
  const r = radii[spec.tier] * 0.5
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
}

function rebuild(): void {
  const model = buildTopology(p.snapshot, p.rows)
  neighbors = new Map()
  for (const l of model.links) {
    if (!neighbors.has(l.source)) neighbors.set(l.source, new Set())
    if (!neighbors.has(l.target)) neighbors.set(l.target, new Set())
    neighbors.get(l.source)!.add(l.target)
    neighbors.get(l.target)!.add(l.source)
  }
  const keep = new Set(model.nodes.map((n) => n.id))
  for (const id of nodes.keys()) if (!keep.has(id)) nodes.delete(id)
  const radii = ringRadii()
  for (const spec of model.nodes) {
    const existing = nodes.get(spec.id)
    if (existing) {
      existing.spec = spec
      existing.tier = spec.tier
      existing.r = radiusOf(spec)
      continue
    }
    const at = spec.kind === 'me' ? { x: 0, y: 0 } : spawnPoint(spec, radii)
    nodes.set(spec.id, {
      id: spec.id,
      kind: spec.kind,
      tier: spec.tier,
      r: radiusOf(spec),
      spec,
      ...at,
      ...(spec.kind === 'me' ? { fx: 0, fy: 0 } : {}),
    })
  }
  links = model.links
    .map((l) => {
      const source = nodes.get(l.source)
      const target = nodes.get(l.target)
      return source && target ? { key: l.key, kind: l.kind, source, target } : null
    })
    .filter((l): l is SimLink => l !== null)
  if (selectedId.value && !nodes.has(selectedId.value)) selectedId.value = null
  if (hoverId.value && !nodes.has(hoverId.value)) hoverId.value = null

  if (!simulation) return
  simulation.nodes([...nodes.values()])
  applyForces()
  if (reducedMotion) {
    simulation.alpha(1).tick(240).stop()
    fitView(false)
    requestRender()
  } else {
    simulation.alpha(Math.max(simulation.alpha(), 0.5)).restart()
  }
}

// --- Масштаб и вписывание

function fitView(byUser: boolean): void {
  if (!zoomBehavior || !width || !height) return
  if (byUser) userMoved = false
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes.values()) {
    if (n.x === undefined || n.y === undefined) continue
    minX = Math.min(minX, n.x - n.r)
    minY = Math.min(minY, n.y - n.r)
    maxX = Math.max(maxX, n.x + n.r)
    maxY = Math.max(maxY, n.y + n.r)
  }
  if (!Number.isFinite(minX)) return
  const pad = 24
  const k = Math.max(
    0.15,
    Math.min(
      2.2,
      Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1))
    )
  )
  const next = zoomIdentity
    .translate(width / 2 - ((minX + maxX) / 2) * k, height / 2 - ((minY + maxY) / 2) * k)
    .scale(k)
  const canvas = el(canvasRef.value)
  if (canvas) d3select(canvas).call(zoomBehavior.transform, next)
}

function zoomBy(factor: number): void {
  const canvas = el(canvasRef.value)
  if (canvas && zoomBehavior) d3select(canvas).call(zoomBehavior.scaleBy, factor)
}

function focusNode(id: string): void {
  const n = nodes.get(id)
  const canvas = el(canvasRef.value)
  if (!n || n.x === undefined || n.y === undefined || !canvas || !zoomBehavior) return
  const k = Math.max(transform.k, 1.6)
  d3select(canvas).call(
    zoomBehavior.transform,
    zoomIdentity.translate(width / 2 - n.x * k, height / 2 - n.y * k).scale(k)
  )
  select(id)
}

// --- Анимации: запросы приложения и новые блоки

interface Pulse {
  path: SimNode[]
  start: number
  ok: boolean
}
const PULSE_MS = 900
const FLASH_MS = 1600
let pulses: Pulse[] = []
let flashAt = 0
const flashing = new Map<string, number>()

let proxyIds = new Map<string, string>()
watch(
  () => p.revision,
  () => {
    proxyIds = proxyIdByHost(p.snapshot.proxies)
  },
  { immediate: true }
)

function onTraffic(event: { proxy: string; node: string | null; ok: boolean }): void {
  currentProxyHost.value = currentProxy()?.host ?? event.proxy
  if (reducedMotion) return
  const me = nodes.get(ME_ID)
  const proxy = nodes.get(proxyIds.get(event.proxy) ?? '')
  if (!me || !proxy) return
  const path = [me, proxy]
  const target = event.node ? nodes.get(nodeIp(event.node, event.proxy)) : undefined
  if (target) path.push(target)
  pulses.push({ path, start: performance.now(), ok: event.ok })
  if (pulses.length > 40) pulses = pulses.slice(-40)
  requestRender()
}

function onBlock(data: { height?: unknown }): void {
  const h = typeof data?.height === 'number' ? data.height : Number(data?.height)
  if (!Number.isFinite(h) || h <= 0) return
  blockEvent.value = { height: h, at: Date.now() }
  window.setTimeout(() => {
    if (blockEvent.value && Date.now() - blockEvent.value.at >= 4000) blockEvent.value = null
  }, 4100)
  if (reducedMotion) return
  flashAt = performance.now()
  requestRender()
}

// --- Рисование

let frame = 0
function requestRender(): void {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    draw()
  })
}

function draw(): void {
  const canvas = el(canvasRef.value)
  const ctx = canvas?.getContext('2d')
  const colors = palette.value
  if (!canvas || !ctx || !colors) return
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.translate(transform.x, transform.y)
  ctx.scale(transform.k, transform.k)
  const k = transform.k
  const now = performance.now()

  const focus = selectedId.value ?? hoverId.value
  const near = focus ? (neighbors.get(focus) ?? new Set<string>()) : null
  const dim = (id: string): boolean => {
    if (near) return id !== focus && !near.has(id) && id !== ME_ID
    if (p.highlight) return !p.highlight.has(id) && nodes.get(id)?.kind === 'node'
    return false
  }

  // Связи между нодами.
  ctx.lineWidth = 0.7 / k
  for (const l of links) {
    if (l.kind !== 'p2p') continue
    const active = focus && (l.source.id === focus || l.target.id === focus)
    ctx.globalAlpha = active ? 0.9 : near || p.highlight ? 0.05 : 0.16
    ctx.strokeStyle = active ? colors.primary : colors.border
    ctx.beginPath()
    ctx.moveTo(l.source.x!, l.source.y!)
    ctx.lineTo(l.target.x!, l.target.y!)
    ctx.stroke()
  }
  // Пулы прокси и ваши подключения к прокси.
  ctx.setLineDash([4 / k, 3 / k])
  for (const l of links) {
    if (l.kind === 'p2p') continue
    const deadProxy = l.kind === 'access' && !l.target.spec.proxies?.some((x) => x.ok)
    const active = focus && (l.source.id === focus || l.target.id === focus)
    ctx.globalAlpha =
      l.kind === 'access' ? (deadProxy ? 0.35 : 0.8) : active ? 0.9 : near ? 0.08 : 0.35
    ctx.strokeStyle = deadProxy ? colors.textDimmed : colors.primary
    ctx.lineWidth = (l.kind === 'access' ? 1.4 : 0.8) / k
    ctx.beginPath()
    ctx.moveTo(l.source.x!, l.source.y!)
    ctx.lineTo(l.target.x!, l.target.y!)
    ctx.stroke()
  }
  ctx.setLineDash([])

  const flashLeft = flashAt ? 1 - (now - flashAt) / FLASH_MS : 0
  const colorOf = coloring.value.colorOf

  // Ноды.
  for (const n of nodes.values()) {
    if (n.kind !== 'node' || n.x === undefined) continue
    const row = n.spec.row!
    ctx.globalAlpha = dim(n.id) ? 0.15 : 1
    if (flashLeft > 0 && row.sync === 'synced' && !dim(n.id)) {
      ctx.fillStyle = colors.success
      ctx.globalAlpha = 0.35 * flashLeft
      ctx.beginPath()
      ctx.arc(n.x, n.y!, n.r + 2 + (1 - flashLeft) * 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    const lit = flashing.get(n.id)
    if (lit && now - lit < 700) {
      ctx.fillStyle = colors.primary
      ctx.globalAlpha = 0.5 * (1 - (now - lit) / 700)
      ctx.beginPath()
      ctx.arc(n.x, n.y!, n.r + 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = dim(n.id) ? 0.15 : 1
    }
    ctx.fillStyle = colorOf(row)
    ctx.beginPath()
    ctx.arc(n.x, n.y!, n.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1 / k
    ctx.strokeStyle = row.proxies.length ? colors.primary : colors.bg
    ctx.stroke()
    if (n.id === focus) {
      ctx.lineWidth = 2 / k
      ctx.strokeStyle = colors.text
      ctx.beginPath()
      ctx.arc(n.x, n.y!, n.r + 3 / k, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // Прокси — квадраты с номером.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const n of nodes.values()) {
    if (n.kind !== 'proxy' || n.x === undefined) continue
    const ok = n.spec.proxies?.some((x) => x.ok)
    const current = n.spec.proxies?.some((x) => x.host === currentProxyHost.value)
    const s = n.r
    ctx.fillStyle = ok ? colors.primary : colors.textDimmed
    roundRect(ctx, n.x - s, n.y! - s, s * 2, s * 2, 3)
    ctx.fill()
    if (current || n.id === focus) {
      ctx.lineWidth = 2 / k
      ctx.strokeStyle = colors.text
      roundRect(ctx, n.x - s - 3 / k, n.y! - s - 3 / k, (s + 3 / k) * 2, (s + 3 / k) * 2, 4)
      ctx.stroke()
    }
    ctx.fillStyle = colors.bg
    ctx.font = `600 ${n.spec.label.length > 2 ? 7 : 9}px ${colors.font}`
    ctx.fillText(n.spec.label.replace(/ · /g, '·'), n.x, n.y! + 0.5)
  }

  // Вы.
  const me = nodes.get(ME_ID)
  if (me?.x !== undefined) {
    ctx.fillStyle = colors.text
    ctx.beginPath()
    ctx.arc(me.x, me.y!, me.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = colors.bg
    ctx.font = `600 8px ${colors.font}`
    ctx.fillText(t('explorerNetwork.me'), me.x, me.y! + 0.5)
  }

  // Подписи: у выбранной ноды и её соседей; при крупном масштабе — у всех открытых.
  ctx.font = `${10 / Math.max(k, 1)}px ${colors.font}`
  ctx.textAlign = 'left'
  ctx.fillStyle = colors.text
  for (const n of nodes.values()) {
    if (n.kind !== 'node' || n.x === undefined) continue
    const show = n.id === focus || (k >= 2.4 && n.tier === 2 && !dim(n.id))
    if (show) ctx.fillText(n.spec.label, n.x + n.r + 3 / k, n.y!)
  }

  // Запросы приложения: точка бежит «вы → прокси → нода».
  let animating = flashLeft > 0
  pulses = pulses.filter((pulse) => now - pulse.start < PULSE_MS)
  for (const pulse of pulses) {
    animating = true
    const progress = (now - pulse.start) / PULSE_MS
    const segments = pulse.path.length - 1
    const at = Math.min(segments - 1e-6, progress * segments)
    const i = Math.floor(at)
    const a = pulse.path[i]!
    const b = pulse.path[i + 1]!
    const f = at - i
    const x = a.x! + (b.x! - a.x!) * f
    const y = a.y! + (b.y! - a.y!) * f
    ctx.fillStyle = pulse.ok ? colors.primary : colors.error
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(x, y, 3 / Math.sqrt(k), 0, Math.PI * 2)
    ctx.fill()
    if (progress > 0.95 && pulse.ok) flashing.set(pulse.path[pulse.path.length - 1]!.id, now)
  }
  for (const [id, at] of flashing) {
    if (now - at < 700) animating = true
    else flashing.delete(id)
  }
  ctx.globalAlpha = 1
  if (animating) requestRender()
}

// --- Указатель

function hitTest(clientX: number, clientY: number): string | null {
  const canvas = el(canvasRef.value)
  if (!canvas || !simulation) return null
  const rect = canvas.getBoundingClientRect()
  const [x, y] = transform.invert([clientX - rect.left, clientY - rect.top])
  const found = simulation.find(x, y, Math.max(10, 14 / transform.k))
  return found?.id ?? null
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return
  const id = hitTest(event.clientX, event.clientY)
  if (id !== hoverId.value) {
    hoverId.value = id
    requestRender()
  }
}

function onPointerLeave(): void {
  if (hoverId.value) {
    hoverId.value = null
    requestRender()
  }
}

function select(id: string | null): void {
  selectedId.value = id
  const spec = id ? nodes.get(id)?.spec : null
  emit('select', spec?.kind === 'node' ? id : null)
  requestRender()
}

let dragged = false
function onClick(event: MouseEvent): void {
  if (dragged) {
    dragged = false
    return
  }
  const id = hitTest(event.clientX, event.clientY)
  select(id && id === selectedId.value ? null : id)
}

// --- Полный экран

function toggleFullscreen(): void {
  const root = el(rootRef.value)
  if (!root) return
  if (document.fullscreenElement) void document.exitFullscreen()
  else if (root.requestFullscreen)
    void root.requestFullscreen().catch(() => (isFullscreen.value = !isFullscreen.value))
  else isFullscreen.value = !isFullscreen.value
}

function onFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === el(rootRef.value)
}

// --- Жизненный цикл

let resizeObserver: ResizeObserver | null = null
const stops: Array<() => void> = []

function resize(): void {
  const stage = el(stageRef.value)
  const canvas = el(canvasRef.value)
  if (!stage || !canvas) return
  width = stage.clientWidth
  height = stage.clientHeight
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  if (!userMoved) fitView(false)
  requestRender()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && selectedId.value) select(null)
}

onMounted(() => {
  const canvas = el(canvasRef.value)
  if (!canvas) return
  palette.value = readPalette(canvas)

  let ticks = 0
  simulation = forceSimulation<SimNode, SimLink>([])
    .alphaDecay(0.025)
    .on('tick', () => {
      if (!userMoved && ++ticks % 8 === 0) fitView(false)
      requestRender()
    })
    .on('end', () => {
      if (!userMoved) fitView(false)
    })

  zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, 8])
    // Колесо без Ctrl листает страницу, один палец — тоже: схема не ловит прокрутку.
    .filter((event: Event) => {
      if (event.type === 'wheel')
        return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey
      if (event.type.startsWith('touch')) return (event as TouchEvent).touches.length > 1
      return !(event as MouseEvent).button
    })
    .on('start', () => {
      dragged = false
    })
    .on('zoom', (event: { transform: ZoomTransform; sourceEvent: Event | null }) => {
      transform = event.transform
      if (event.sourceEvent) {
        userMoved = true
        if (event.sourceEvent.type === 'mousemove' || event.sourceEvent.type === 'touchmove')
          dragged = true
      }
      requestRender()
    })
  d3select(canvas).call(zoomBehavior).on('dblclick.zoom', null)

  resizeObserver = new ResizeObserver(resize)
  const stage = el(stageRef.value)
  if (stage) resizeObserver.observe(stage)
  resize()
  rebuild()

  stops.push(onRpcTraffic(onTraffic), wsService.on('block', onBlock))
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  simulation?.stop()
  simulation = null
  resizeObserver?.disconnect()
  stops.forEach((stop) => stop())
  if (frame) cancelAnimationFrame(frame)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKey)
})

watch(() => p.revision, rebuild)
watch(layout, () => {
  applyForces()
  userMoved = false
  simulation?.alpha(0.9).restart()
})
watch([colorMode, () => p.highlight], requestRender)
watch(isDark, () => {
  const canvas = el(canvasRef.value)
  if (canvas) palette.value = readPalette(canvas)
  requestRender()
})

defineExpose({ focusNode })
</script>
