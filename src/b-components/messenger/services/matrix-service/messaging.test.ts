// Что уходит в Matrix при отправке: открытый текст, групповое и личное
// зашифрованное сообщение (формат bastyon-chat), удаление, state-событие и
// реакция; ошибка SDK доходит до вызывающего и не превращается в открытый текст.

import { describe, expect, it, vi } from 'vitest'

import {
  redactEvent,
  sendEncryptedDirectMessage,
  sendEncryptedTextMessage,
  sendMessage,
  sendReaction,
  sendStateEvent,
} from './messaging'
import type { MatrixClient } from './types'

const ROOM = '!room:matrix.pocketnet.app'
const REPLY = { 'm.relates_to': { 'm.in_reply_to': { event_id: '$orig' } } }

function fakeClient() {
  return {
    sendEvent: vi.fn(async (..._args: unknown[]) => ({ event_id: '$sent' })),
    sendStateEvent: vi.fn(async (..._args: unknown[]) => ({ event_id: '$state' })),
    redactEvent: vi.fn(async (..._args: unknown[]) => ({ event_id: '$redaction' })),
    uploadContent: vi.fn(),
  }
}

const asClient = (c: ReturnType<typeof fakeClient>) => c as unknown as MatrixClient

describe('sendMessage — открытый текст (публичные и большие группы)', () => {
  it('уходит m.room.message/m.text с телом, ответом и txnId эхо; вызывающий получает id события', async () => {
    const client = fakeClient()
    const res = await sendMessage(asClient(client), ROOM, 'Всем привет', REPLY, 'm1.1')

    expect(res).toEqual({ event_id: '$sent' })
    expect(client.sendEvent).toHaveBeenCalledTimes(1)
    expect(client.sendEvent).toHaveBeenCalledWith(
      ROOM,
      'm.room.message',
      { msgtype: 'm.text', body: 'Всем привет', ...REPLY },
      'm1.1'
    )
  })

  it('без доп. полей и txnId — только текст, txnId отдаёт на откуп SDK', async () => {
    const client = fakeClient()
    await sendMessage(asClient(client), ROOM, 'Привет')
    expect(client.sendEvent).toHaveBeenCalledWith(
      ROOM,
      'm.room.message',
      { msgtype: 'm.text', body: 'Привет' },
      undefined
    )
  })

  it('ошибка сервера доходит до вызывающего', async () => {
    const client = fakeClient()
    client.sendEvent.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await expect(sendMessage(asClient(client), ROOM, 'Привет')).rejects.toThrow('M_FORBIDDEN')
  })
})

describe('sendEncryptedTextMessage — групповое сообщение общим ключом', () => {
  const payload = { body: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', hash: 'usershash_v13_2', block: 10 }

  it('m.encrypted с шифротекстом, hash комплекта ключей и block; ответ — на внешнем content', async () => {
    const client = fakeClient()
    const res = await sendEncryptedTextMessage(asClient(client), ROOM, payload, REPLY, 'm2.1')

    expect(res).toEqual({ event_id: '$sent' })
    expect(client.sendEvent).toHaveBeenCalledTimes(1)
    expect(client.sendEvent).toHaveBeenCalledWith(
      ROOM,
      'm.room.message',
      {
        msgtype: 'm.encrypted',
        body: payload.body,
        hash: payload.hash,
        block: 10,
        ...REPLY,
      },
      'm2.1'
    )
  })

  it('SDK упал — ошибка у вызывающего, второй (открытой) попытки нет', async () => {
    const client = fakeClient()
    client.sendEvent.mockRejectedValueOnce(new Error('network down'))

    await expect(
      sendEncryptedTextMessage(asClient(client), ROOM, payload, undefined, 'm2.2')
    ).rejects.toThrow('network down')

    expect(client.sendEvent).toHaveBeenCalledTimes(1)
    for (const call of client.sendEvent.mock.calls) {
      expect((call[2] as Record<string, unknown>).msgtype).toBe('m.encrypted')
    }
  })
})

describe('шифротекст не заменяется доп. полями', () => {
  // Правка сообщения по спецификации Matrix несёт body «* текст» на верхнем
  // уровне: открытым текстом он не должен лечь поверх шифротекста.
  const plain = { body: '* секрет открытым текстом', msgtype: 'm.text', 'm.new_content': {} }

  it('групповое: body и msgtype из доп. полей не перекрывают зашифрованные', async () => {
    const client = fakeClient()
    const payload = { body: 'cipher', hash: 'h', block: 1 }
    await sendEncryptedTextMessage(asClient(client), ROOM, payload, plain)
    expect(client.sendEvent.mock.calls[0]![2]).toMatchObject({
      msgtype: 'm.encrypted',
      body: 'cipher',
      'm.new_content': {},
    })
  })

  it('личное: то же', async () => {
    const client = fakeClient()
    const payload = { body: 'cipher', block: 1, version: 2 }
    await sendEncryptedDirectMessage(asClient(client), ROOM, payload, plain)
    expect(client.sendEvent.mock.calls[0]![2]).toMatchObject({
      msgtype: 'm.encrypted',
      body: 'cipher',
    })
  })
})

describe('sendEncryptedDirectMessage — личное сообщение (per-user ключи)', () => {
  const payload = { body: 'eyJAYWxpY2UiOiJ4eXoifQ==', block: 3_000_123, version: 2 }

  it('m.encrypted с block и version, без hash — иначе получатель пойдёт групповым путём', async () => {
    const client = fakeClient()
    await sendEncryptedDirectMessage(asClient(client), ROOM, payload, REPLY, 'm3.1')

    expect(client.sendEvent).toHaveBeenCalledTimes(1)
    const [roomId, type, content, txnId] = client.sendEvent.mock.calls[0]!
    expect([roomId, type, txnId]).toEqual([ROOM, 'm.room.message', 'm3.1'])
    expect(content).toEqual({
      msgtype: 'm.encrypted',
      body: payload.body,
      block: payload.block,
      version: 2,
      ...REPLY,
    })
    expect(content).not.toHaveProperty('hash')
  })

  it('SDK упал — ошибка у вызывающего, открытый текст не отправляется', async () => {
    const client = fakeClient()
    client.sendEvent.mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))

    await expect(sendEncryptedDirectMessage(asClient(client), ROOM, payload)).rejects.toThrow(
      'M_LIMIT_EXCEEDED'
    )
    expect(client.sendEvent).toHaveBeenCalledTimes(1)
    expect(client.sendEvent.mock.calls[0]![2]).toMatchObject({ msgtype: 'm.encrypted' })
  })
})

describe('redactEvent — удаление сообщения', () => {
  it('с причиной — причина уходит в content редакции, txnId выбирает SDK', async () => {
    const client = fakeClient()
    await redactEvent(asClient(client), ROOM, '$msg', 'deleted')
    expect(client.redactEvent).toHaveBeenCalledWith(ROOM, '$msg', undefined, { reason: 'deleted' })
  })

  it('без причины — пустой reason не отправляется', async () => {
    const client = fakeClient()
    await redactEvent(asClient(client), ROOM, '$msg')
    await redactEvent(asClient(client), ROOM, '$msg2', '')
    expect(client.redactEvent).toHaveBeenNthCalledWith(1, ROOM, '$msg', undefined, undefined)
    expect(client.redactEvent).toHaveBeenNthCalledWith(2, ROOM, '$msg2', undefined, undefined)
  })

  it('сервер отказал (нет прав) — ошибка у вызывающего', async () => {
    const client = fakeClient()
    client.redactEvent.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await expect(redactEvent(asClient(client), ROOM, '$msg', 'deleted')).rejects.toThrow(
      'M_FORBIDDEN'
    )
  })
})

describe('sendStateEvent — общий ключ группы', () => {
  it('m.room.encryption с ключами уходит state-событием с ключом pcrypto.<я>.<hash>', async () => {
    const client = fakeClient()
    const content = { version: 2, hash: 'h_v13_2', block: 10, keys: 'enc-keys' }
    const res = await sendStateEvent(
      asClient(client),
      ROOM,
      'm.room.encryption',
      content,
      'pcrypto.me.h_v13_2'
    )
    expect(res).toEqual({ event_id: '$state' })
    expect(client.sendStateEvent).toHaveBeenCalledWith(
      ROOM,
      'm.room.encryption',
      content,
      'pcrypto.me.h_v13_2'
    )
    expect(client.sendEvent).not.toHaveBeenCalled()
  })
})

describe('sendReaction — реакция на сообщение', () => {
  it('m.reaction с аннотацией к событию; текста сообщения в ней нет', async () => {
    const client = fakeClient()
    await sendReaction(asClient(client), ROOM, '$msg', '👍')
    expect(client.sendEvent).toHaveBeenCalledWith(ROOM, 'm.reaction', {
      'm.relates_to': { event_id: '$msg', key: '👍', rel_type: 'm.annotation' },
    })
    expect(client.sendEvent.mock.calls[0]![2]).not.toHaveProperty('body')
  })

  it('ошибка сервера доходит до вызывающего', async () => {
    const client = fakeClient()
    client.sendEvent.mockRejectedValueOnce(new Error('timeout'))
    await expect(sendReaction(asClient(client), ROOM, '$msg', '❤️')).rejects.toThrow('timeout')
  })
})
