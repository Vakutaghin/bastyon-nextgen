// Отметка у своего сообщения: Matrix — «…», «✓» и «✓✓» (прочитано);
// mesh — путь по эфиру, как раньше.

import { describe, expect, it } from 'vitest'

import { deliveryMark, type DeliveryMarkInput } from './delivery-mark'

const t = (key: string) => key
const matrix = (over: Partial<DeliveryMarkInput>): DeliveryMarkInput => ({
  status: 'sent',
  transport: undefined,
  mine: true,
  seen: false,
  mesh: false,
  meshKind: null,
  ...over,
})

describe('deliveryMark', () => {
  it('Matrix: отправляется, дошло до сервера, прочитано', () => {
    expect(deliveryMark(matrix({ status: 'sending' }), t)).toEqual({
      mark: '…',
      title: 'messenger.markSending',
      done: false,
    })
    expect(deliveryMark(matrix({}), t)).toEqual({
      mark: '✓',
      title: 'messenger.markSent',
      done: false,
    })
    expect(deliveryMark(matrix({ seen: true }), t)).toEqual({
      mark: '✓✓',
      title: 'messenger.seen',
      done: true,
    })
  })

  it('чужое и не отправленное — без отметки', () => {
    expect(deliveryMark(matrix({ mine: false, seen: true }), t)).toBeNull()
    expect(deliveryMark(matrix({ status: 'failed' }), t)).toBeNull()
  })

  it('mesh: прочтений нет, «✓✓» — подтвердило радио; маршрут в диалоге Bastyon — тоже mesh', () => {
    const lxmf = matrix({ mesh: true, transport: 'lxmf', seen: true })
    expect(deliveryMark(lxmf, t)).toMatchObject({ mark: '✓', title: 'mesh.chat.lxmfSent' })
    expect(deliveryMark({ ...lxmf, status: 'delivered' }, t)).toEqual({
      mark: '✓✓',
      title: 'mesh.chat.lxmfDelivered',
      done: true,
    })
    const channel = matrix({ mesh: true, transport: 'meshtastic', meshKind: 'channel' })
    expect(deliveryMark({ ...channel, status: 'delivered' }, t)?.title).toBe('mesh.chat.relayed')
  })
})
