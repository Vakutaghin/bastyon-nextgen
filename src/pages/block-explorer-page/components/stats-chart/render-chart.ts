/**
 * Рисование графика статистики на d3: площади стопкой, линии или столбцы
 * по оси времени. Размер — настоящие пиксели контейнера (не растянутый
 * viewBox): подписи на телефоне не сплющиваются. Цвета — через style, а не
 * атрибуты: var() в атрибутах SVG понимают не все движки.
 */

import * as d3 from 'd3'
import type { ChartPoint } from '../../stats/stats-model'
import { axisTimeFormatter, formatTicks } from '../../stats/chart-format'

export type ChartKind = 'stack' | 'line' | 'bar'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

export interface ChartLayout {
  left: number
  top: number
  width: number
  height: number
  /** Центр точки `i` по горизонтали, в координатах svg. */
  xOf: (i: number) => number
  /** Верх метки серии `key` в точке `i`, в координатах svg; нет значения — null. */
  yOf: (i: number, key: string) => number | null
}

const MARGIN = { top: 10, right: 12, bottom: 26, left: 46 }
const DURATION = 320
const MAX_BAR = 24

const mid = (p: ChartPoint) => (p.t + p.end) / 2

/** Столбец с закруглённым верхом и прямым низом. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(4, w / 2, h)
  if (w < 6) return `M${x},${y + h}V${y}H${x + w}V${y + h}Z`
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export function renderChart(o: {
  svg: SVGSVGElement
  width: number
  height: number
  points: ChartPoint[]
  series: ChartSeries[]
  kind: ChartKind
  locale: string
  animate: boolean
  /** Ось значений от нуля. Без нуля — для линий, где важен ход, а не величина (выпуск монет). */
  zeroBased?: boolean
}): ChartLayout {
  const { points: pts, series } = o
  const innerW = Math.max(20, o.width - MARGIN.left - MARGIN.right)
  const innerH = Math.max(20, o.height - MARGIN.top - MARGIN.bottom)
  const svg = d3.select(o.svg)
  svg.attr('width', o.width).attr('height', o.height).attr('viewBox', `0 0 ${o.width} ${o.height}`)

  let root = svg.select<SVGGElement>('g.root')
  if (root.empty()) {
    root = svg.append('g').attr('class', 'root')
    root.append('g').attr('class', 'grid')
    root.append('g').attr('class', 'marks')
    root.append('g').attr('class', 'x-axis')
    root.append('g').attr('class', 'hover')
  }
  root.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const first = pts[0]!.t
  const last = pts[pts.length - 1]!.end
  const x = d3.scaleTime().domain([first, last]).range([0, innerW])
  const keys = series.map((s) => s.key)
  const value = (p: ChartPoint, k: string) => p.values[k] ?? 0
  // Площадь из одной точки не нарисовать — тогда стопка столбцов.
  const kind: ChartKind = o.kind === 'stack' && pts.length < 3 ? 'bar' : o.kind
  const stacked =
    o.kind === 'stack'
      ? d3
          .stack<ChartPoint>()
          .keys(keys)
          .value((p, k) => value(p, k))(pts)
      : []
  const yMax =
    o.kind === 'stack'
      ? (d3.max(stacked, (s) => d3.max(s, (d) => d[1])) ?? 0)
      : (d3.max(pts, (p) => d3.max(keys, (k) => value(p, k))) ?? 0)
  const zeroBased = o.zeroBased !== false || kind !== 'line'
  const yMin = zeroBased
    ? 0
    : (d3.min(pts, (p) => d3.min(keys, (k) => p.values[k] ?? undefined)) ?? 0)
  const y = d3
    .scaleLinear()
    .domain([yMin, yMax > yMin ? yMax : yMin + 1])
    .nice(4)
    .range([innerH, 0])
  const colorOf = (key: string) => series.find((s) => s.key === key)?.color ?? 'currentColor'
  const dur = o.animate ? DURATION : 0

  // Сетка и подписи значений: тонкие сплошные линии, приглушённый текст.
  const grid = root.select<SVGGElement>('g.grid')
  const ticks = y.ticks(4)
  const tickLabels = formatTicks(ticks, o.locale)
  grid
    .selectAll<SVGLineElement, number>('line')
    .data(ticks)
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => Math.round(y(d)) + 0.5)
    .attr('y2', (d) => Math.round(y(d)) + 0.5)
    .style('stroke', 'var(--ui-border)')
    .attr('stroke-width', 1)
  grid
    .selectAll<SVGTextElement, number>('text')
    .data(ticks)
    .join('text')
    .attr('x', -8)
    .attr('y', (d) => y(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .style('fill', 'var(--ui-text-muted)')
    .style('font-size', '11px')
    .text((_d, i) => tickLabels[i] ?? '')

  const marks = root.select<SVGGElement>('g.marks')
  marks.selectAll('*').interrupt()
  if (kind !== 'stack') marks.selectAll('path.layer').remove()
  if (kind !== 'line') marks.selectAll('path.line, path.wash').remove()
  if (kind !== 'bar') marks.selectAll('g.bars').remove()

  if (kind === 'stack') {
    const area = d3
      .area<d3.SeriesPoint<ChartPoint>>()
      .x((d) => x(mid(d.data)))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX)
    const flat = d3
      .area<d3.SeriesPoint<ChartPoint>>()
      .x((d) => x(mid(d.data)))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[0]))
      .curve(d3.curveMonotoneX)
    marks
      .selectAll<SVGPathElement, d3.Series<ChartPoint, string>>('path.layer')
      .data(stacked, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'layer')
            .attr('d', (d) => (dur ? flat(d) : area(d))),
        (update) => update,
        (exit) => exit.remove()
      )
      .style('fill', (d) => colorOf(d.key))
      .attr('fill-opacity', 0.88)
      // Тонкий зазор цветом фона между слоями вместо обводки.
      .style('stroke', 'var(--ui-bg)')
      .attr('stroke-width', 1)
      .transition()
      .duration(dur)
      .attr('d', (d) => area(d))
  }

  if (kind === 'line') {
    const lineOf = (k: string) =>
      d3
        .line<ChartPoint>()
        .defined((p) => p.values[k] !== null && p.values[k] !== undefined)
        .x((p) => x(mid(p)))
        .y((p) => y(value(p, k)))
        .curve(d3.curveMonotoneX)
    // Одна линия — с лёгкой заливкой под ней.
    // Заливка до нуля оси; ось не от нуля — без неё, иначе площадь врёт.
    const washKey = keys.length === 1 && zeroBased ? keys[0]! : null
    marks
      .selectAll<SVGPathElement, string>('path.wash')
      .data(washKey ? [washKey] : [])
      .join('path')
      .attr('class', 'wash')
      .style('fill', (k) => colorOf(k))
      .attr('fill-opacity', 0.1)
      .style('stroke', 'none')
      .attr(
        'd',
        (k) =>
          d3
            .area<ChartPoint>()
            .defined((p) => p.values[k] !== null && p.values[k] !== undefined)
            .x((p) => x(mid(p)))
            .y0(innerH)
            .y1((p) => y(value(p, k)))
            .curve(d3.curveMonotoneX)(pts) ?? ''
      )
    marks
      .selectAll<SVGPathElement, string>('path.line')
      .data(keys, (k) => k)
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'line')
            .attr('d', (k) => lineOf(k)(pts) ?? '')
            .style('opacity', dur ? 0 : 1),
        (update) => update,
        (exit) => exit.remove()
      )
      .style('fill', 'none')
      .style('stroke', (k) => colorOf(k))
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .transition()
      .duration(dur)
      .style('opacity', 1)
      .attr('d', (k) => lineOf(k)(pts) ?? '')
  }

  if (kind === 'bar') {
    const slot = (p: ChartPoint) => Math.max(1, x(p.end) - x(p.t))
    const width = (p: ChartPoint) => Math.min(MAX_BAR, Math.max(1, slot(p) - 2))
    type Layer = ArrayLike<[number, number]> & { key: string }
    const tops: Layer[] =
      o.kind === 'stack'
        ? (stacked as unknown as Layer[])
        : keys.map((k) =>
            Object.assign(
              pts.map((p) => [0, value(p, k)] as [number, number]),
              { key: k }
            )
          )
    marks
      .selectAll<SVGGElement, Layer>('g.bars')
      .data(tops, (d) => d.key)
      .join('g')
      .attr('class', 'bars')
      .style('fill', (d) => colorOf(d.key))
      .selectAll<SVGPathElement, [number, number]>('path')
      .data((d) => Array.from(d, (v) => [v[0], v[1]] as [number, number]))
      .join('path')
      .attr('d', (v, i) => {
        const p = pts[i]!
        const w = width(p)
        const left = x(mid(p)) - w / 2
        // Между слоями стопки — зазор в 1 px.
        const top = y(v[1])
        const bottom = y(v[0]) - (v[0] > 0 ? 1 : 0)
        return barPath(left, top, w, bottom - top)
      })
  }

  // Ось времени: подписи без линии, единица — по длине отрезка.
  // Делений — сколько влезает без наложения, но не меньше трёх: на телефоне
  // d3 при счёте 2–3 выбирал месяц, и у 30 дней оставалась одна подпись.
  const room = Math.max(3, Math.floor(innerW / 96))
  let xTicks = x.ticks(room)
  for (let n = room + 1; xTicks.length < 3 && n <= room + 8; n++) xTicks = x.ticks(n)
  const minGap = 56
  xTicks = xTicks.filter((d, i, all) => i === 0 || x(d) - x(all[i - 1]!) >= minGap)
  const formatTick = axisTimeFormatter(last - first, o.locale)
  root
    .select<SVGGElement>('g.x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .selectAll<SVGTextElement, Date>('text')
    .data(xTicks)
    .join('text')
    .attr('x', (d) => x(d))
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--ui-text-muted)')
    .style('font-size', '11px')
    .text((d) => formatTick(d))

  return {
    left: MARGIN.left,
    top: MARGIN.top,
    width: innerW,
    height: innerH,
    xOf: (i) => MARGIN.left + x(mid(pts[i]!)),
    yOf: (i, key) => {
      const p = pts[i]
      if (!p) return null
      if (o.kind === 'stack') {
        const layer = stacked.find((s) => s.key === key)
        return layer ? MARGIN.top + y(layer[i]![1]) : null
      }
      const v = p.values[key]
      return v === null || v === undefined ? null : MARGIN.top + y(v)
    },
  }
}

/** Перекрестье и точки серий в точке `index`; `null` — убрать. */
export function drawHover(
  svgEl: SVGSVGElement,
  layout: ChartLayout | null,
  index: number | null,
  series: ChartSeries[],
  kind: ChartKind
): void {
  const hover = d3.select(svgEl).select<SVGGElement>('g.hover')
  if (!layout || index === null) {
    hover.selectAll('*').remove()
    return
  }
  const cx = layout.xOf(index) - layout.left
  hover
    .selectAll<SVGLineElement, number>('line')
    .data([cx])
    .join('line')
    .attr('x1', (d) => d)
    .attr('x2', (d) => d)
    .attr('y1', 0)
    .attr('y2', layout.height)
    .style('stroke', 'var(--ui-text-dimmed)')
    .attr('stroke-width', 1)
  const dots = kind === 'bar' ? [] : series
  hover
    .selectAll<SVGCircleElement, ChartSeries>('circle')
    .data(
      dots.filter((s) => layout.yOf(index, s.key) !== null),
      (s) => s.key
    )
    .join('circle')
    .attr('cx', cx)
    .attr('cy', (s) => (layout.yOf(index, s.key) ?? 0) - layout.top)
    .attr('r', 4)
    .style('fill', (s) => s.color)
    // Кольцо цветом фона — точка читается поверх линий.
    .style('stroke', 'var(--ui-bg)')
    .attr('stroke-width', 2)
}
