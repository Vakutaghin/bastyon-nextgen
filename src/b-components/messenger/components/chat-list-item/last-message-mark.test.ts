// Отметка своего последнего сообщения в строке списка чатов.

import { describe, expect, it } from 'vitest'
import { lastMessageMark } from './last-message-mark'

const t = (key: string) => key
const msg = (over: Partial<Parameters<typeof lastMessageMark>[0]> = {}) => ({
  id: '$event',
  chatId: '!room:host',
  status: 'sent' as const,
  transport: undefined,
  ...over,
})

describe('lastMessageMark', () => {
  it('Matrix: отправляется, дошло, прочитано', () => {
    expect(lastMessageMark(msg({ id: '~local' }), false, t)).toMatchObject({ mark: '…' })
    expect(lastMessageMark(msg(), false, t)).toMatchObject({ mark: '✓', done: false })
    expect(lastMessageMark(msg(), true, t)).toMatchObject({ mark: '✓✓', done: true })
  })

  it('не отправленное — без галочки', () => {
    expect(lastMessageMark(msg({ status: 'failed' }), false, t)).toBeNull()
  })

  it('mesh: подтверждение радио — «✓✓»', () => {
    const mesh = msg({ chatId: 'mesh:lx:self:u:peer', transport: 'lxmf', status: 'delivered' })
    expect(lastMessageMark(mesh, false, t)).toMatchObject({ mark: '✓✓', done: true })
  })
})
