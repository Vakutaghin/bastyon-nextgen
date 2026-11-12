// Админка анонимной статистики: читает /api/stats и рисует плитки, графики и таблицы.
// Без библиотек; все подписи — через textContent.
'use strict'

const SVG = 'http://www.w3.org/2000/svg'
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const PLATFORM_NAMES = {
  android: 'Android',
  ios: 'iPhone',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  web: 'Браузер',
}
const METRICS = {
  devices: {
    title: 'Устройства за сутки',
    unit: (v) => plural(v, 'устройство', 'устройства', 'устройств'),
  },
  hours: { title: 'Часы использования за сутки', unit: (v) => plural(v, 'час', 'часа', 'часов') },
  installs: {
    title: 'Новые устройства за сутки',
    unit: (v) => plural(v, 'новое', 'новых', 'новых'),
  },
}
const SEQ_STEPS = 7

const int = new Intl.NumberFormat('ru-RU')
const dec = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const monthName = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const state = { days: readDays(), metric: 'devices', data: null }

// ─── Мелочи ──────────────────────────────────────────────────────────────────

function readDays() {
  try {
    const v = Number(localStorage.getItem('stats.days'))
    return [7, 30, 90, 365].includes(v) ? v : 30
  } catch {
    return 30
  }
}

function saveDays(v) {
  try {
    localStorage.setItem('stats.days', String(v))
  } catch {
    // без сохранения — не беда
  }
}

function plural(n, one, few, many) {
  if (!Number.isInteger(n)) return few
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function num(v) {
  return Number.isInteger(v) ? int.format(v) : dec.format(v)
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') node.textContent = v
    else if (k === 'class') node.className = v
    else node.setAttribute(k, v)
  }
  for (const child of children) node.append(child)
  return node
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

function shortDate(iso) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]
}

function weekRange(key) {
  const [y, w] = key.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const monday = new Date(
    jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 864e5 + (w - 1) * 7 * 864e5
  )
  const sunday = new Date(monday.getTime() + 6 * 864e5)
  const f = (d) =>
    `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${f(monday)}–${f(sunday)}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return monthName.format(new Date(Date.UTC(y, m - 1, 1)))
}

function niceTicks(max) {
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw) || pow * 10
  const ticks = []
  for (let v = 0; v <= max + step * 0.001 || ticks.length < 2; v += step) {
    ticks.push(Math.round(v * 100) / 100)
    if (v >= max) break
  }
  return ticks
}

function table(head, rows, numeric) {
  const thead = el('thead', {}, [
    el(
      'tr',
      {},
      head.map((h, i) => el('th', { text: h, class: numeric[i] ? 'num' : '' }))
    ),
  ])
  const tbody = el(
    'tbody',
    {},
    rows.map((row) =>
      el(
        'tr',
        row.partial ? { class: 'partial' } : {},
        row.cells.map((c, i) => el('td', { text: c, class: numeric[i] ? 'num' : '' }))
      )
    )
  )
  return el('table', {}, [thead, tbody])
}

// ─── Подсказка ───────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip')

function showTip(x, y, value, label) {
  tooltip.textContent = ''
  tooltip.append(el('strong', { text: value }), el('span', { text: label }))
  tooltip.hidden = false
  const rect = tooltip.getBoundingClientRect()
  const left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, x - rect.width / 2))
  const top = y - rect.height - 12 < 8 ? y + 16 : y - rect.height - 12
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

function hideTip() {
  tooltip.hidden = true
}

// ─── Плитки ──────────────────────────────────────────────────────────────────

function renderTiles(t) {
  const tiles = [
    ['Устройств сегодня', int.format(t.today), `вчера — ${int.format(t.yesterday)}`],
    [
      'Устройств вчера',
      int.format(t.yesterday),
      `≈ ${int.format(t.minutesPerDeviceYesterday)} мин на устройство`,
    ],
    ['За эту неделю', int.format(t.week), `прошлая — ${int.format(t.lastWeek)}`],
    ['За этот месяц', int.format(t.month), `прошлый — ${int.format(t.lastMonth)}`],
    ['Часов вчера', dec.format(t.hoursYesterday), 'всеми устройствами вместе'],
    ['Новых за период', int.format(t.installs), 'впервые прислали отметку'],
  ]
  const box = document.getElementById('tiles')
  box.textContent = ''
  for (const [label, value, delta] of tiles) {
    box.append(
      el('div', { class: 'tile' }, [
        el('div', { class: 'label', text: label }),
        el('div', { class: 'value', text: value }),
        el('div', { class: 'delta', text: delta }),
      ])
    )
  }
}

// ─── Столбцы по дням ─────────────────────────────────────────────────────────

function renderColumns(series, metric, today) {
  const box = document.getElementById('days-chart')
  box.textContent = ''
  const meta = METRICS[metric]
  document.getElementById('days-title').textContent = meta.title
  const total = series.reduce((s, d) => s + d[metric], 0)
  document.getElementById('days-sub').textContent =
    `За период — ${num(Math.round(total * 10) / 10)} ${meta.unit(Math.round(total * 10) / 10)}` +
    (metric === 'devices' ? ' (устройство считается в каждых сутках заново)' : '') +
    '. Сегодня — неполные сутки.'

  const width = Math.max(280, box.clientWidth)
  const height = 240
  const m = { top: 18, right: 4, bottom: 24, left: 40 }
  const plotW = width - m.left - m.right
  const plotH = height - m.top - m.bottom
  const values = series.map((d) => d[metric])
  const ticks = niceTicks(Math.max(1, ...values))
  const top = ticks[ticks.length - 1]
  const band = plotW / series.length
  const barW = Math.max(1, Math.min(24, band - 2))
  const yOf = (v) => m.top + plotH - (v / top) * plotH

  const root = svg('svg', {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    tabindex: 0,
    'aria-label': `${meta.title}: столбцы по дням, стрелками — по одному дню`,
  })

  for (const t of ticks) {
    const y = Math.round(yOf(t)) + 0.5
    root.append(
      svg('line', {
        x1: m.left,
        x2: width - m.right,
        y1: y,
        y2: y,
        stroke: t === 0 ? 'var(--axis)' : 'var(--grid)',
        'stroke-width': 1,
      })
    )
    const label = svg('text', {
      x: m.left - 8,
      y: y + 4,
      'text-anchor': 'end',
      fill: 'var(--muted)',
      'font-size': 11,
      style: 'font-variant-numeric: tabular-nums',
    })
    label.textContent = num(t)
    root.append(label)
  }

  const bars = series.map((d, i) => {
    const v = d[metric]
    const x = m.left + i * band + (band - barW) / 2
    const h = (v / top) * plotH
    const base = m.top + plotH
    const r = Math.min(4, barW / 2, h)
    const path = svg('path', {
      d:
        h <= 0
          ? ''
          : `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`,
      fill: 'var(--series)',
      opacity: d.date === today ? 0.45 : 1,
    })
    root.append(path)
    return path
  })

  // Подпись — только у максимума: остальное в подсказке и таблице.
  const maxIdx = values.indexOf(Math.max(...values))
  if (values[maxIdx] > 0) {
    const cx = m.left + maxIdx * band + band / 2
    const label = svg('text', {
      x: Math.min(width - m.right - 12, Math.max(m.left + 12, cx)),
      y: yOf(values[maxIdx]) - 6,
      'text-anchor': 'middle',
      fill: 'var(--ink-2)',
      'font-size': 11,
      'font-weight': 600,
    })
    label.textContent = num(values[maxIdx])
    root.append(label)
  }

  const every = Math.max(1, Math.ceil(44 / band))
  series.forEach((d, i) => {
    if ((series.length - 1 - i) % every !== 0) return
    const label = svg('text', {
      x: m.left + i * band + band / 2,
      y: height - 6,
      'text-anchor': 'middle',
      fill: 'var(--muted)',
      'font-size': 11,
    })
    label.textContent = shortDate(d.date)
    root.append(label)
  })

  const hit = svg('rect', { x: m.left, y: m.top, width: plotW, height: plotH, fill: 'transparent' })
  root.append(hit)

  let active = -1
  const select = (i, clientX, clientY) => {
    if (active >= 0) bars[active].setAttribute('fill', 'var(--series)')
    active = i
    if (i < 0) return hideTip()
    bars[i].setAttribute('fill', 'var(--series-hover)')
    const d = series[i]
    const v = d[metric]
    const partial = d.date === today ? ', неполные сутки' : ''
    showTip(
      clientX,
      clientY,
      `${num(v)} ${meta.unit(v)}`,
      `${weekdayOf(d.date)}, ${shortDate(d.date)}${partial}`
    )
  }
  root.addEventListener('pointermove', (e) => {
    const rect = root.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - m.left) / band)
    if (i < 0 || i >= series.length) return select(-1)
    select(i, e.clientX, e.clientY)
  })
  root.addEventListener('pointerleave', () => select(-1))
  root.addEventListener('blur', () => select(-1))
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next =
      active < 0
        ? series.length - 1
        : Math.min(series.length - 1, Math.max(0, active + (e.key === 'ArrowRight' ? 1 : -1)))
    const rect = root.getBoundingClientRect()
    const cx = rect.left + m.left + next * band + band / 2
    select(next, cx, rect.top + yOf(series[next][metric]))
  })
  box.append(root)

  const rows = series
    .slice()
    .reverse()
    .map((d) => ({
      partial: d.date === today,
      cells: [
        `${weekdayOf(d.date)}, ${shortDate(d.date)}`,
        int.format(d.devices),
        dec.format(d.hours),
        int.format(d.installs),
      ],
    }))
  const tbl = document.getElementById('days-table')
  tbl.textContent = ''
  tbl.append(table(['День', 'Устройства', 'Часы', 'Новые'], rows, [false, true, true, true]))
}

// ─── Тепловая карта ──────────────────────────────────────────────────────────

function stepOf(v, max) {
  if (v === null) return null
  if (v <= 0 || max <= 0) return 0
  return Math.min(SEQ_STEPS, 1 + Math.floor((v / max) * SEQ_STEPS * 0.9999))
}

function renderHeat(heat) {
  const box = document.getElementById('heat')
  box.textContent = ''
  const max = Math.max(0, ...heat.flat().filter((v) => v !== null))
  const width = Math.max(280, box.clientWidth)
  const left = 28
  const topPad = 18
  const gap = 2
  const cellW = (width - left) / 24
  const cellH = Math.max(14, Math.min(26, cellW))
  const height = topPad + 7 * cellH

  const root = svg('svg', {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    tabindex: 0,
    'aria-label': 'Активность по дням недели и часам, стрелками — по клеткам',
  })
  for (let h = 0; h < 24; h += 3) {
    const t = svg('text', {
      x: left + h * cellW + cellW / 2,
      y: 12,
      'text-anchor': 'middle',
      fill: 'var(--muted)',
      'font-size': 11,
    })
    t.textContent = String(h)
    root.append(t)
  }
  const cells = []
  heat.forEach((row, wd) => {
    const t = svg('text', {
      x: 0,
      y: topPad + wd * cellH + cellH / 2 + 4,
      fill: 'var(--muted)',
      'font-size': 11,
    })
    t.textContent = WEEKDAYS[wd]
    root.append(t)
    cells[wd] = row.map((v, h) => {
      const step = stepOf(v, max)
      const rect = svg('rect', {
        x: left + h * cellW + gap / 2,
        y: topPad + wd * cellH + gap / 2,
        width: Math.max(1, cellW - gap),
        height: Math.max(1, cellH - gap),
        rx: 3,
        fill: step === null ? 'transparent' : `var(--seq-${step})`,
        stroke: step === null ? 'var(--grid)' : 'none',
      })
      root.append(rect)
      return rect
    })
  })

  let active = null
  const select = (wd, h, x, y) => {
    if (active) {
      active.removeAttribute('stroke-width')
      active.setAttribute('stroke', active.dataset.stroke || 'none')
    }
    if (wd === null) {
      active = null
      return hideTip()
    }
    const rect = cells[wd][h]
    rect.dataset.stroke = rect.getAttribute('stroke')
    rect.setAttribute('stroke', 'var(--ink)')
    rect.setAttribute('stroke-width', 1.5)
    active = rect
    const v = heat[wd][h]
    const hours = `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`
    showTip(
      x,
      y,
      v === null ? 'нет данных' : `${num(v)} ${plural(v, 'устройство', 'устройства', 'устройств')}`,
      `${WEEKDAYS[wd]}, ${hours}, в среднем`
    )
  }
  root.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect()
    const h = Math.floor((e.clientX - r.left - left) / cellW)
    const wd = Math.floor((e.clientY - r.top - topPad) / cellH)
    if (h < 0 || h > 23 || wd < 0 || wd > 6) return select(null)
    select(wd, h, e.clientX, e.clientY)
  })
  root.addEventListener('pointerleave', () => select(null))
  root.addEventListener('blur', () => select(null))
  let cursor = [0, 0]
  root.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    if (!moves[e.key]) return
    e.preventDefault()
    const [dw, dh] = moves[e.key]
    cursor = [Math.min(6, Math.max(0, cursor[0] + dw)), Math.min(23, Math.max(0, cursor[1] + dh))]
    const r = root.getBoundingClientRect()
    select(
      cursor[0],
      cursor[1],
      r.left + left + cursor[1] * cellW + cellW / 2,
      r.top + topPad + cursor[0] * cellH
    )
  })
  box.append(root)

  const legend = document.getElementById('heat-legend')
  legend.textContent = ''
  const ramp = el('span', { class: 'ramp' })
  for (let i = 0; i <= SEQ_STEPS; i++)
    ramp.append(el('span', { style: `background: var(--seq-${i})` }))
  legend.append(el('span', { text: '0' }), ramp, el('span', { text: `${num(max)} в среднем` }))

  const rows = []
  for (let h = 0; h < 24; h++) {
    rows.push({
      cells: [
        `${String(h).padStart(2, '0')}:00`,
        ...heat.map((row) => (row[h] === null ? '—' : num(row[h]))),
      ],
    })
  }
  const tbl = document.getElementById('heat-table')
  tbl.textContent = ''
  tbl.append(table(['Час', ...WEEKDAYS], rows, [false, true, true, true, true, true, true, true]))
}

// ─── Таблицы ─────────────────────────────────────────────────────────────────

function fill(id, node) {
  const box = document.getElementById(id)
  box.textContent = ''
  box.append(node)
}

function renderTables(data) {
  fill(
    'weeks',
    table(
      ['Неделя', 'Устройства'],
      data.weeks
        .slice()
        .reverse()
        .map((w) => ({
          partial: w.partial,
          cells: [weekRange(w.week) + (w.partial ? ' (идёт)' : ''), int.format(w.devices)],
        })),
      [false, true]
    )
  )
  fill(
    'months',
    table(
      ['Месяц', 'Устройства'],
      data.months
        .slice()
        .reverse()
        .map((mo) => ({
          partial: mo.partial,
          cells: [monthLabel(mo.month) + (mo.partial ? ' (идёт)' : ''), int.format(mo.devices)],
        })),
      [false, true]
    )
  )
  fill(
    'platforms',
    data.platforms.length
      ? table(
          ['Платформа', 'Сегодня', 'Вчера', 'Часы'],
          data.platforms.map((p) => ({
            cells: [
              PLATFORM_NAMES[p.platform] || p.platform,
              int.format(p.today),
              int.format(p.yesterday),
              dec.format(p.hours),
            ],
          })),
          [false, true, true, true]
        )
      : el('p', { class: 'empty', text: 'Отметок пока нет' })
  )
  fill(
    'versions',
    data.versions.length
      ? table(
          ['Версия', 'Сегодня', 'Вчера'],
          data.versions.map((v) => ({
            cells: [v.version, int.format(v.today), int.format(v.yesterday)],
          })),
          [false, true, true]
        )
      : el('p', { class: 'empty', text: 'За сегодня и вчера отметок нет' })
  )
}

// ─── Загрузка ────────────────────────────────────────────────────────────────

function renderCharts() {
  if (!state.data) return
  renderColumns(state.data.series, state.metric, state.data.today)
  renderHeat(state.data.heat)
}

function render() {
  renderTiles(state.data.tiles)
  renderCharts()
  renderTables(state.data)
}

function markPressed(groupId, attr, value) {
  for (const b of document.querySelectorAll(`#${groupId} button`)) {
    b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value)))
  }
}

async function load() {
  const app = document.getElementById('app')
  const error = document.getElementById('error')
  markPressed('period', 'days', state.days)
  markPressed('metric', 'metric', state.metric)
  app.classList.add('loading')
  try {
    const res = await fetch(`/api/stats?days=${state.days}`, { credentials: 'same-origin' })
    if (res.status === 401) {
      location.reload()
      return
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    state.data = await res.json()
    error.hidden = true
    render()
  } catch (e) {
    error.textContent = `Не удалось загрузить данные: ${e.message}`
    error.hidden = false
  } finally {
    app.classList.remove('loading')
  }
}

document.getElementById('period').addEventListener('click', (e) => {
  const days = Number(e.target.closest('button')?.dataset.days)
  if (!days || days === state.days) return
  state.days = days
  saveDays(days)
  void load()
})

document.getElementById('metric').addEventListener('click', (e) => {
  const metric = e.target.closest('button')?.dataset.metric
  if (!metric || metric === state.metric) return
  state.metric = metric
  markPressed('metric', 'metric', metric)
  if (state.data) renderColumns(state.data.series, metric, state.data.today)
})

let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderCharts, 150)
})

// Данные копятся сами — раз в пять минут подтягиваем свежие.
setInterval(
  () => {
    if (document.visibilityState === 'visible') void load()
  },
  5 * 60 * 1000
)

void load()
