// Сообщение исправили — в открытой ленте оно меняется на месте.

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../services/matrix-service', () => ({ matrixService: {} }))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import type { Message } from '../../types'
import { useMessageEdits } from './use-message-edits'

const ROOM = '!dm:host'
const event = { getId: () => '$2', getRoomId: () => ROOM } as never
const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  chatId: ROOM,
  senderId: '@bob:host',
  text: `текст ${id}`,
  timestamp: 1,
  read: true,
  status: 'sent',
  ...over,
})

function setup(fresh: Message | null, list?: Message[]) {
  const messages: Record<string, Message[]> = list ? { [ROOM]: list } : {}
  const mapEventToMessage = vi.fn(async () => fresh)
  const { applyEdit } = useMessageEdits({ messages } as never, { mapEventToMessage } as never)
  return { messages, mapEventToMessage, applyEdit }
}

describe('applyEdit', () => {
  it('меняет текст на месте, статус и реакции прежние', async () => {
    const reactions = [{ key: '👍', count: 1 }]
    const { messages, applyEdit } = setup(msg('$2', { text: 'новое', editedAt: 5 }), [
      msg('$1'),
      msg('$2', { status: 'read', reactions }),
      msg('$3'),
    ])
    await applyEdit(event)
    expect(messages[ROOM]!.map((m) => m.text)).toEqual(['текст $1', 'новое', 'текст $3'])
    expect(messages[ROOM]![1]).toMatchObject({ status: 'read', reactions, editedAt: 5 })
  })

  it('чат не открыт или сообщения в ленте нет — ничего не разбирает', async () => {
    const closed = setup(msg('$2'))
    await closed.applyEdit(event)
    const other = setup(msg('$2'), [msg('$1')])
    await other.applyEdit(event)
    expect(closed.mapEventToMessage).not.toHaveBeenCalled()
    expect(other.mapEventToMessage).not.toHaveBeenCalled()
  })

  it('пока разбирали, сообщение удалили — отметка «удалено» остаётся', async () => {
    const list = [msg('$2')]
    const { messages, mapEventToMessage, applyEdit } = setup(null, list)
    mapEventToMessage.mockImplementationOnce(async () => {
      messages[ROOM]![0]!.deleted = { by: '@bob:host', at: 9 }
      return msg('$2', { text: 'новое' })
    })
    await applyEdit(event)
    expect(messages[ROOM]![0]).toMatchObject({ deleted: { by: '@bob:host' }, text: 'текст $2' })
  })
})
