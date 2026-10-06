import { describe, expect, it } from 'vitest'

import {
  MAX_REPORT_MESSAGE_BYTES,
  buildReportMessages,
  parseSupportReport,
  splitByBytes,
} from './support-report'

const caption = (part: number, total: number) =>
  total > 1 ? `Сведения для поддержки (${part}/${total})` : 'Сведения для поддержки'
const bytes = (s: string) => new TextEncoder().encode(s).length

describe('сведения для поддержки: формат сообщения', () => {
  it('маленький отчёт — одно сообщение, и чат узнаёт его обратно', () => {
    const json = JSON.stringify({ app: { version: '0.9.5' } }, null, 2)
    const [text, ...rest] = buildReportMessages(json, caption, 'a1b2c3d4')
    expect(rest).toEqual([])
    expect(text).toBe(`Сведения для поддержки\n\`\`\`bastyon-report a1b2c3d4 1/1\n${json}\n\`\`\``)
    expect(parseSupportReport(text!)).toEqual({ id: 'a1b2c3d4', part: 1, total: 1, body: json })
  })

  it('большой отчёт делится на части по строкам, каждая в пределе', () => {
    const errors = Array.from({ length: 120 }, (_, i) => ({ message: `ошибка №${i} `.repeat(8) }))
    const json = JSON.stringify({ errors }, null, 2)
    const messages = buildReportMessages(json, caption, 'deadbeef')
    expect(messages.length).toBeGreaterThan(1)
    const parts = messages.map((m) => parseSupportReport(m)!)
    for (const m of messages) expect(bytes(m)).toBeLessThanOrEqual(MAX_REPORT_MESSAGE_BYTES)
    expect(parts.map((p) => `${p.part}/${p.total}`)).toEqual(
      messages.map((_, i) => `${i + 1}/${messages.length}`)
    )
    expect(parts.map((p) => p.body).join('\n')).toBe(json)
    expect(messages[1]!.startsWith(`Сведения для поддержки (2/${messages.length})\n`)).toBe(true)
  })

  it('строку длиннее предела режет по символам, не ломая эмодзи', () => {
    const line = '😀'.repeat(50)
    const chunks = splitByBytes(line, 30)
    expect(chunks.join('')).toBe(line)
    for (const c of chunks) expect(bytes(c)).toBeLessThanOrEqual(30)
  })

  it('обычные сообщения и подделки не принимает', () => {
    expect(parseSupportReport('привет')).toBeNull()
    expect(parseSupportReport('```bastyon-report a1b2c3d4 1/1\n{}\n```')).toBeNull()
    expect(parseSupportReport('x\n```bastyon-report a1b2c3d4 3/2\n{}\n```')).toBeNull()
    expect(parseSupportReport('x\n```bastyon-report a1b2c3d4 1/1\n{}\n``` и ещё текст')).toBeNull()
    expect(parseSupportReport('x\n```bastyon-report a1b2 1/1\n{}\n```')).toBeNull()
  })

  it('подпись не может сломать формат', () => {
    const [text] = buildReportMessages('{}', () => 'две\nстроки ``` с кавычками', 'a1b2c3d4')
    expect(parseSupportReport(text!)?.body).toBe('{}')
  })
})
