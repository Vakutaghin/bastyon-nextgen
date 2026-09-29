// Разбор micron (страницы NomadNet) — на примерах из NomadNet: заголовки и
// разделы, форматирование и цвета, ссылки всех видов, поля форм и данные
// запроса, литеральные блоки, экранирование.

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE,
  isMicronChecked,
  micronDefaults,
  micronRequestData,
  parseMicron,
  resolveMicronUrl,
  setMicronChecked,
  type MicronLine,
  type MicronPart,
} from './micron'

function textOf(line: MicronLine | undefined): string {
  if (!line || line.kind !== 'text') return ''
  return line.parts.map((p) => ('text' in p ? p.text : p.kind === 'check' ? p.label : '')).join('')
}

function parts(line: MicronLine | undefined): MicronPart[] {
  return line && line.kind === 'text' ? line.parts : []
}

const NODE = 'aa'.repeat(16)
const OTHER = 'bb'.repeat(16)

describe('parseMicron', () => {
  it('sections, headings, dividers, comments and blank lines', () => {
    const lines = parseMicron('#!c=0\n>Welcome\ntext in section\n>>Sub\n-\n-=\n\n<back to top')
    expect(lines.map((l) => l.kind)).toEqual([
      'text',
      'text',
      'text',
      'divider',
      'divider',
      'blank',
      'text',
    ])
    expect(lines[0]).toMatchObject({ heading: 1, depth: 1 })
    expect(textOf(lines[0])).toBe('Welcome')
    expect(lines[1]).toMatchObject({ heading: 0, depth: 1 })
    expect(lines[2]).toMatchObject({ heading: 2, depth: 2 })
    expect(lines[3]).toEqual({ kind: 'divider', char: '─', depth: 2 })
    expect(lines[4]).toEqual({ kind: 'divider', char: '=', depth: 2 })
    expect(lines[6]).toMatchObject({ depth: 0 })
    expect(textOf(lines[6])).toBe('back to top')
  })

  it('formatting toggles, colors and reset', () => {
    const [line] = parseMicron('`!bold`! `*it`_u`_`* `Ff00red`f `BT00ff00bg`b ``plain')
    const p = parts(line)
    expect(p[0]).toMatchObject({ text: 'bold', style: { bold: true } })
    expect(p[2]).toMatchObject({ text: 'it', style: { italic: true, underline: false } })
    expect(p[3]).toMatchObject({ text: 'u', style: { italic: true, underline: true } })
    expect(p.find((x) => 'text' in x && x.text === 'red')).toMatchObject({
      style: { fg: '#ff0000' },
    })
    expect(p.find((x) => 'text' in x && x.text === 'bg')).toMatchObject({
      style: { bg: '#00ff00', fg: null },
    })
    expect(p[p.length - 1]).toMatchObject({
      text: 'plain',
      style: { bold: false, italic: false, fg: null, bg: null },
    })
  })

  it('never lets markup through as css: only hex colors', () => {
    const [line] = parseMicron('`Fz;}x`Bred')
    for (const p of parts(line)) {
      expect(p.style.fg).toBeNull()
      expect(p.style.bg).toBeNull()
    }
  })

  it('alignment applies to the line', () => {
    const lines = parseMicron('`cCentered\n`rRight\n`aBack')
    expect(lines.map((l) => (l.kind === 'text' ? l.align : null))).toEqual([
      'center',
      'right',
      'left',
    ])
  })

  it('links: local, other node, with fields, bare url, lxmf', () => {
    const [line] = parseMicron(
      `\`[Home\`:/page/index.mu] \`[Other\`${OTHER}:/page/a.mu] \`[Send\`:/page/f.mu\`name|*|x=1] \`[${OTHER}] \`[Chat\`lxmf@${OTHER}]`
    )
    const links = parts(line).filter((p) => p.kind === 'link')
    expect(links).toMatchObject([
      { text: 'Home', url: ':/page/index.mu', fields: [] },
      { text: 'Other', url: `${OTHER}:/page/a.mu` },
      { text: 'Send', url: ':/page/f.mu', fields: ['name', '*', 'x=1'] },
      { text: OTHER, url: OTHER },
      { text: 'Chat', url: `lxmf@${OTHER}` },
    ])
  })

  it('form fields, checkboxes and radios', () => {
    const lines = parseMicron(
      'Name: `<name`Alice>\nPass: `<!12|pass`>\n`<?|opt|a|*`Option A> `<?|opt|b`Option B>\n`<^|size|s`Small> `<^|size|l|*`Large>'
    )
    expect(parts(lines[0])[1]).toMatchObject({
      kind: 'field',
      name: 'name',
      value: 'Alice',
      width: 24,
      masked: false,
    })
    expect(parts(lines[1])[1]).toMatchObject({
      kind: 'field',
      name: 'pass',
      width: 12,
      masked: true,
    })
    expect(parts(lines[2])[0]).toMatchObject({
      kind: 'check',
      radio: false,
      name: 'opt',
      value: 'a',
      label: 'Option A',
      checked: true,
    })
    expect(parts(lines[3])[2]).toMatchObject({
      kind: 'check',
      radio: true,
      value: 'l',
      checked: true,
    })
    expect(micronDefaults(lines)).toEqual({ name: 'Alice', pass: '', opt: 'a', size: 'l' })
  })

  it('literal blocks and escapes', () => {
    const lines = parseMicron('`=\n`!not bold`!\n#not a comment\n\\`=\n`=\n\\# shown\nprice \\`5')
    expect(lines[0]).toMatchObject({ literal: true })
    expect(textOf(lines[0])).toBe('`!not bold`!')
    expect(textOf(lines[1])).toBe('#not a comment')
    expect(textOf(lines[2])).toBe('`=')
    expect(textOf(lines[3])).toBe('# shown')
    expect(textOf(lines[4])).toBe('price `5')
  })

  it('a heading with a form field is a plain line', () => {
    const [line] = parseMicron('>Search `<q`>')
    expect(line).toMatchObject({ heading: 0 })
  })
})

describe('resolveMicronUrl', () => {
  it('pages on this and other nodes', () => {
    expect(resolveMicronUrl(':/page/a.mu', NODE)).toEqual({
      kind: 'page',
      node: NODE,
      path: '/page/a.mu',
    })
    expect(resolveMicronUrl(`${OTHER.toUpperCase()}:/page/b.mu`, NODE)).toEqual({
      kind: 'page',
      node: OTHER,
      path: '/page/b.mu',
    })
    expect(resolveMicronUrl(OTHER, NODE)).toEqual({ kind: 'page', node: OTHER, path: DEFAULT_PAGE })
    expect(resolveMicronUrl(`nnn@${OTHER}:/page/c.mu`, NODE)).toMatchObject({ node: OTHER })
  })

  it('chats, anchors and what cannot be opened', () => {
    expect(resolveMicronUrl(`lxmf@${OTHER}`, NODE)).toEqual({ kind: 'lxmf', address: OTHER })
    expect(resolveMicronUrl('#top', NODE)).toEqual({ kind: 'anchor', name: 'top' })
    expect(resolveMicronUrl(':/page/a.mu', null)).toBeNull()
    expect(resolveMicronUrl('https://example.org', NODE)).toBeNull()
    expect(resolveMicronUrl('rrc@xyz', NODE)).toBeNull()
  })
})

describe('form data', () => {
  it('sends chosen fields and variables like NomadNet', () => {
    const form = { name: 'Bob', pass: 'x', opt: 'a,b' }
    expect(micronRequestData(['name', 'q=1', 'bad=a=b'], form)).toEqual({
      field_name: 'Bob',
      var_q: '1',
    })
    expect(micronRequestData(['*'], form)).toEqual({
      field_name: 'Bob',
      field_pass: 'x',
      field_opt: 'a,b',
    })
  })

  it('checkboxes collect values, radios keep one', () => {
    const form: Record<string, string> = {}
    const a = { kind: 'check', radio: false, name: 'opt', value: 'a', label: 'A', checked: false }
    const b = { ...a, value: 'b', label: 'B' }
    const style = { bold: false, italic: false, underline: false, fg: null, bg: null }
    setMicronChecked(form, { ...a, style } as never, true)
    setMicronChecked(form, { ...b, style } as never, true)
    expect(form.opt).toBe('a,b')
    setMicronChecked(form, { ...a, style } as never, false)
    expect(form.opt).toBe('b')
    const small = { ...a, radio: true, name: 'size', value: 's', style } as never
    const large = { ...a, radio: true, name: 'size', value: 'l', style } as never
    setMicronChecked(form, small, true)
    setMicronChecked(form, large, true)
    expect(isMicronChecked(form, small)).toBe(false)
    expect(isMicronChecked(form, large)).toBe(true)
  })
})
