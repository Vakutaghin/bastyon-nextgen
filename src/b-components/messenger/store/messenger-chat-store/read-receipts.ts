/**
 * Галочки на своих сообщениях Matrix: «✓✓» — сообщение прочитано. В личном
 * чате — собеседником, в группе — хотя бы одним участником, как в Telegram.
 *
 * Прочитанное берём из квитанций `m.read`: публичных, приватных и неявных
 * (кто написал сообщение, тот прочитал всё до него). Сравниваем порядок
 * событий в ленте, а не время: у только что отправленного сообщения время с
 * часов этого устройства, и спешащие часы прятали бы галочку навсегда.
 */

interface ReceiptEvent {
  getId(): string | undefined | null
  getTs(): number
}

/** То, что нужно от комнаты matrix-js-sdk. */
export interface ReceiptRoom {
  getJoinedMembers(): ReadonlyArray<{ userId: string }>
  /** До какого события пользователь прочитал; null — квитанции нет или событие не загружено. */
  getEventReadUpTo(userId: string): string | null
  findEventById(eventId: string): ReceiptEvent | undefined
  getUnfilteredTimelineSet(): {
    compareEventOrdering(eventId1: string, eventId2: string): number | null
  }
}

interface ReceiptMessage {
  id: string
  senderId: string
}

const NONE: ReadonlySet<string> = new Set()

/** `a` в ленте позже `b`. События из разных кусков ленты — по времени сервера. */
function isAfter(room: ReceiptRoom, a: ReceiptEvent, b: ReceiptEvent): boolean {
  const aId = a.getId()
  const bId = b.getId()
  if (aId && bId) {
    const order = room.getUnfilteredTimelineSet().compareEventOrdering(aId, bId)
    if (typeof order === 'number') return order > 0
  }
  return a.getTs() > b.getTs()
}

/** Самое позднее событие, до которого дочитал кто-то, кроме меня. */
function latestReadByOthers(room: ReceiptRoom, myUserId: string): ReceiptEvent | null {
  let latest: ReceiptEvent | null = null
  for (const { userId } of room.getJoinedMembers()) {
    if (!userId || userId === myUserId) continue
    const eventId = room.getEventReadUpTo(userId)
    const event = eventId ? room.findEventById(eventId) : undefined
    if (event && (!latest || isAfter(room, event, latest))) latest = event
  }
  return latest
}

/**
 * Id своих сообщений, которые кто-то уже прочитал. Сообщения, ещё не
 * дошедшие до сервера (id `~…`), прочитанными не бывают.
 */
export function seenMessageIds(
  room: ReceiptRoom,
  myUserId: string,
  messages: readonly ReceiptMessage[],
  isMine: (message: ReceiptMessage) => boolean
): ReadonlySet<string> {
  const latest = latestReadByOthers(room, myUserId)
  if (!latest) return NONE
  const seen = new Set<string>()
  for (const message of messages) {
    if (!message.id.startsWith('$') || !isMine(message)) continue
    const event = room.findEventById(message.id)
    if (event && !isAfter(room, event, latest)) seen.add(message.id)
  }
  return seen
}
