import { describe, it, expect, vi } from 'vitest'

import type { Message } from '../../types'
import {
  createProgressHandler,
  markLastSendingFailed,
  pushOptimistic,
  removeOptimistic,
  revokeObjectUrlQuiet,
} from './media-sending-helpers'

const msg = (
  id: string,
  type: Message['type'],
  status: Message['status'] = 'sending'
): Message => ({
  id,
  chatId: 'c',
  senderId: 'me',
  text: '',
  type,
  info: { size: 200, uploadProgress: 0 },
  timestamp: 1,
  read: true,
  status,
})

describe('media-sending-helpers', () => {
  it('pushOptimistic создаёт ленту и добавляет в ТОТ ЖЕ объект', () => {
    const messages: Record<string, Message[]> = {}
    const m = msg('t1', 'file')
    pushOptimistic(messages, 'c', m)
    expect(messages['c']).toEqual([m])
    expect(messages['c']![0]).toBe(m)
  })

  it('createProgressHandler пишет проценты; без total считает от размера', () => {
    const messages = { c: [msg('t1', 'image')] }
    const onProgress = createProgressHandler(messages, 'c', 't1')
    onProgress(50, 200)
    expect(messages.c[0]!.info?.uploadProgress).toBe(25)
    onProgress(100)
    expect(messages.c[0]!.info?.uploadProgress).toBe(50)
    onProgress(999, 200)
    expect(messages.c[0]!.info?.uploadProgress).toBe(100)
    // чужой tempId — ничего не трогает
    createProgressHandler(messages, 'c', 'other')(10, 10)
    expect(messages.c[0]!.info?.uploadProgress).toBe(100)
  })

  it('removeOptimistic убирает только целевое сообщение и терпит отсутствие ленты', () => {
    const messages = { c: [msg('a', 'file'), msg('t1', 'file'), msg('b', 'file')] }
    removeOptimistic(messages, 'c', 't1')
    expect(messages.c.map((m) => m.id)).toEqual(['a', 'b'])
    expect(() => removeOptimistic(messages, 'nope', 't1')).not.toThrow()
  })

  it('markLastSendingFailed помечает последнее «sending» сообщение того же типа', () => {
    const messages = { c: [msg('a', 'file', 'sent'), msg('t1', 'image')] }
    markLastSendingFailed(messages, 'c', 'file')
    expect(messages.c[1]!.status).toBe('sending') // тип не совпал
    markLastSendingFailed(messages, 'c', 'image')
    expect(messages.c[1]!.status).toBe('failed')
    expect(() => markLastSendingFailed(messages, 'nope', 'image')).not.toThrow()
  })

  it('revokeObjectUrlQuiet глотает ошибки и пустые значения', () => {
    const revoke = vi.fn(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke })
    expect(() => revokeObjectUrlQuiet('blob:x')).not.toThrow()
    expect(revoke).toHaveBeenCalledWith('blob:x')
    revokeObjectUrlQuiet(null)
    expect(revoke).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
