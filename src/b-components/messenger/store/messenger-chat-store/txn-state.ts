// Что известно о транзакции своего сообщения (txnId) — перед повтором.
//
// Повтор неотправленного должен идти с тем же txnId: сервер узнаёт транзакцию
// и возвращает уже созданное событие вместо второго. С новым txnId сообщение,
// которое на деле дошло (оборвался только ответ), появлялось у всех участников
// дважды — и оставалось так навсегда.
//
// Повтор тем же txnId, пока SDK помнит его копию, SDK не примет («known
// txnId») — тогда повторяет сама копия (`resendEvent`). Не помнит (перезапуск
// приложения) — смотрим, не пришло ли событие с этим txnId синком: сервер
// сообщает txnId своему же устройству.

import { getRoomTimelineEvents, type RoomLike } from '../../helpers'
import { matrixService } from '../../services/matrix-service'
import { localEchoId } from './use-local-echo'

export type TxnState =
  /** Сервер событие принял: повторять нечего. */
  | { kind: 'delivered'; eventId: string }
  /** Копия в SDK не ушла: повторить её (тот же txnId) или отменить. */
  | {
      kind: 'unsent'
      resend: () => Promise<{ event_id?: string } | undefined>
      cancel: () => void
    }
  /** Копия ещё в пути (или отменена): вторая отправка дала бы дубль. */
  | { kind: 'pending' }
  /** Ни SDK, ни лента о транзакции не знают: отправить с тем же txnId. */
  | { kind: 'unknown' }

interface TxnEvent {
  status?: string | null
  getId?: () => string
  getUnsigned?: () => { transaction_id?: string } | undefined
}

interface TxnRoom {
  getEventForTxnId?: (txnId: string) => TxnEvent | undefined
  findEventById?: (eventId: string) => TxnEvent | undefined
}

interface TxnClient {
  resendEvent: (event: never, room: never) => Promise<{ event_id?: string } | undefined>
  cancelPendingEvent: (event: never) => void
}

const IN_FLIGHT = new Set(['sending', 'queued', 'encrypting'])

/** txnId из id эхо `~<комната>:<txnId>`; у других id — null. */
export function txnIdOf(chatId: string, messageId: string): string | null {
  const prefix = `~${chatId}:`
  if (!messageId.startsWith(prefix) || messageId.length === prefix.length) return null
  return messageId.slice(prefix.length)
}

const realId = (event: TxnEvent | undefined): string | null => {
  const id = event?.getId?.()
  return typeof id === 'string' && id.startsWith('$') ? id : null
}

export function txnState(chatId: string, txnId: string): TxnState {
  const client = matrixService.getClient() as unknown as TxnClient | null
  const room = matrixService.getRoom(chatId) as unknown as TxnRoom | null
  if (!client || !room) return { kind: 'unknown' }

  const echo = room.getEventForTxnId?.(txnId) ?? room.findEventById?.(localEchoId(chatId, txnId))
  if (echo) {
    if (echo.status === 'not_sent') {
      return {
        kind: 'unsent',
        resend: () => client.resendEvent(echo as never, room as never),
        cancel: () => client.cancelPendingEvent(echo as never),
      }
    }
    const id = realId(echo)
    if (id && !(echo.status && IN_FLIGHT.has(echo.status)))
      return { kind: 'delivered', eventId: id }
    return { kind: 'pending' }
  }

  const arrived = getRoomTimelineEvents(room as unknown as RoomLike).find(
    (e) => (e as TxnEvent).getUnsigned?.()?.transaction_id === txnId
  ) as TxnEvent | undefined
  const id = realId(arrived)
  return id ? { kind: 'delivered', eventId: id } : { kind: 'unknown' }
}
