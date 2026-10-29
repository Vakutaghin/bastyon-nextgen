/**
 * Цвета схемы сети. Canvas не понимает `var(--…)`, поэтому токены темы читаем
 * из CSS и перечитываем при смене темы. Здесь же — как раскрашивать точки в
 * каждом режиме и что писать в легенде.
 */

import type { SyncState } from '@/services/network-map/network-snapshot'
import type { NodeRow } from '@/services/network-map/network-stats'

export interface Palette {
  primary: string
  success: string
  warning: string
  error: string
  info: string
  violet: string
  pink: string
  text: string
  textMuted: string
  textDimmed: string
  border: string
  bg: string
  font: string
}

const TOKENS: Record<Exclude<keyof Palette, 'font'>, string> = {
  primary: '--ui-primary',
  success: '--ui-success',
  warning: '--ui-warning',
  error: '--ui-error',
  info: '--ui-info',
  violet: '--ui-violet',
  pink: '--ui-pink',
  text: '--ui-text-highlighted',
  textMuted: '--ui-text-muted',
  textDimmed: '--ui-text-dimmed',
  border: '--ui-border-accented',
  bg: '--ui-bg',
}

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el)
  const palette = { font: style.fontFamily || 'sans-serif' } as Palette
  for (const [key, token] of Object.entries(TOKENS)) {
    palette[key as keyof typeof TOKENS] = style.getPropertyValue(token).trim() || '#888'
  }
  return palette
}

export type ColorMode = 'sync' | 'kind' | 'version' | 'country' | 'access'

export const COLOR_MODES: readonly ColorMode[] = ['sync', 'kind', 'version', 'country', 'access']

export interface LegendEntry {
  /** Группа нод: по нему легенда прячет и показывает их. */
  key: string
  /** Ключ i18n или готовая подпись (страна, версия). */
  labelKey?: string
  label?: string
  color: string
  count: number
}

/** Сколько первых стран и версий получают свой цвет, остальные — серые. */
const TOP_GROUPS = 6

export interface Coloring {
  colorOf(row: NodeRow): string
  /** Ключ группы ноды — тот же, что у её строки легенды. */
  groupOf(row: NodeRow): string
  legend: LegendEntry[]
}

function countBy(rows: NodeRow[], key: (row: NodeRow) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const k = key(row)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

export function buildColoring(
  mode: ColorMode,
  rows: NodeRow[],
  palette: Palette,
  countryName: (code: string) => string
): Coloring {
  const groupColors = [
    palette.info,
    palette.success,
    palette.warning,
    palette.violet,
    palette.pink,
    palette.error,
  ]

  if (mode === 'sync') {
    const stateOf = (row: NodeRow): SyncState | 'forked' => (row.forked ? 'forked' : row.sync)
    const colors = {
      synced: palette.success,
      behind: palette.warning,
      forked: palette.error,
      unknown: palette.textDimmed,
    }
    const counts = countBy(rows, stateOf)
    return {
      colorOf: (row) => colors[stateOf(row)],
      groupOf: (row) => `sync:${stateOf(row)}`,
      legend: (['synced', 'behind', 'forked', 'unknown'] as const)
        .map((s) => ({
          key: `sync:${s}`,
          labelKey: `explorerNetwork.sync.${s}`,
          color: colors[s],
          count: counts.get(s) ?? 0,
        }))
        .filter((e) => e.count),
    }
  }

  if (mode === 'kind') {
    const colors = { full: palette.info, pruned: palette.violet, unknown: palette.textDimmed }
    const counts = countBy(rows, (row) => row.kind)
    return {
      colorOf: (row) => colors[row.kind],
      groupOf: (row) => `kind:${row.kind}`,
      legend: (['full', 'pruned', 'unknown'] as const)
        .map((k) => ({
          key: `kind:${k}`,
          labelKey: `explorerNetwork.kind.${k}`,
          color: colors[k],
          count: counts.get(k) ?? 0,
        }))
        .filter((e) => e.count),
    }
  }

  if (mode === 'access') {
    const counts = countBy(rows, (r) => (r.listening ? 'open' : 'nat'))
    return {
      colorOf: (row) => (row.listening ? palette.info : palette.textDimmed),
      groupOf: (row) => (row.listening ? 'access:open' : 'access:nat'),
      legend: [
        {
          key: 'access:open',
          labelKey: 'explorerNetwork.access.open',
          color: palette.info,
          count: counts.get('open') ?? 0,
        },
        {
          key: 'access:nat',
          labelKey: 'explorerNetwork.access.nat',
          color: palette.textDimmed,
          count: counts.get('nat') ?? 0,
        },
      ].filter((e) => e.count),
    }
  }

  const keyOf =
    mode === 'version' ? (r: NodeRow) => r.version : (r: NodeRow) => r.country ?? undefined
  const counts = countBy(rows, keyOf)
  const ordered = [...counts.entries()].sort((a, b) =>
    mode === 'version' ? b[0].localeCompare(a[0], undefined, { numeric: true }) : b[1] - a[1]
  )
  const top = new Map(ordered.slice(0, TOP_GROUPS).map(([k], i) => [k, groupColors[i]!]))
  const rest = ordered.slice(TOP_GROUPS).reduce((sum, [, n]) => sum + n, 0)
  const unknown = rows.length - ordered.reduce((sum, [, n]) => sum + n, 0)
  const legend: LegendEntry[] = ordered.slice(0, TOP_GROUPS).map(([k, n]) => ({
    key: `${mode}:${k}`,
    label: mode === 'version' ? k : countryName(k),
    color: top.get(k)!,
    count: n,
  }))
  if (rest) {
    legend.push({
      key: `${mode}:~other`,
      labelKey: 'explorerNetwork.legendOther',
      color: palette.textMuted,
      count: rest,
    })
  }
  if (unknown) {
    legend.push({
      key: `${mode}:~unknown`,
      labelKey: 'explorerNetwork.legendUnknown',
      color: palette.textDimmed,
      count: unknown,
    })
  }
  return {
    colorOf: (row) => {
      const k = keyOf(row)
      return k ? (top.get(k) ?? palette.textMuted) : palette.textDimmed
    },
    groupOf: (row) => {
      const k = keyOf(row)
      return `${mode}:${k ? (top.has(k) ? k : '~other') : '~unknown'}`
    },
    legend,
  }
}

/** Квадрат прокси со скруглёнными углами. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
