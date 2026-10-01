// Галочки «прочитано» считаются по настоящей комнате matrix-js-sdk: квитанции
// m.read, неявная квитанция автора и порядок событий в ленте — так, как их
// видит SDK, без моков его логики.

import { MatrixEvent, Room } from 'matrix-js-sdk'
import { describe, expect, it } from 'vitest'

import { seenMessageIds, type ReceiptRoom } from './read-receipts'

const ROOM = '!room:matrix.pocketnet.app'
const ME = '@me:matrix.pocketnet.app'
const ANN = '@ann:matrix.pocketnet.app'
const BOB = '@bob:matrix.pocketnet.app'

const client = {
  getUserId: () => ME,
  supportsThreads: () => false,
  isInitialSyncComplete: () => true,
}

const member = (userId: string, ts: number) =>
  new MatrixEvent({
    type: 'm.room.member',
    state_key: userId,
    sender: userId,
    room_id: ROOM,
    event_id: `$member-${userId}`,
    origin_server_ts: ts,
    content: { membership: 'join' },
  })

const message = (id: string, sender: string, ts: number) =>
  new MatrixEvent({
    type: 'm.room.message',
    sender,
    room_id: ROOM,
    event_id: id,
    origin_server_ts: ts,
    content: { msgtype: 'm.text', body: id },
  })

const receipt = (eventId: string, userId: string, ts = 0) =>
  new MatrixEvent({
    type: 'm.receipt',
    room_id: ROOM,
    content: { [eventId]: { 'm.read': { [userId]: { ts } } } },
  })

async function roomWith(members: string[], events: MatrixEvent[]): Promise<Room> {
  const room = new Room(ROOM, client as never, ME)
  await room.addLiveEvents(
    members.map((m, i) => member(m, i + 1)),
    { addToState: true }
  )
  await room.addLiveEvents(events, { addToState: false })
  return room
}

const mine = (m: { senderId: string }) => m.senderId === ME
const list = (events: MatrixEvent[]) =>
  events.map((e) => ({ id: e.getId()!, senderId: e.getSender()! }))
const seen = (room: Room, messages: { id: string; senderId: string }[]) => [
  ...seenMessageIds(room as unknown as ReceiptRoom, ME, messages, mine),
]

describe('seenMessageIds', () => {
  it('квитанция собеседника: прочитано всё своё до неё, после — нет', async () => {
    const events = [message('$1', ME, 100), message('$2', ME, 200), message('$3', ME, 300)]
    const room = await roomWith([ME, ANN], events)
    expect(seen(room, list(events))).toEqual([])

    room.addReceipt(receipt('$2', ANN))
    expect(seen(room, list(events))).toEqual(['$1', '$2'])
  })

  it('время не важно: прочитанное считается по порядку в ленте', async () => {
    // Часы устройства спешат: у моего последнего сообщения время больше, чем у
    // ответа собеседника, хотя в ленте ответ позже. Ответ = неявная квитанция.
    const events = [message('$1', ME, 100), message('$2', ME, 9_999), message('$3', ANN, 300)]
    const room = await roomWith([ME, ANN], events)
    expect(seen(room, list(events))).toEqual(['$1', '$2'])
  })

  it('квитанция на событие, которого нет в загруженной ленте, ничего не отмечает', async () => {
    const events = [message('$1', ME, 100)]
    const room = await roomWith([ME, ANN], events)
    room.addReceipt(receipt('$old', ANN))
    expect(seen(room, list(events))).toEqual([])
  })

  it('в группе хватает одного прочитавшего — до самого позднего', async () => {
    const events = [message('$1', ME, 100), message('$2', ME, 200), message('$3', ME, 300)]
    const room = await roomWith([ME, ANN, BOB], events)
    room.addReceipt(receipt('$1', ANN))
    room.addReceipt(receipt('$2', BOB))
    expect(seen(room, list(events))).toEqual(['$1', '$2'])
  })

  it('своя квитанция не в счёт; копия, не дошедшая до сервера, не прочитана', async () => {
    const events = [message('$1', ME, 100)]
    const room = await roomWith([ME, ANN], events)
    room.addReceipt(receipt('$1', ME))
    expect(seen(room, list(events))).toEqual([])

    room.addReceipt(receipt('$1', ANN))
    const withPending = [...list(events), { id: '~!room:1', senderId: ME }]
    expect(seen(room, withPending)).toEqual(['$1'])
  })
})
