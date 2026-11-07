/**
 * Жалоба на содержимое мини-приложения (объявление Barteron и т. п.) — туда же,
 * куда её отправлял прежний клиент (`components/complain`, `miniapp_entity`):
 * одна запись `MINIAPP_COMPLAIN` на сервер команды Pocketnet
 * (`metrix.pocketnet.app/front/action/v2`). Других каналов модерации у
 * мини-приложений нет.
 *
 * В записи — что за содержимое (ссылка, txid, тип), причина, время, версия
 * приложения, случайный id и язык. Адреса пользователя в ней нет, как и у
 * прежнего клиента. Отправляется только по кнопке «Отправить» в окне жалобы.
 */

/** Причины — как у прежнего клиента (`reasonIds`): сервер ждёт эти строки. */
export const COMPLAINT_REASONS = {
  1: 'Erotic/Porn',
  2: 'Child exploitation',
  3: 'Direct threat of violence',
  4: 'Illegal narcotics',
  5: 'Copyrighted content',
  6: 'Spam',
} as const

export type ComplaintReasonId = keyof typeof COMPLAINT_REASONS

export const COMPLAINT_ENDPOINT = 'https://metrix.pocketnet.app/front/action/v2'

export interface ComplaintEntity {
  link: string
  txid: string
  type: string
}

export interface ComplaintInput {
  entity: ComplaintEntity
  reason: ComplaintReasonId
  language: string
  appVersion: string
}

export interface ComplaintDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  now?: () => Date
  randomId?: () => string
}

/** Из запроса приложения: что поддаётся проверке; иначе null. */
export function complaintEntity(data: unknown): ComplaintEntity | null {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const link = typeof d.entityLink === 'string' ? d.entityLink.trim() : ''
  const txid = typeof d.entityTxid === 'string' ? d.entityTxid.trim() : ''
  const type = typeof d.entityType === 'string' ? d.entityType.trim() : ''
  if (!link && !txid) return null
  if (link.length > 512 || txid.length > 128 || type.length > 32) return null
  return { link, txid, type }
}

/**
 * Значение записи — в одинарных кавычках, через запятую, как у прежнего
 * клиента (`_createLogBody`); кавычки, обратную косую и переводы строк внутри
 * значений убираем, иначе запись сломается.
 */
// eslint-disable-next-line no-control-regex
const clean = (value: string): string => value.replace(/['\\\u0000-\u001f]/g, '')
const quote = (value: string): string => `'${clean(value)}'`

const pad = (n: number): string => String(n).padStart(2, '0')
const stamp = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

const defaultRandomId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')

export function complaintRecord(input: ComplaintInput, now: Date, id: string): string {
  // Чистим до JSON: иначе перевод строки стал бы `\n`, и после чистки записи
  // от него осталась бы буква.
  const subType = JSON.stringify({
    link: clean(input.entity.link),
    txid: clean(input.entity.txid),
    type: clean(input.entity.type),
  })
  return `(${[
    'MINIAPP_COMPLAIN',
    subType,
    COMPLAINT_REASONS[input.reason],
    stamp(now),
    '0.0.1',
    `Bastyon NextGen ${input.appVersion}`,
    id,
    input.language,
  ]
    .map(quote)
    .join(',')})`
}

export class ComplaintNotSentError extends Error {
  constructor(cause: unknown) {
    super('complain:notsent', { cause })
    this.name = 'ComplaintNotSentError'
  }
}

export async function sendMiniAppComplaint(
  input: ComplaintInput,
  deps: ComplaintDeps
): Promise<void> {
  const body = complaintRecord(
    input,
    (deps.now ?? (() => new Date()))(),
    (deps.randomId ?? defaultRandomId)()
  )
  try {
    const res = await deps.fetch(COMPLAINT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`http_${res.status}`)
  } catch (e) {
    throw new ComplaintNotSentError(e)
  }
}
