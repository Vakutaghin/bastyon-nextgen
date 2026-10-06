/**
 * Сведения о приложении для поддержки — обычное текстовое сообщение Matrix.
 * Сервер не трогаем, поэтому формат держится на самом тексте:
 *
 *   Сведения о приложении для поддержки        ← подпись, на языке отправителя
 *   ```bastyon-report 1a2b3c4d 1/2             ← метка, номер отчёта, часть
 *   { …JSON… }
 *   ```
 *
 * Bastyon NextGen рисует такое сообщение окошком с моноширинным текстом и
 * кнопкой копирования, остальные клиенты — блоком кода или просто текстом.
 * Разбор синхронный и идёт при первой же отрисовке: длинный текст на экране
 * не мелькает.
 */

const FENCE_TAG = 'bastyon-report'

/**
 * Предел одного сообщения в байтах UTF-8. Событие Matrix — не больше 64 КБ, а
 * шифрование личного чата раздувает текст примерно в 1,8 раза (AES-SIV в
 * base64, обёрнутый в JSON и ещё раз в base64). Если сообщение пойдёт через
 * Reticulum, у LXMF свой предел — 8000 байт; берём меньший с запасом.
 */
export const MAX_REPORT_MESSAGE_BYTES = 7_800

/** Больше частей не бывает: сведения маленькие, предел — от ошибки в сборе. */
export const MAX_REPORT_PARTS = 9

const REPORT_RE = new RegExp(
  `^[^\\n\`]{0,200}\\n\`\`\`${FENCE_TAG} ([0-9a-f]{8}) (\\d)\\/(\\d)\\n([\\s\\S]+)\\n\`\`\`\\s*$`
)

export interface SupportReportPart {
  /** Номер отчёта: части одного отчёта узнаются по нему. */
  id: string
  part: number
  total: number
  /** Кусок JSON этой части — то, что показывается и копируется. */
  body: string
}

export function parseSupportReport(text: string): SupportReportPart | null {
  if (!text.includes(FENCE_TAG)) return null
  const match = REPORT_RE.exec(text)
  if (!match) return null
  const part = Number(match[2])
  const total = Number(match[3])
  if (part < 1 || part > total) return null
  return { id: match[1]!, part, total, body: match[4]! }
}

const encoder = new TextEncoder()
const bytes = (text: string): number => encoder.encode(text).length

function message(caption: string, id: string, part: number, total: number, body: string): string {
  return `${caption}\n\`\`\`${FENCE_TAG} ${id} ${part}/${total}\n${body}\n\`\`\``
}

/** Строка длиннее предела режется по символам (не посреди суррогатной пары). */
function splitLongLine(line: string, budget: number): string[] {
  const chunks: string[] = []
  let chunk = ''
  for (const ch of line) {
    if (bytes(chunk + ch) > budget) {
      chunks.push(chunk)
      chunk = ''
    }
    chunk += ch
  }
  if (chunk) chunks.push(chunk)
  return chunks
}

/** Режет текст по строкам на куски не больше `budget` байт. */
export function splitByBytes(text: string, budget: number): string[] {
  const parts: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    const pieces = bytes(line) > budget ? splitLongLine(line, budget) : [line]
    for (const piece of pieces) {
      const next = current ? `${current}\n${piece}` : piece
      if (current && bytes(next) > budget) {
        parts.push(current)
        current = piece
      } else {
        current = next
      }
    }
  }
  if (current) parts.push(current)
  return parts
}

function randomId(): string {
  const b = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

/**
 * Сообщения для отправки: одно, а если не влезло в предел — несколько,
 * каждое со своей подписью. `caption(part, total)` — одна строка без «`».
 */
export function buildReportMessages(
  json: string,
  caption: (part: number, total: number) => string,
  id: string = randomId()
): string[] {
  const clean = (part: number, total: number) => caption(part, total).replace(/[\n`]/g, ' ')
  // Запас под самую длинную подпись и номер части.
  const overhead = bytes(message(clean(MAX_REPORT_PARTS, MAX_REPORT_PARTS), id, 9, 9, ''))
  const bodies = splitByBytes(json, MAX_REPORT_MESSAGE_BYTES - overhead)
  if (bodies.length > MAX_REPORT_PARTS) throw new Error('support_report_too_large')
  const total = bodies.length
  return bodies.map((body, i) => message(clean(i + 1, total), id, i + 1, total, body))
}
