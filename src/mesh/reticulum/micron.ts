/**
 * Micron — разметка страниц NomadNet (узлы `nomadnetwork.node`). Разбор
 * повторяет NomadNet (nomadnet/ui/textui/MicronParser.py): строки, заголовки
 * `>`, разделители `-`, комментарии `#`, литеральные блоки `` `= ``, внутри
 * строки — команды после обратной кавычки: `` `! `` жирный, `` `* `` курсив,
 * `` `_ `` подчёркнутый, `` `Fabc ``/`` `Babc `` цвет текста и фона (`` `FT…``
 * — 6 цифр), `` `f ``/`` `b `` сброс цвета, `` `c ``/`` `l ``/`` `r ``/`` `a ``
 * выравнивание, ` `` ` сброс всего, `` `[подпись`адрес`поля] `` ссылка,
 * `` `<флаги|имя`значение> `` поле формы.
 *
 * Результат — данные, а не HTML: страница с чужого узла никогда не попадает
 * в разметку как есть. Цвета — только hex-цифры.
 *
 * Не поддерживаются таблицы (строки идут как текст), вставки `` `{ ``,
 * картинки `` `( `` и сворачивание заголовков.
 */

export interface MicronStyle {
  bold: boolean
  italic: boolean
  underline: boolean
  /** Цвет `#rrggbb` или null — цвет страницы. */
  fg: string | null
  bg: string | null
}

export type MicronPart =
  | { kind: 'text'; text: string; style: MicronStyle }
  | {
      kind: 'link'
      text: string
      /** Адрес как в разметке: `:/page/x.mu`, `хэш:/page/x.mu`, `lxmf@хэш`. */
      url: string
      /** Какие поля формы отправить со ссылкой (`*` — все) и `имя=значение`. */
      fields: string[]
      style: MicronStyle
    }
  | {
      kind: 'field'
      name: string
      value: string
      /** Ширина в символах. */
      width: number
      masked: boolean
      style: MicronStyle
    }
  | {
      kind: 'check'
      radio: boolean
      name: string
      value: string
      label: string
      checked: boolean
      style: MicronStyle
    }

export type MicronAlign = 'left' | 'center' | 'right'

export type MicronLine =
  | {
      kind: 'text'
      parts: MicronPart[]
      align: MicronAlign
      /** Уровень раздела: отступ содержимого. */
      depth: number
      /** 1–3 — заголовок этого уровня, 0 — обычная строка. */
      heading: number
      /** Литеральный блок: показывать как есть, моноширинно. */
      literal: boolean
    }
  | { kind: 'divider'; char: string; depth: number }
  | { kind: 'blank' }

/** Путь страницы по умолчанию, как у NomadNet. */
export const DEFAULT_PAGE = '/page/index.mu'

interface State {
  literal: boolean
  depth: number
  style: MicronStyle
  align: MicronAlign
}

const PLAIN: MicronStyle = { bold: false, italic: false, underline: false, fg: null, bg: null }
const HEX = /^[0-9a-f]+$/i

/** `abc` → `#aabbcc`, `a1b2c3` → `#a1b2c3`; иначе null. */
function color(code: string): string | null {
  if (!HEX.test(code)) return null
  if (code.length === 3) {
    return `#${code
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  }
  return code.length === 6 ? `#${code.toLowerCase()}` : null
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g

/** Разобрать страницу. */
export function parseMicron(source: string): MicronLine[] {
  const state: State = { literal: false, depth: 0, style: { ...PLAIN }, align: 'left' }
  const lines: MicronLine[] = []
  for (const raw of source.replace(CONTROL, '').replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.length === 0) {
      lines.push({ kind: 'blank' })
      continue
    }
    const line = parseLine(raw, state)
    if (line) lines.push(line)
  }
  return lines
}

function parseLine(input: string, state: State): MicronLine | null {
  let line = input
  if (line === '`=') {
    state.literal = !state.literal
    return null
  }
  if (state.literal) {
    return textLine([text(line === '\\`=' ? '`=' : line, state)], state, 0, true)
  }
  let preEscape = false
  // Сворачиваемый заголовок `+> / `-> — показываем как обычный.
  if ((line.startsWith('`+') || line.startsWith('`-')) && line[2] === '>') line = line.slice(2)
  // В заголовке полей формы не бывает.
  if (line[0] === '>' && line.includes('`<')) line = line.replace(/^>+/, '')
  if (line.length === 0) return null
  const first = line[0]
  if (first === '\\') {
    line = line.slice(1)
    preEscape = true
  } else if (first === '#') {
    return null
  } else if (line.startsWith('`t') || line.startsWith('`{') || line.startsWith('`(')) {
    return null
  } else if (first === '<') {
    state.depth = 0
    return line.length > 1 ? parseLine(line.slice(1), state) : null
  } else if (first === '>') {
    let level = 0
    while (level < line.length && line[level] === '>') level++
    state.depth = level
    const rest = line.slice(level)
    if (rest.length === 0) return null
    // Стиль заголовка — только на эту строку.
    const saved = { ...state.style }
    const parts = inline(rest, state, false)
    state.style = saved
    return parts.length > 0 ? textLine(parts, state, Math.min(level, 3), false) : null
  } else if (first === '-') {
    const char = line.length === 2 && line.charCodeAt(1) >= 32 ? line[1]! : '─'
    return { kind: 'divider', char, depth: state.depth }
  }
  const parts = inline(line, state, preEscape)
  return parts.length > 0 ? textLine(parts, state, 0, false) : null
}

function textLine(
  parts: MicronPart[],
  state: State,
  heading: number,
  literal: boolean
): MicronLine {
  return { kind: 'text', parts, align: state.align, depth: state.depth, heading, literal }
}

function text(value: string, state: State): MicronPart {
  return { kind: 'text', text: value, style: { ...state.style } }
}

/** Разбор строки: текст и команды после обратной кавычки. */
function inline(line: string, state: State, preEscape: boolean): MicronPart[] {
  const out: MicronPart[] = []
  let part = ''
  let escape = preEscape
  const flush = () => {
    if (part.length > 0) out.push(text(part, state))
    part = ''
  }
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (c === '\\') {
      if (escape) {
        part += c
        escape = false
      } else {
        escape = true
      }
      continue
    }
    if (c !== '`' || escape) {
      part += c
      escape = false
      continue
    }
    // Команда.
    flush()
    const cmd = line[i + 1]
    if (cmd === undefined) break
    i++
    switch (cmd) {
      case '!':
        state.style.bold = !state.style.bold
        break
      case '*':
        state.style.italic = !state.style.italic
        break
      case '_':
        state.style.underline = !state.style.underline
        break
      case 'F':
      case 'B': {
        const wide = line[i + 1] === 'T'
        const code = wide ? line.slice(i + 2, i + 8) : line.slice(i + 1, i + 4)
        if (code.length === (wide ? 6 : 3)) {
          const value = color(code)
          if (cmd === 'F') state.style.fg = value
          else state.style.bg = value
          i += wide ? 7 : 3
        }
        break
      }
      case 'f':
        state.style.fg = null
        break
      case 'b':
        state.style.bg = null
        break
      case '`':
        state.style = { ...PLAIN }
        state.align = 'left'
        break
      case 'c':
        state.align = 'center'
        break
      case 'l':
      case 'a':
        state.align = 'left'
        break
      case 'r':
        state.align = 'right'
        break
      case ':': {
        // Якорь: имя из букв, цифр, `_` и `-`.
        let end = i + 1
        while (end < line.length && /[\w-]/.test(line[end]!)) end++
        i = end - 1
        break
      }
      case '<': {
        const parsed = field(line, i + 1, state)
        if (parsed) {
          out.push(parsed.part)
          i = parsed.end
        }
        break
      }
      case '[': {
        const parsed = link(line, i + 1, state)
        if (parsed) {
          if (parsed.part) out.push(parsed.part)
          i = parsed.end
        }
        break
      }
      default:
        break
    }
  }
  flush()
  return out
}

/** `` `<флаги|имя|значение|*`данные> `` — с позиции после `<`. */
function field(
  line: string,
  start: number,
  state: State
): { part: MicronPart; end: number } | null {
  const tick = line.indexOf('`', start)
  if (tick === -1) return null
  const close = line.indexOf('>', tick)
  if (close === -1) return null
  const spec = line.slice(start, tick)
  const data = line.slice(tick + 1, close)
  const style = { ...state.style }
  if (!spec.includes('|')) {
    return {
      part: { kind: 'field', name: spec, value: data, width: 24, masked: false, style },
      end: close,
    }
  }
  const [rawFlags = '', name = '', value = '', mark = ''] = spec.split('|')
  let flags = rawFlags
  let kind: 'field' | 'checkbox' | 'radio' = 'field'
  let masked = false
  if (flags.includes('^')) {
    kind = 'radio'
    flags = flags.replace(/\^/g, '')
  } else if (flags.includes('?')) {
    kind = 'checkbox'
    flags = flags.replace(/\?/g, '')
  } else if (flags.includes('!')) {
    masked = true
    flags = flags.replace(/!/g, '')
  }
  if (kind !== 'field') {
    return {
      part: {
        kind: 'check',
        radio: kind === 'radio',
        name,
        value: value || data,
        label: data,
        checked: mark === '*',
        style,
      },
      end: close,
    }
  }
  const width = Number.parseInt(flags.split('x')[0] ?? '', 10)
  return {
    part: {
      kind: 'field',
      name,
      value: data,
      width: Number.isFinite(width) && width > 0 ? Math.min(width, 256) : 24,
      masked,
      style,
    },
    end: close,
  }
}

/** `` `[подпись`адрес`поля] `` — с позиции после `[`. */
function link(
  line: string,
  start: number,
  state: State
): { part: MicronPart | null; end: number } | null {
  const close = line.indexOf(']', start)
  if (close === -1) return null
  const pieces = line.slice(start, close).split('`')
  let label = ''
  let url = ''
  let fields = ''
  if (pieces.length === 1) url = pieces[0]!
  else if (pieces.length === 2) [label, url] = pieces as [string, string]
  else if (pieces.length === 3) [label, url, fields] = pieces as [string, string, string]
  if (url.length === 0) return { part: null, end: close }
  return {
    part: {
      kind: 'link',
      text: label || url,
      url,
      fields: fields ? fields.split('|').filter(Boolean) : [],
      style: { ...state.style },
    },
    end: close,
  }
}

export type MicronTarget =
  | { kind: 'page'; node: string; path: string }
  | { kind: 'lxmf'; address: string }
  | { kind: 'anchor'; name: string }

/**
 * Куда ведёт ссылка со страницы узла `current`: страница (этого или другого
 * узла), чат LXMF или якорь. null — адрес не понят (или вид ссылки, который
 * здесь не открыть).
 */
export function resolveMicronUrl(url: string, current: string | null): MicronTarget | null {
  const target = url.trim()
  if (target.startsWith('#')) return { kind: 'anchor', name: target.slice(1) }
  let type: string | null = null
  let rest = target
  const at = target.split('@')
  if (at.length === 2) {
    type = at[0]!.toLowerCase()
    rest = at[1]!
  }
  if (type === 'lxmf' || type === 'lxmf.delivery') {
    const address = rest.split(':')[0]!.toLowerCase()
    return /^[0-9a-f]{32}$/.test(address) ? { kind: 'lxmf', address } : null
  }
  if (type !== null && type !== 'nnn' && type !== 'nomadnetwork.node') return null
  const pieces = rest.split(':')
  if (pieces.length === 1) {
    const node = pieces[0]!.toLowerCase()
    return /^[0-9a-f]{32}$/.test(node) ? { kind: 'page', node, path: DEFAULT_PAGE } : null
  }
  if (pieces.length !== 2) return null
  const [host, path] = pieces as [string, string]
  let node: string | null
  if (host.length === 0) node = current
  else node = /^[0-9a-f]{32}$/i.test(host) ? host.toLowerCase() : null
  if (!node) return null
  return { kind: 'page', node, path: path || DEFAULT_PAGE }
}

/** Значения полей формы на странице: имя → текст (у флажков — значения через запятую). */
export type MicronForm = Record<string, string>

/**
 * Данные запроса для ссылки с полями: `field_имя` — значения полей (все при
 * `*`), `var_имя` — из `имя=значение`. Как NomadNet (Browser.handle_link).
 */
export function micronRequestData(fields: string[], form: MicronForm): Record<string, string> {
  const data: Record<string, string> = {}
  const all = fields.includes('*')
  const wanted = new Set<string>()
  for (const f of fields) {
    if (f.includes('=')) {
      const eq = f.split('=')
      if (eq.length === 2) data[`var_${eq[0]}`] = eq[1]!
    } else if (f !== '*') {
      wanted.add(f)
    }
  }
  for (const [name, value] of Object.entries(form)) {
    if (all || wanted.has(name)) data[`field_${name}`] = value
  }
  return data
}

/** Начальные значения полей страницы (текст, отмеченные флажки и переключатели). */
export function micronDefaults(lines: MicronLine[]): MicronForm {
  const form: MicronForm = {}
  for (const line of lines) {
    if (line.kind !== 'text') continue
    for (const p of line.parts) {
      if (p.kind === 'field') form[p.name] = p.value
      else if (p.kind === 'check' && p.checked) {
        form[p.name] = p.radio || !form[p.name] ? p.value : `${form[p.name]},${p.value}`
      }
    }
  }
  return form
}

type CheckPart = Extract<MicronPart, { kind: 'check' }>

/** Отмечен ли флажок или переключатель. */
export function isMicronChecked(form: MicronForm, p: CheckPart): boolean {
  const current = form[p.name]
  if (current === undefined || current === '') return false
  return p.radio ? current === p.value : current.split(',').includes(p.value)
}

/** Отметить или снять флажок (у флажков значения копятся через запятую). */
export function setMicronChecked(form: MicronForm, p: CheckPart, on: boolean): void {
  if (p.radio) {
    if (on) form[p.name] = p.value
    return
  }
  const values = (form[p.name] ?? '').split(',').filter((v) => v && v !== p.value)
  if (on) values.push(p.value)
  form[p.name] = values.join(',')
}
